// Computer use: OS-level screen capture and input for the chat's
// computer_* tools. Off by default; every conversation's FIRST action must
// pass an explicit native consent dialog, and each action is refused when
// consent was denied. Windows input goes through a small PowerShell
// user32.SendInput helper; screenshots use Electron's desktopCapturer.

import { spawn, type ChildProcess } from "node:child_process";
import {
  lstat,
  mkdir,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { desktopCapturer, screen } from "electron";

type JsonObject = Record<string, unknown>;
const MAX_TYPED_TEXT = 8_000;
const MAX_SCREENSHOT_BYTES = 50 * 1024 * 1024;
const MAX_SAVED_SHOTS = 100;

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : undefined;
}

const KEY_CODES: Record<string, number> = {
  enter: 0x0d,
  tab: 0x09,
  escape: 0x1b,
  esc: 0x1b,
  backspace: 0x08,
  delete: 0x2e,
  space: 0x20,
  up: 0x26,
  down: 0x28,
  left: 0x25,
  right: 0x27,
  home: 0x24,
  end: 0x23,
  pageup: 0x21,
  pagedown: 0x22,
  ctrl: 0x11,
  alt: 0x12,
  shift: 0x10,
  win: 0x5b,
  f1: 0x70,
  f2: 0x71,
  f3: 0x72,
  f4: 0x73,
  f5: 0x74,
  f6: 0x75,
  f7: 0x76,
  f8: 0x77,
  f9: 0x78,
  f10: 0x79,
  f11: 0x7a,
  f12: 0x7b,
};

function keyCode(name: string): number | undefined {
  const lower = name.toLowerCase();
  if (KEY_CODES[lower] !== undefined) return KEY_CODES[lower];
  if (/^[a-z0-9]$/.test(lower)) return lower.toUpperCase().charCodeAt(0);
  return undefined;
}

function conversationKey(conversationUuid: string): string {
  const key = conversationUuid.toLowerCase();
  if (!/^[0-9a-f][0-9a-f-]{0,63}$/.test(key))
    throw new Error("Invalid computer conversation id");
  return key;
}

