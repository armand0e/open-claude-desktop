// Proves the desktop Startup bridge controls live operating-system behavior:
// enabling the tray keeps the app alive and hides its window on close;
// disabling it restores normal close-to-quit behavior.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("CDP timed out")), 15_000);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener("error", reject, { once: true });
  });
  const id = ++commandId;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Runtime.evaluate timed out")),
        20_000,
      );
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else if (message.result?.exceptionDetails)
          reject(
            new Error(
              message.result.exceptionDetails.exception?.description ??
                message.result.exceptionDetails.text,
            ),
          );
        else resolve(message.result?.result?.value);
      });
      socket.send(
        JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });
  } finally {
    socket.close();
  }
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

const profile = await mkdtemp(path.join(os.tmpdir(), "open-claude-tray-"));
const debuggerPort = await unusedPort();
const output = [];
const child = spawn(
  electron,
  [".", `--remote-debugging-port=${debuggerPort}`],
  {
    cwd: process.cwd(),
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      OPEN_CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const enabled = await eventually(debuggerPort, (target) =>
    evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while ((!window["claude.settings"]?.Startup || !window["claude.web"]?.WindowControl) && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        const startup = window["claude.settings"].Startup;
        await startup.setMenuBarEnabled(true);
        return await startup.isMenuBarEnabled();
      })()`,
    ),
  );
  assert(enabled === true, "The Startup service did not create a live tray");

  await eventually(debuggerPort, (target) =>
    evaluate(target, `window["claude.web"].WindowControl.close()`),
  );
  const visibility = await eventually(debuggerPort, async (target) => {
    const visible = await evaluate(
      target,
      `window["claude.web"].WindowState.getVisibility()`,
    );
    if (visible !== false) throw new Error("The window is not hidden yet");
    return visible;
  });
  assert(child.exitCode === null, "The app exited while its tray was enabled");

  const disabled = await eventually(debuggerPort, (target) =>
    evaluate(
      target,
      `(async () => {
        const startup = window["claude.settings"].Startup;
        await startup.setMenuBarEnabled(false);
        return await startup.isMenuBarEnabled();
      })()`,
    ),
  );
  assert(disabled === false, "The Startup service did not destroy the tray");
  await eventually(debuggerPort, (target) =>
    evaluate(target, `window["claude.web"].WindowControl.close()`),
  );
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("The app did not quit without a tray")),
        20_000,
      ),
    ),
  ]);

  const state = JSON.parse(
    await readFile(path.join(profile, "claude-local-desktop.json"), "utf8"),
  );
  assert(
    state.menuBarEnabled === false,
    "The disabled tray state was not saved",
  );
  console.log(
    JSON.stringify(
      {
        trayCreated: enabled,
        closeWithTrayVisible: visibility,
        processStayedAlive: true,
        trayDestroyed: !disabled,
        closeWithoutTrayExited: true,
      },
      null,
      2,
    ),
  );
  console.log("DESKTOP SETTINGS PROBE OK");
} catch (error) {
  console.error(error);
  console.error(output.join(""));
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  await rm(profile, { recursive: true, force: true });
}
