// Computer use: OS-level screen capture and input for the chat's
// computer_* tools. Off by default; every conversation's FIRST action must
// pass an explicit native consent dialog, and each action is refused when
// consent was denied. Windows input goes through a small PowerShell
// user32.SendInput helper; screenshots use Electron's desktopCapturer.

import { spawn } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { desktopCapturer, screen } from "electron";

type JsonObject = Record<string, unknown>;

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

const SENDINPUT_PRELUDE = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class LocalInput {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
}
"@
`;

function runPowerShell(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-2_000);
    });
    const timer = setTimeout(() => child.kill(), 20_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Input helper exited ${code}`));
    });
  });
}

export class LocalComputerUse {
  readonly #shotsRoot: string;
  readonly #confirm: (conversationUuid: string) => Promise<boolean>;
  // null = not asked yet; true/false = the user's answer for the session.
  readonly #consent = new Map<string, boolean>();
  #shotCounter = 0;

  constructor(
    userDataPath: string,
    confirm: (conversationUuid: string) => Promise<boolean>,
  ) {
    this.#shotsRoot = path.join(userDataPath, "computer-use", "shots");
    this.#confirm = confirm;
  }

  async #ensureConsent(conversationUuid: string): Promise<void> {
    const existing = this.#consent.get(conversationUuid);
    if (existing === true) return;
    if (existing === false)
      throw new Error(
        "The user declined computer control for this conversation",
      );
    const granted = await this.#confirm(conversationUuid);
    this.#consent.set(conversationUuid, granted);
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
    if (process.platform !== "win32" && process.platform !== "linux")
      throw new Error("Computer use is not supported on this platform");
    if (process.platform === "linux")
      throw new Error(
        "Computer use is not implemented for Linux yet — only screenshots and input on Windows",
      );
    if (signal.aborted) throw new Error("The computer action was cancelled");
    await this.#ensureConsent(conversationUuid);
    switch (name) {
      case "computer_screenshot":
        return this.#screenshot(conversationUuid);
      case "computer_click": {
        const x = numberValue(input.x);
        const y = numberValue(input.y);
        if (x === undefined || y === undefined)
          throw new Error("computer_click requires x and y");
        const button = input.button === "right" ? "right" : "left";
        const double = input.button === "double";
        const down = button === "right" ? 0x0008 : 0x0002;
        const up = button === "right" ? 0x0010 : 0x0004;
        const clickOnce = `[LocalInput]::mouse_event(${down},0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 40; [LocalInput]::mouse_event(${up},0,0,0,[UIntPtr]::Zero)`;
        await runPowerShell(
          `${SENDINPUT_PRELUDE}\n[LocalInput]::SetCursorPos(${x},${y}) | Out-Null; Start-Sleep -Milliseconds 60; ${clickOnce}${double ? `; Start-Sleep -Milliseconds 80; ${clickOnce}` : ""}`,
        );
        return {
          output: `${double ? "Double-clicked" : button === "right" ? "Right-clicked" : "Clicked"} at ${x},${y}. Take a screenshot to verify the effect.`,
        };
      }
      case "computer_type": {
        const value = typeof input.text === "string" ? input.text : "";
        if (!value) throw new Error("computer_type requires text");
        // SendKeys handles unicode and is fine for typing into the focus.
        const escaped = value
          .replaceAll(/([+^%~(){}[\]])/g, "{$1}")
          .replaceAll("\r\n", "~")
          .replaceAll("\n", "~")
          .replaceAll("'", "''");
        await runPowerShell(
          `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`,
        );
        return { output: "Typed the text at the current focus." };
      }
      case "computer_key": {
        const combo = typeof input.combo === "string" ? input.combo : "";
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
        await runPowerShell(
          `${SENDINPUT_PRELUDE}\n${downs}; Start-Sleep -Milliseconds 50; ${ups}`,
        );
        return { output: `Pressed ${combo}.` };
      }
      default:
        throw new Error(`Unknown computer tool: ${name}`);
    }
  }

  async #screenshot(conversationUuid: string): Promise<{ output: string }> {
    const display = screen.getPrimaryDisplay();
    const size = {
      width: Math.round(display.size.width * display.scaleFactor),
      height: Math.round(display.size.height * display.scaleFactor),
    };
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: size,
    });
    const primary =
      sources.find((source) => source.display_id === String(display.id)) ??
      sources[0];
    if (!primary) throw new Error("No screen source was available");
    const png = primary.thumbnail.toPNG();
    const key = conversationUuid.toLowerCase();
    if (!/^[0-9a-f][0-9a-f-]{0,63}$/.test(key))
      throw new Error("Invalid computer conversation id");
    const directory = path.join(this.#shotsRoot, key);
    await mkdir(directory, { recursive: true });
    this.#shotCounter += 1;
    const fileName = `shot-${Date.now()}-${this.#shotCounter}.png`;
    await writeFile(path.join(directory, fileName), png);
    // SetCursorPos and the capture are both in physical pixels, so the
    // model's coordinates come straight from the screenshot (this matters
    // on scaled displays).
    return {
      output: `Screen captured at ${size.width}x${size.height}; click coordinates map 1:1 onto this screenshot. Show it with: ![screen](/api/local/computer/shots/${key}/${fileName})`,
    };
  }

  async shotFile(
    conversationUuid: string,
    fileName: string,
  ): Promise<{ absolutePath: string; size_bytes: number } | null> {
    const key = conversationUuid.toLowerCase();
    if (
      !/^[0-9a-f][0-9a-f-]{0,63}$/.test(key) ||
      !/^shot-[0-9]+-[0-9]+\.png$/.test(fileName)
    )
      return null;
    const absolutePath = path.join(this.#shotsRoot, key, fileName);
    try {
      const info = await stat(absolutePath);
      return info.isFile() ? { absolutePath, size_bytes: info.size } : null;
    } catch {
      return null;
    }
  }
}
