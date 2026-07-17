import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function targetAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Target list returned ${response.status}`);
  const targets = await response.json();
  return targets.find(
    (target) =>
      target.type === "page" &&
      target.url.startsWith("app://localhost") &&
      !target.url.startsWith("app://localhost/blank"),
  );
}

let commandId = 0;
async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CDP connection timed out")),
      15_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      (event) => {
        clearTimeout(timer);
        reject(event.error ?? new Error("CDP connection failed"));
      },
      { once: true },
    );
  });
  const id = ++commandId;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.removeEventListener("message", listener);
        reject(new Error(`${method} timed out`));
      }, 15_000);
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(JSON.stringify({ id, method, params }));
    });
  } finally {
    socket.close();
  }
}

async function evaluate(target, expression) {
  const result = await cdp(target, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Evaluation failed",
    );
  return result.result?.value;
}

async function eventually(port, operation, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await targetAt(port);
      if (target?.webSocketDebuggerUrl) return await operation(target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error("Timed out waiting for renderer");
}

async function click(target, rect) {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
    buttons: 0,
    pointerType: "mouse",
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    buttons: 1,
    clickCount: 1,
    pointerType: "mouse",
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    buttons: 0,
    clickCount: 1,
    pointerType: "mouse",
  });
}

function nativeClick(processId, rect, devicePixelRatio = 1) {
  const x = Math.round((rect.x + rect.width / 2) * devicePixelRatio);
  const y = Math.round((rect.y + rect.height / 2) * devicePixelRatio);
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ClaudeLocalMouse {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int command);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
}
'@
$deadline = [DateTime]::UtcNow.AddSeconds(10)
$windowProcess = $null
while ($null -eq $windowProcess -and [DateTime]::UtcNow -lt $deadline) {
  $processes = @(Get-CimInstance Win32_Process)
  $ids = [System.Collections.Generic.HashSet[int]]::new()
  [void]$ids.Add(${processId})
  do {
    $added = $false
    foreach ($candidate in $processes) {
      if ($ids.Contains([int]$candidate.ParentProcessId) -and $ids.Add([int]$candidate.ProcessId)) {
        $added = $true
      }
    }
  } while ($added)
  $fallbackWindowProcess = $null
  foreach ($id in $ids) {
    try {
      $candidate = Get-Process -Id $id -ErrorAction Stop
      $candidate.Refresh()
      if ($candidate.MainWindowHandle -ne 0) {
        if ($candidate.MainWindowTitle -eq "Claude") {
          $windowProcess = $candidate
          break
        }
        if ($null -eq $fallbackWindowProcess) { $fallbackWindowProcess = $candidate }
      }
    } catch {}
  }
  if ($null -eq $windowProcess) { $windowProcess = $fallbackWindowProcess }
  if ($null -ne $windowProcess) { break }
  Start-Sleep -Milliseconds 50
}
$handle = if ($null -eq $windowProcess) { [IntPtr]::Zero } else { $windowProcess.MainWindowHandle }
if ($handle -eq 0) { throw "Electron process tree did not expose a main window handle" }
$rect = New-Object ClaudeLocalMouse+RECT
$client = New-Object ClaudeLocalMouse+RECT
$origin = New-Object ClaudeLocalMouse+POINT
$old = New-Object ClaudeLocalMouse+POINT
if (-not [ClaudeLocalMouse]::GetWindowRect($handle, [ref]$rect)) { throw "Could not read the Electron window bounds" }
if (-not [ClaudeLocalMouse]::GetClientRect($handle, [ref]$client)) { throw "Could not read the Electron client bounds" }
if (-not [ClaudeLocalMouse]::ClientToScreen($handle, [ref]$origin)) { throw "Could not locate the Electron client area" }
[void][ClaudeLocalMouse]::GetCursorPos([ref]$old)
[void][ClaudeLocalMouse]::ShowWindow($handle, 9)
[void][ClaudeLocalMouse]::SetForegroundWindow($handle)
[void][ClaudeLocalMouse]::SetCursorPos($origin.X + ${x}, $origin.Y + ${y})
Start-Sleep -Milliseconds 80
[ClaudeLocalMouse]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
[ClaudeLocalMouse]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[void][ClaudeLocalMouse]::SetCursorPos($old.X, $old.Y)
[PSCustomObject]@{
  processId = $windowProcess.Id
  processName = $windowProcess.ProcessName
  title = $windowProcess.MainWindowTitle
  clientOriginX = $origin.X
  clientOriginY = $origin.Y
  clickX = $origin.X + ${x}
  clickY = $origin.Y + ${y}
} | ConvertTo-Json -Compress
`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { encoding: "utf8", windowsHide: false },
  );
  if (result.status !== 0)
    throw new Error(
      `Native Windows click failed: ${result.stderr || result.stdout}`,
    );
  return JSON.parse(result.stdout.trim());
}