const SENDINPUT_PRELUDE = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class LocalInput {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  public static void EnableDpiAwareness() {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
    catch { try { SetProcessDPIAware(); } catch {} }
  }
  public static void Scroll(int delta) {
    mouse_event(0x0800, 0, 0, unchecked((uint)delta), UIntPtr.Zero);
  }
}
"@
[LocalInput]::EnableDpiAwareness()
`;

function runPowerShell(
  script: string,
  signal: AbortSignal,
  children: Set<ChildProcess>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
    );
    children.add(child);
    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      children.delete(child);
      if (error) reject(error);
      else resolve();
    };
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-2_000);
    });
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("Input helper timed out"));
    }, 20_000);
    const onAbort = () => {
      child.kill();
      finish(new Error("The computer action was cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    child.on("error", (error) => {
      finish(error);
    });
    child.on("close", (code) => {
      if (code === 0) finish();
      else finish(new Error(stderr.trim() || `Input helper exited ${code}`));
    });
  });
}

export class LocalComputerUse {
  readonly #shotsRoot: string;
  readonly #confirm: (conversationUuid: string) => Promise<boolean>;
  // null = not asked yet; true/false = the user's answer for the session.
  readonly #consent = new Map<string, boolean>();
  readonly #consentPromises = new Map<string, Promise<boolean>>();
  readonly #consentGeneration = new Map<string, number>();
  readonly #children = new Set<ChildProcess>();
  readonly #lifecycleAbort = new AbortController();
  #shotCounter = 0;
  #disposed = false;

  constructor(
    userDataPath: string,
    confirm: (conversationUuid: string) => Promise<boolean>,
    private readonly runInput: typeof runPowerShell = runPowerShell,
  ) {
    this.#shotsRoot = path.join(userDataPath, "computer-use", "shots");
    this.#confirm = confirm;
  }

  async #ensureConsent(
    conversationUuid: string,
    signal: AbortSignal,
  ): Promise<void> {
    const key = conversationKey(conversationUuid);
    if (this.#disposed) throw new Error("Computer use is shutting down");
    const existing = this.#consent.get(key);
    if (existing === true) return;
    if (existing === false)
      throw new Error(
        "The user declined computer control for this conversation",
      );
    let pending = this.#consentPromises.get(key);
    if (!pending) {
      pending = this.#confirm(key);
      this.#consentPromises.set(key, pending);
      void pending.then(
        () => {
          if (this.#consentPromises.get(key) === pending)
            this.#consentPromises.delete(key);
        },
        () => {
          if (this.#consentPromises.get(key) === pending)
            this.#consentPromises.delete(key);
        },
      );
    }
    const generation = this.#consentGeneration.get(key) ?? 0;
    let granted: boolean;
    const lifecycleSignal = this.#lifecycleAbort.signal;
    let rejectCancelled!: (error: Error) => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      rejectCancelled = reject;
    });
    const onCancelled = () =>
      rejectCancelled(new Error("Computer use consent was cancelled"));
    signal.addEventListener("abort", onCancelled, { once: true });
    lifecycleSignal.addEventListener("abort", onCancelled, { once: true });
    try {
      if (signal.aborted || lifecycleSignal.aborted) onCancelled();
      granted = await Promise.race([pending, cancelled]);
    } finally {
      signal.removeEventListener("abort", onCancelled);
      lifecycleSignal.removeEventListener("abort", onCancelled);
    }
    // A conversation can be deleted (or the app can shut down) while the
    // native confirmation dialog is open. Never let that stale answer grant
    // control to a later conversation reusing the same id.
    if (
      this.#disposed ||
      (this.#consentGeneration.get(key) ?? 0) !== generation
    )
      throw new Error("Computer use consent was cancelled");
    this.#consent.set(key, granted);
    if (!granted)
      throw new Error(
        "The user declined computer control for this conversation",
      );
  }

  async run(
    conversationUuid: string,
    name: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<{ output: string }> {
    if (this.#disposed) throw new Error("Computer use is shutting down");
    if (process.platform !== "win32" && process.platform !== "linux")
      throw new Error("Computer use is not supported on this platform");
    if (process.platform === "linux")
      throw new Error(
        "Computer use is not implemented for Linux yet — only screenshots and input on Windows",
      );
    if (signal.aborted) throw new Error("The computer action was cancelled");
    await this.#ensureConsent(conversationUuid, signal);
    if (this.#disposed) throw new Error("Computer use is shutting down");
    if (signal.aborted) throw new Error("The computer action was cancelled");
    switch (name) {
      case "computer_screenshot":
        return this.#screenshot(conversationUuid, signal);
      case "computer_click": {
        const x = numberValue(input.x);
        const y = numberValue(input.y);
        if (x === undefined || y === undefined)
          throw new Error("computer_click requires x and y");
        const display = screen.getPrimaryDisplay();
        const width = Math.round(display.size.width * display.scaleFactor);
        const height = Math.round(display.size.height * display.scaleFactor);
        if (x < 0 || y < 0 || x >= width || y >= height)
          throw new Error(
            `computer_click coordinates must be within ${width}x${height}`,
          );
        const button = input.button === "right" ? "right" : "left";
        const double = input.button === "double";
        const down = button === "right" ? 0x0008 : 0x0002;
        const up = button === "right" ? 0x0010 : 0x0004;
        const clickOnce = `[LocalInput]::mouse_event(${down},0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [LocalInput]::mouse_event(${up},0,0,0,[UIntPtr]::Zero)`;
        await this.runInput(
          `${SENDINPUT_PRELUDE}\n[LocalInput]::SetCursorPos(${x},${y}) | Out-Null; Start-Sleep -Milliseconds 60; ${clickOnce}${double ? `; Start-Sleep -Milliseconds 80; ${clickOnce}` : ""}`,
          signal,
          this.#children,
        );
        return {
          output: `${double ? "Double-clicked" : button === "right" ? "Right-clicked" : "Clicked"} at ${x},${y}. Take a screenshot to verify the effect.`,
        };
      }
      case "computer_scroll": {
        const deltaY = numberValue(input.delta_y ?? input.deltaY);
        if (deltaY === undefined || deltaY === 0)
          throw new Error("computer_scroll requires a non-zero delta_y");
        if (Math.abs(deltaY) > 10_000)
          throw new Error(
            "computer_scroll delta_y must be between -10000 and 10000",
          );
        // Tool coordinates follow browser convention (positive means down),
        // while Win32 wheel deltas are positive when scrolling up.
        await this.runInput(
          `${SENDINPUT_PRELUDE}\n[LocalInput]::Scroll(${-deltaY})`,
          signal,
          this.#children,
        );
        return {
          output: `Scrolled ${deltaY > 0 ? "down" : "up"} ${Math.abs(deltaY)} units. Take a screenshot to verify the effect.`,
        };
      }
      case "computer_type": {
        const value = typeof input.text === "string" ? input.text : "";
        if (!value) throw new Error("computer_type requires text");
        if (value.includes("\0"))
          throw new Error("computer_type text contains a null byte");
        if (value.length > MAX_TYPED_TEXT)
          throw new Error(
            `computer_type text exceeds ${MAX_TYPED_TEXT} characters`,
          );
        // SendKeys handles unicode and is fine for typing into the focus.
        const escaped = value
          .replaceAll(/([+^%~(){}[\]])/g, "{$1}")
          .replaceAll("\r\n", "~")
          .replaceAll("\r", "~")
          .replaceAll("\n", "~")
          .replaceAll("'", "''");
        await this.runInput(
          `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`,
          signal,
          this.#children,
        );
        return { output: "Typed the text at the current focus." };
      }
      case "computer_key": {
        const combo = typeof input.combo === "string" ? input.combo : "";
        if (combo.length > 256)
          throw new Error("computer_key combo is too long");
        const parts = combo
          .split("+")
          .map((part) => part.trim())
          .filter(Boolean);
        const codes = parts.map(keyCode);
        if (parts.length === 0 || codes.some((code) => code === undefined))
          throw new Error(`Unsupported key combo: ${combo}`);
        const downs = codes
          .map(
            (code) => `[LocalInput]::keybd_event(${code},0,0,[UIntPtr]::Zero)`,
          )
          .join("; Start-Sleep -Milliseconds 25; ");
        const ups = [...codes]
          .reverse()
          .map(
            (code) => `[LocalInput]::keybd_event(${code},0,2,[UIntPtr]::Zero)`,
          )
          .join("; Start-Sleep -Milliseconds 25; ");
        await this.runInput(
          `${SENDINPUT_PRELUDE}\n${downs}; Start-Sleep -Milliseconds 50; ${ups}`,
          signal,
          this.#children,
        );
        return { output: `Pressed ${combo}.` };
      }
      default:
        throw new Error(`Unknown computer tool: ${name}`);
    }
  }

  async #screenshot(
    conversationUuid: string,
    signal: AbortSignal,
  ): Promise<{ output: string }> {
    const key = conversationKey(conversationUuid);
    const generation = this.#consentGeneration.get(key) ?? 0;
    const ensureActive = () => {
      if (this.#disposed) throw new Error("Computer use is shutting down");
      if (signal.aborted) throw new Error("The computer action was cancelled");
      if ((this.#consentGeneration.get(key) ?? 0) !== generation)
        throw new Error("Computer-use consent was revoked");
    };
    ensureActive();
    const display = screen.getPrimaryDisplay();
    const size = {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    };
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: size,
    });
    ensureActive();
    const primary =
      sources.find((source) => source.display_id === String(display.id)) ??
      sources[0];
    if (!primary) throw new Error("No screen source was available");
    const png = primary.thumbnail.toPNG();
    if (png.byteLength > MAX_SCREENSHOT_BYTES)
      throw new Error("Screen capture exceeded the 50 MB limit");
    const directory = path.join(this.#shotsRoot, key);
    await mkdir(directory, { recursive: true });
    ensureActive();
    this.#shotCounter += 1;
    const fileName = `shot-${Date.now()}-${this.#shotCounter}.png`;
    const screenshotPath = path.join(directory, fileName);
    await writeFile(screenshotPath, png);
    try {
      ensureActive();
    } catch (error) {
      await rm(screenshotPath, { force: true }).catch(() => undefined);
      throw error;
    }
    const shots = (await readdir(directory)).filter((entry) =>
      /^shot-[0-9]+-[0-9]+\.png$/.test(entry),
    );
    for (const old of shots.sort().slice(0, -MAX_SAVED_SHOTS))
      await rm(path.join(directory, old), { force: true }).catch(
        () => undefined,
      );
    const capturedSize = primary.thumbnail.getSize();
    // SetCursorPos and the capture are both in physical pixels, so the
    // model's coordinates come straight from the screenshot (this matters
    // on scaled displays).
    return {
      output: `Screen captured at ${capturedSize.width}x${capturedSize.height}; click coordinates map 1:1 onto this screenshot. Show it with: ![screen](/api/local/computer/shots/${key}/${fileName})`,
    };
  }

  async shotFile(
    conversationUuid: string,
    fileName: string,
  ): Promise<{ absolutePath: string; size_bytes: number } | null> {
    let key: string;
    try {
      key = conversationKey(conversationUuid);
    } catch {
      return null;
    }
    if (!/^shot-[0-9]+-[0-9]+\.png$/.test(fileName)) return null;
    const absolutePath = path.join(this.#shotsRoot, key, fileName);
    try {
      const candidate = await lstat(absolutePath);
      if (candidate.isSymbolicLink()) return null;
      const root = await realpath(path.join(this.#shotsRoot, key));
      const resolved = await realpath(absolutePath);
      const relative = path.relative(root, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
      const info = await stat(resolved);
      return info.isFile()
        ? { absolutePath: resolved, size_bytes: info.size }
        : null;
    } catch {
      return null;
    }
  }

  async removeConversation(conversationUuid: string): Promise<void> {
    const key = conversationKey(conversationUuid);
    this.#consentGeneration.set(
      key,
      (this.#consentGeneration.get(key) ?? 0) + 1,
    );
    this.#consent.delete(key);
    this.#consentPromises.delete(key);
    await rm(path.join(this.#shotsRoot, key), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }

  dispose(): void {
    this.#disposed = true;
    this.#lifecycleAbort.abort();
    for (const child of this.#children) child.kill();
    this.#children.clear();
    this.#consent.clear();
    this.#consentPromises.clear();
    this.#consentGeneration.clear();
  }
}
