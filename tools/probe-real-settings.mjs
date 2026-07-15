import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const baseUrl = process.env.CLAUDE_REAL_BASE_URL || "http://127.0.0.1:1234/v1";
const model = process.env.CLAUDE_REAL_MODEL || "llm";

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
      target.type === "page" && target.url.startsWith("app://localhost"),
  );
}

let commandId = 0;
async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const id = ++commandId;
  try {
    return await new Promise((resolve, reject) => {
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
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

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-real-settings-"));
const debuggerPort = await unusedPort();
const output = [];
const child = spawn(
  electron,
  [".", `--remote-debugging-port=${debuggerPort}`],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_TRACE_LOCAL_API: "1",
      CLAUDE_TRACE_LOCAL_UI: "1",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const trigger = await eventually(debuggerPort, async (target) =>
    evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        while (document.querySelectorAll('button').length === 0 && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        const root = document.querySelector("#local-claude-workbench")?.shadowRoot;
        if (!root) throw new Error("Local model workbench was not installed");
        const rect = root.querySelector("#trigger").getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          buttons: [...document.querySelectorAll('button')].map((button, index) => ({
            index,
            text: button.textContent?.trim().replace(/\s+/g, ' ').slice(0, 100) || '',
            aria: button.getAttribute('aria-label'),
            title: button.getAttribute('title'),
            testid: button.getAttribute('data-testid'),
            expanded: button.getAttribute('aria-expanded'),
            rect: button.getBoundingClientRect().toJSON()
          })).filter(button => button.rect.width > 0 && button.rect.height > 0)
        };
      })()`,
    ),
  );
  let target = await targetAt(debuggerPort);
  const menuButton = trigger.buttons.find(
    (button) => button.testid === "topbar-windows-menu",
  );
  assert(menuButton, "Windows menu button was not rendered");
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: menuButton.rect.x + menuButton.rect.width / 2,
    y: menuButton.rect.y + menuButton.rect.height / 2,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: menuButton.rect.x + menuButton.rect.width / 2,
    y: menuButton.rect.y + menuButton.rect.height / 2,
    button: "left",
    clickCount: 1,
  });
  const menuState = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const entries = [...document.querySelectorAll('[role="menuitem"], [role="option"]')]
          .filter(entry => entry.getBoundingClientRect().width > 0)
          .map(entry => ({
            text: entry.textContent?.trim().replace(/\s+/g, ' ') || '',
            role: entry.getAttribute('role'),
            rect: entry.getBoundingClientRect().toJSON()
          }));
        return entries.length ? { entries } : null;
      })()`,
    );
    if (!state) throw new Error("Windows menu is not open yet");
    return state;
  });
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

  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: trigger.x,
    y: trigger.y,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: trigger.x,
    y: trigger.y,
    button: "left",
    clickCount: 1,
  });
  const opened = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const root = document.querySelector("#local-claude-workbench")?.shadowRoot;
        const panel = root?.querySelector("#panel");
        const input = root?.querySelector("#base-url");
        if (!panel?.open || !input) return null;
        const rect = input.getBoundingClientRect();
        const composer = document.querySelector('[contenteditable="true"]');
        return {
          panelOpen: panel.open,
          value: input.value,
          focused: root.activeElement === input,
          disabled: input.disabled,
          readOnly: input.readOnly,
          composerBefore: composer?.textContent || "",
          rect: rect.toJSON(),
          shadowHit: root.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          )?.id
        };
      })()`,
    );
    if (!state) throw new Error("Local model dialog is not open yet");
    return state;
  });
  assert(
    opened.focused,
    `Endpoint input did not focus: ${JSON.stringify(opened)}`,
  );
  assert(
    opened.shadowHit === "base-url",
    `Endpoint is not the pointer hit target: ${JSON.stringify(opened)}`,
  );

  target = await targetAt(debuggerPort);
  const endpointX = opened.rect.x + opened.rect.width / 2;
  const endpointY = opened.rect.y + opened.rect.height / 2;
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: endpointX,
    y: endpointY,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: endpointX,
    y: endpointY,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp(target, "Input.insertText", {
    text: baseUrl,
  });
  const endpointTyped = await evaluate(
    target,
    `(() => {
      const root = document.querySelector("#local-claude-workbench").shadowRoot;
      const composer = document.querySelector('[contenteditable="true"]');
      return {
        value: root.querySelector("#base-url").value,
        active: root.activeElement?.id,
        documentActive: document.activeElement?.id,
        composerAfter: composer?.textContent || ""
      };
    })()`,
  );
  assert(
    endpointTyped.value === baseUrl,
    `Endpoint typing failed: ${JSON.stringify(endpointTyped)}`,
  );
  assert(
    endpointTyped.active === "base-url" &&
      endpointTyped.composerAfter === opened.composerBefore,
    `Typing escaped into the main composer: ${JSON.stringify({ opened, endpointTyped })}`,
  );

  const discovered = await evaluate(
    target,
    `(async () => {
      const root = document.querySelector("#local-claude-workbench").shadowRoot;
      root.querySelector("#models-button").click();
      const deadline = Date.now() + 10000;
      while (!root.querySelector("#models button") && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      return {
        models: [...root.querySelectorAll("#models button")].map(button => button.textContent),
        status: root.querySelector("#status").textContent
      };
    })()`,
  );
  assert(
    discovered.models.includes(model),
    `Draft endpoint model discovery failed: ${JSON.stringify(discovered)}`,
  );

  const modelBefore = await evaluate(
    target,
    `(() => {
      const input = document.querySelector("#local-claude-workbench").shadowRoot.querySelector("#model");
      const rect = input.getBoundingClientRect();
      return { value: input.value, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`,
  );
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: modelBefore.x,
    y: modelBefore.y,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: modelBefore.x,
    y: modelBefore.y,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp(target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });
  await cdp(target, "Input.insertText", { text: model });
  const beforeSave = await evaluate(
    target,
    `(() => {
      const root = document.querySelector("#local-claude-workbench").shadowRoot;
      const value = { baseUrl: root.querySelector("#base-url").value, model: root.querySelector("#model").value };
      window.__realSettingsReloadMarker = true;
      root.querySelector("#save").click();
      return value;
    })()`,
  );
  const saved = await eventually(
    debuggerPort,
    (activeTarget) =>
      evaluate(
        activeTarget,
        `(async () => {
          const deadline = Date.now() + 20000;
          while ((!window.localClaude || window.__realSettingsReloadMarker) && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 100));
          return window.localClaude.getConfig();
        })()`,
      ),
    30_000,
  );
  assert(
    saved.provider?.baseUrl === baseUrl && saved.provider?.model === model,
    `Provider settings did not persist: ${JSON.stringify({ beforeSave, saved })}`,
  );
  process.stdout.write(
    `${JSON.stringify({ trigger, menuState, opened, endpointTyped, discovered, beforeSave, saved }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ error: String(error), electronOutput: output.join("") }, null, 2)}\n`,
  );
  throw error;
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await rm(profile, { recursive: true, force: true });
}