async function pressEscape(target) {
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
}

const profile = await mkdtemp(
  path.join(os.tmpdir(), "claude-real-navigation-"),
);
const debuggerPort = await unusedPort();
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const output = [];
const child = spawn(
  packagedExecutable ?? electron,
  [
    ...(packagedExecutable ? [] : ["."]),
    `--remote-debugging-port=${debuggerPort}`,
  ],
  {
    cwd: process.cwd(),
    // Native Win32 pointer verification needs a visible top-level window.
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      OPEN_CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_TRACE_LOCAL_UI: "1",
      CLAUDE_TRACE_LOCAL_API: "1",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const landing = await eventually(debuggerPort, async (target) => {
    const result = await evaluate(
      target,
      `(async () => {
        const visible = element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const deadline = Date.now() + 25000;
        let home, code, menu, sidebar, search, back, forward, add;
        while (Date.now() < deadline) {
          home = document.querySelector('button[aria-label="Home"]');
          code = document.querySelector('button[aria-label="Code"]');
          menu = document.querySelector('button[aria-label="Menu"]');
          sidebar = document.querySelector('button[aria-label="Collapse sidebar"]');
          search = document.querySelector('button[aria-label="Search"]');
          back = document.querySelector('button[aria-label="Back"]');
          forward = document.querySelector('button[aria-label="Forward"]');
          add = document.querySelector('button[aria-label="Add files, connectors, and more"], button[aria-label="Add content"]');
          if ([home, code, menu, sidebar, search, back, forward].every(Boolean) && add) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (![home, code, menu, sidebar, search, back, forward].every(Boolean))
          throw new Error("Native top navigation controls did not all render");
        let greeting = null;
        while (Date.now() < deadline && !greeting) {
          greeting = (document.body?.innerText || "").split(/\\r?\\n/)
            .map(text => text.trim())
            .find(text => /^(Back at it, .+|Hey there, .+|How.s it going\\?|.+ returns!|Coffee and Claude time\\?|Ready for another session\\?|Happy (Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day!?|That Friday feeling|Good evening, night owl|Hello, night owl|Moonlit chat\\?|What.s on your mind tonight\\?|Good morning(, .+)?|Good afternoon|What are we working on today, .+\\?|Good evening(, .+)?)$/.test(text || "")) || null;
          if (!greeting) await new Promise(resolve => setTimeout(resolve, 100));
        }
        const rect = element => element.getBoundingClientRect().toJSON();
        const hitStyle = element => ({
          pointerEvents: getComputedStyle(element).pointerEvents,
          appRegion: getComputedStyle(element).getPropertyValue("-webkit-app-region") || getComputedStyle(element).webkitAppRegion || ""
        });
        const bootstrap = await fetch("/edge-api/bootstrap?statsig_hashing_algorithm=djb2&growthbook_format=sdk")
          .then(response => response.json()).catch(error => ({ error: String(error) }));
        return {
          path: location.pathname + location.search,
          devicePixelRatio: window.devicePixelRatio,
          headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map(element => element.textContent?.trim()).filter(Boolean),
          greeting,
          promptChips: [...document.querySelectorAll("button")].filter(visible).map(button => button.textContent?.trim()).filter(text => /^(Write|Learn|Code|Life stuff|Claude.?s choice)$/i.test(text || "")),
          bodyText: document.body?.innerText?.slice(0, 5000),
          bootstrapGreeting: bootstrap.personalized_greeting || null,
          rects: {
            home: rect(home), code: rect(code), menu: rect(menu), sidebar: rect(sidebar),
            search: rect(search), back: rect(back), forward: rect(forward),
            add: add ? rect(add) : null
          },
          hitStyles: {
            menu: hitStyle(menu), sidebar: hitStyle(sidebar), search: hitStyle(search),
            back: hitStyle(back), forward: hitStyle(forward)
          }
        };
      })()`,
    );
    if (!result?.rects?.home) throw new Error("Home landing is not ready");
    return result;
  });
  assert(
    landing.path.startsWith("/new") &&
      /How can I help you today\?/i.test(landing.bodyText) &&
      Boolean(landing.greeting) &&
      landing.promptChips.length >= 5 &&
      !landing.bodyText.includes("Local Claude Workbench"),
    `Original native Home landing did not render: ${JSON.stringify(landing)}`,
  );
  for (const [name, style] of Object.entries(landing.hitStyles))
    assert(
      style.pointerEvents !== "none" && style.appRegion === "no-drag",
      `${name} is not physically clickable in the draggable titlebar: ${JSON.stringify(style)}`,
    );

  let target = await targetAt(debuggerPort);
  const nativeSidebarClick = nativeClick(
    child.pid,
    landing.rects.sidebar,
    landing.devicePixelRatio,
  );
  const collapsed = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const button = document.querySelector('button[aria-label="Expand sidebar"]');
        return button ? button.getBoundingClientRect().toJSON() : null;
      })()`,
    );
    if (!result)
      throw new Error(
        `Sidebar did not collapse after ${JSON.stringify(nativeSidebarClick)}`,
      );
    return result;
  });
  target = await targetAt(debuggerPort);
  await click(target, collapsed);
  await eventually(debuggerPort, async (activeTarget) => {
    const restored = await evaluate(
      activeTarget,
      `Boolean(document.querySelector('button[aria-label="Collapse sidebar"]'))`,
    );
    if (!restored) throw new Error("Sidebar did not expand");
    return restored;
  });

  target = await targetAt(debuggerPort);
  nativeClick(child.pid, landing.rects.search, landing.devicePixelRatio);
  const search = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        const inputs = [...document.querySelectorAll("input")].filter(visible);
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
        const input = inputs.find(element => /search/i.test(element.placeholder || element.getAttribute("aria-label") || ""));
        return input || dialogs.some(dialog => /search/i.test(dialog.textContent || ""))
          ? { opened: true, placeholder: input?.placeholder || null }
          : null;
      })()`,
    );
    if (!result) throw new Error("Search UI did not open");
    return result;
  });
  target = await targetAt(debuggerPort);
  await pressEscape(target);

  await eventually(debuggerPort, async (activeTarget) => {
    const closed = await evaluate(
      activeTarget,
      `(() => {
        const visible = element => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const searchInputs = [...document.querySelectorAll("input")]
          .filter(visible)
          .filter(element => /search/i.test(element.placeholder || element.getAttribute("aria-label") || ""));
        const searchDialogs = [...document.querySelectorAll('[role="dialog"]')]
          .filter(visible)
          .filter(dialog => /search/i.test(dialog.textContent || ""));
        return searchInputs.length === 0 && searchDialogs.length === 0;
      })()`,
    );
    if (!closed) throw new Error("Search UI is still visible after Escape");
    return true;
  });
  const currentAdd = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const button = document.querySelector('button[aria-label="Add files, connectors, and more"], button[aria-label="Add content"]');
        if (!button) return null;
        const rect = button.getBoundingClientRect();
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          rect: rect.toJSON(),
          hit: hit?.outerHTML?.slice(0, 1000) || null,
          elementsAtPoint: document.elementsFromPoint(x, y).map(element => ({
            tag: element.tagName,
            aria: element.getAttribute("aria-label"),
            role: element.getAttribute("role"),
            text: element.textContent?.replace(/\\s+/g, " ").trim().slice(0, 160),
            pointerEvents: getComputedStyle(element).pointerEvents
          })).slice(0, 12),
          buttonStyle: {
            pointerEvents: getComputedStyle(button).pointerEvents,
            display: getComputedStyle(button).display,
            visibility: getComputedStyle(button).visibility,
            opacity: getComputedStyle(button).opacity
          },
          ancestors: [...function* () {
            let element = button;
            while (element) {
              yield {
                tag: element.tagName,
                className: String(element.className || "").slice(0, 300),
                pointerEvents: getComputedStyle(element).pointerEvents
              };
              element = element.parentElement;
            }
          }()].slice(0, 12)
        };
      })()`,
    );
    if (!result) throw new Error("Native attachment button disappeared");
    if (result.buttonStyle.pointerEvents === "none")
      throw new Error(
        `Native attachment button is still pointer-disabled after Search closed: ${JSON.stringify(result)}`,
      );
    return result;
  });
  target = await targetAt(debuggerPort);
  await click(target, currentAdd.rect);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const physicalExpanded = await evaluate(
    target,
    `document.querySelector('button[aria-label="Add files, connectors, and more"], button[aria-label="Add content"]')?.getAttribute("aria-expanded")`,
  );
  if (physicalExpanded !== "true")
    await evaluate(
      target,
      `document.querySelector('button[aria-label="Add files, connectors, and more"], button[aria-label="Add content"]')?.click()`,
    );
  const triggerMode =
    physicalExpanded === "true" ? "pointer" : "native-click-fallback";
  const addMenu = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        const labels = [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], button')]
          .filter(visible).map(element => element.textContent?.replace(/\\s+/g, " ").trim()).filter(Boolean);
        const button = document.querySelector('button[aria-label="Add files, connectors, and more"], button[aria-label="Add content"]');
        return {
          labels,
          hasWebSearch: labels.some(label => /Web search/i.test(label)),
          triggerMode: ${JSON.stringify(triggerMode)},
          button: button ? {
            disabled: button.disabled,
            ariaExpanded: button.getAttribute("aria-expanded"),
            dataState: button.getAttribute("data-state"),
            active: document.activeElement === button
          } : null,
          popups: [...document.querySelectorAll('[role="menu"], [data-popup-open], [data-open]')]
            .map(element => ({
              role: element.getAttribute("role"),
              text: element.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1000),
              rect: element.getBoundingClientRect().toJSON()
            }))
        };
      })()`,
    );
    if (!result?.hasWebSearch)
      throw new Error(
        `Attachment menu with Web search did not open: ${JSON.stringify({ result, currentAdd })}`,
      );
    return result;
  });
  target = await targetAt(debuggerPort);
  await pressEscape(target);

  target = await targetAt(debuggerPort);
  await click(target, landing.rects.code);
  const codeLanding = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        if (!location.pathname.startsWith("/code") && !location.pathname.startsWith("/epitaxy")) return null;
        const home = document.querySelector('button[aria-label="Home"]');
        const code = document.querySelector('button[aria-label="Code"]');
        if (!home || !code) return null;
        const bodyText = document.body?.innerText?.slice(0, 5000) || "";
        if (!/Describe a task|What.s up next|Select a folder/i.test(bodyText)) return null;
        return {
          path: location.pathname + location.search,
          home: home.getBoundingClientRect().toJSON(),
          codeActive: code.hasAttribute("data-active") || code.getAttribute("aria-current"),
          headings: [...document.querySelectorAll("h1,h2,h3")].map(element => element.textContent?.trim()).filter(Boolean),
          bodyText
        };
      })()`,
    );
    if (!result) throw new Error("Native Code landing did not open");
    return result;
  });
  assert(
    /Describe a task|What.s up next|Select a folder/i.test(
      codeLanding.bodyText,
    ),
    `Native Code landing content is missing: ${JSON.stringify(codeLanding)}`,
  );

  target = await targetAt(debuggerPort);
  await click(target, codeLanding.home);
  const returnedHome = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const back = document.querySelector('button[aria-label="Back"]');
        return location.pathname.startsWith("/new") && back && !back.disabled && back.getAttribute("aria-disabled") !== "true"
          ? { path: location.pathname + location.search, back: back.getBoundingClientRect().toJSON() }
          : null;
      })()`,
    );
    if (!result?.back) throw new Error("Home did not reopen from Code");
    return result;
  });

  target = await targetAt(debuggerPort);
  nativeClick(child.pid, returnedHome.back, landing.devicePixelRatio);
  const backed = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const forward = document.querySelector('button[aria-label="Forward"]');
        return (location.pathname.startsWith("/code") || location.pathname.startsWith("/epitaxy")) && forward && !forward.disabled && forward.getAttribute("aria-disabled") !== "true"
          ? { path: location.pathname, forward: forward.getBoundingClientRect().toJSON() }
          : null;
      })()`,
    );
    if (!result?.forward) throw new Error("Back button did not return to Code");
    return result;
  });
  target = await targetAt(debuggerPort);
  nativeClick(child.pid, backed.forward, landing.devicePixelRatio);
  const forwarded = await eventually(debuggerPort, async (activeTarget) => {
    const path = await evaluate(activeTarget, `location.pathname`);
    if (!path.startsWith("/new"))
      throw new Error("Forward button did not return Home");
    return path;
  });

  target = await targetAt(debuggerPort);
  nativeClick(child.pid, landing.rects.menu, landing.devicePixelRatio);
  const menuDeadline = Date.now() + 3000;
  while (
    !output.join("").includes("[local-ui] main menu popup") &&
    Date.now() < menuDeadline
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  const menuOpened = output.join("").includes("[local-ui] main menu popup");
  assert(menuOpened, "Native application menu button did not request a popup");

  process.stdout.write(
    `${JSON.stringify(
      {
        landing: {
          path: landing.path,
          headings: landing.headings,
          greeting: landing.greeting,
          bootstrapGreeting: landing.bootstrapGreeting,
          promptChips: landing.promptChips,
          bodyText: landing.bodyText,
        },
        controls: {
          menuOpened,
          sidebarCollapsedAndRestored: true,
          search,
          addMenu,
          codeLanding,
          returnedHome: returnedHome.path,
          backed: backed.path,
          forwarded,
        },
        apiTrace: output
          .join("")
          .split(/\r?\n/)
          .filter((line) => line.includes("[local-api]"))
          .slice(-200),
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ error: String(error), electronOutput: output.join("") }, null, 2)}\n`,
  );
  throw error;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
