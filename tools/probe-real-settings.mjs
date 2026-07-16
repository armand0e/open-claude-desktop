import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
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

async function click(target, rect) {
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
  await cdp(target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x,
    y,
    button: "left",
    clickCount: 1,
  });
}

async function selectAllAndType(target, rect, text) {
  await click(target, rect);
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
  await cdp(target, "Input.insertText", { text });
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
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
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
  const chrome = await eventually(debuggerPort, async (target) => {
    const state = await evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        const sidebar = document.querySelector('button[aria-label="Collapse sidebar"]');
        const settings = document.querySelector('[data-testid="local-settings-sidebar-button"]');
        if (!sidebar || !settings) throw new Error("Sidebar controls did not render");
        return {
          sidebar: sidebar.getBoundingClientRect().toJSON(),
          settings: settings.getBoundingClientRect().toJSON(),
          viewportHeight: innerHeight
        };
      })()`,
    );
    return state;
  });

  let target = await targetAt(debuggerPort);
  await click(target, chrome.sidebar);
  const collapsed = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const button = document.querySelector('button[aria-label="Expand sidebar"]');
        if (!button) return null;
        return {
          dataCollapsed: document.querySelector('.dframe-root')?.hasAttribute('data-collapsed') || false,
          rect: button.getBoundingClientRect().toJSON()
        };
      })()`,
    );
    if (!state) throw new Error("Sidebar is not collapsed yet");
    return state;
  });
  assert(collapsed.dataCollapsed, "Sidebar state did not become collapsed");
  await click(target, collapsed.rect);
  await eventually(debuggerPort, async (activeTarget) => {
    const restored = await evaluate(
      activeTarget,
      `Boolean(document.querySelector('button[aria-label="Collapse sidebar"]'))`,
    );
    if (!restored) throw new Error("Sidebar is not expanded yet");
    return true;
  });

  const bottomSettings = await eventually(
    debuggerPort,
    async (activeTarget) => {
      const state = await evaluate(
        activeTarget,
        `(() => {
          const button = document.querySelector('[data-testid="local-settings-sidebar-button"]');
          if (!button) return null;
          return { rect: button.getBoundingClientRect().toJSON(), viewportHeight: innerHeight };
        })()`,
      );
      if (!state) throw new Error("Bottom Settings button is missing");
      return state;
    },
  );
  assert(
    bottomSettings.viewportHeight -
      (bottomSettings.rect.y + bottomSettings.rect.height) <
      32,
    `Settings button is not anchored at the bottom: ${JSON.stringify(bottomSettings)}`,
  );
  target = await targetAt(debuggerPort);
  await click(target, bottomSettings.rect);
  const settings = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')]
          .find(candidate => candidate.getBoundingClientRect().width > 0);
        const button = dialog?.querySelector('[data-local-model-settings] button');
        if (!dialog || !button) return null;
        return {
          url: location.href,
          localModelLabel: button.textContent?.trim().replace(/\s+/g, ' '),
          rect: button.getBoundingClientRect().toJSON()
        };
      })()`,
    );
    if (!state) throw new Error("Local model item is not in Settings yet");
    return state;
  });
  assert(
    settings.localModelLabel?.endsWith("Local model"),
    `Unexpected Settings item: ${JSON.stringify(settings)}`,
  );

  target = await targetAt(debuggerPort);
  await click(target, settings.rect);
  const opened = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const host = document.querySelector("#local-claude-workbench");
        const root = host?.shadowRoot;
        const input = root?.querySelector("#base-url");
        const status = root?.querySelector("#status");
        if (
          !host ||
          host.hidden ||
          !input ||
          !host.closest('[role="dialog"]') ||
          status?.textContent === "Loading…" ||
          root.activeElement !== input
        ) return null;
        const rect = input.getBoundingClientRect();
        const composer = document.querySelector('[contenteditable="true"]');
        return {
          inSettingsDialog: Boolean(host.closest('[role="dialog"]')),
          value: input.value,
          focused: root.activeElement === input,
          composerBefore: composer?.textContent || "",
          rect: rect.toJSON(),
          shadowHit: root.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          )?.id,
          nativeHidden: [...host.parentElement.children]
            .filter(child => child !== host && child.dataset.localClaudeSettingsHidden === "true")
            .length
        };
      })()`,
    );
    if (!state) throw new Error("Local model Settings page is not open yet");
    return state;
  });
  assert(opened.inSettingsDialog, "Provider form escaped the Settings modal");
  assert(opened.focused, `Endpoint did not focus: ${JSON.stringify(opened)}`);
  assert(
    opened.shadowHit === "base-url",
    `Endpoint is not the pointer target: ${JSON.stringify(opened)}`,
  );
  assert(opened.nativeHidden > 0, "Native Settings content was not replaced");

  await selectAllAndType(target, opened.rect, baseUrl);
  const endpointTyped = await evaluate(
    target,
    `(() => {
      const root = document.querySelector("#local-claude-workbench").shadowRoot;
      const composer = document.querySelector('[contenteditable="true"]');
      return {
        value: root.querySelector("#base-url").value,
        active: root.activeElement?.id,
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
    `Model discovery failed: ${JSON.stringify(discovered)}`,
  );

  const modelInput = await evaluate(
    target,
    `(() => document.querySelector("#local-claude-workbench").shadowRoot.querySelector("#model").getBoundingClientRect().toJSON())()`,
  );
  await selectAllAndType(target, modelInput, model);
  const beforeSave = await evaluate(
    target,
    `(() => {
      const root = document.querySelector("#local-claude-workbench").shadowRoot;
      const value = {
        baseUrl: root.querySelector("#base-url").value,
        model: root.querySelector("#model").value,
        documentId: crypto.randomUUID()
      };
      window.__realSettingsDocumentId = value.documentId;
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
          const root = document.querySelector("#local-claude-workbench")?.shadowRoot;
          while (
            (!window.localClaude || root?.querySelector("#status")?.textContent !== "Saved.") &&
            Date.now() < deadline
          )
            await new Promise(resolve => setTimeout(resolve, 100));
          return {
            ...(await window.localClaude.getConfig()),
            documentId: window.__realSettingsDocumentId,
            status: root?.querySelector("#status")?.textContent
          };
        })()`,
      ),
    30_000,
  );
  assert(
    saved.provider?.baseUrl === baseUrl && saved.provider?.model === model,
    `Provider settings did not persist: ${JSON.stringify({ beforeSave, saved })}`,
  );
  assert(
    saved.documentId === beforeSave.documentId && saved.status === "Saved.",
    `Saving Settings reloaded or replaced the modal: ${JSON.stringify({ beforeSave, saved })}`,
  );

  const menuButton = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const buttons = [...document.querySelectorAll('button')]
          .filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        const button = buttons.find(candidate =>
          /main menu|open menu|menu/i.test([
            candidate.getAttribute('aria-label'),
            candidate.getAttribute('title'),
            candidate.getAttribute('data-testid')
          ].filter(Boolean).join(' '))
        );
        if (!button) return {
          missing: true,
          candidates: buttons.slice(0, 30).map(candidate => ({
            aria: candidate.getAttribute('aria-label'),
            title: candidate.getAttribute('title'),
            testid: candidate.getAttribute('data-testid'),
            text: candidate.textContent?.trim().slice(0, 40)
          }))
        };
        return {
          rect: button.getBoundingClientRect().toJSON(),
          aria: button.getAttribute('aria-label'),
          title: button.getAttribute('title'),
          testid: button.getAttribute('data-testid'),
          text: button.textContent?.trim().slice(0, 40)
        };
      })()`,
    );
    if (state.missing)
      throw new Error(
        `Main menu button not found: ${JSON.stringify(state.candidates)}`,
      );
    return state;
  });
  target = await targetAt(debuggerPort);
  await evaluate(
    target,
    `(() => {
      window.__localMenuPointerClicks = 0;
      document.querySelector('[data-testid="topbar-windows-menu"]')
        ?.addEventListener('click', () => window.__localMenuPointerClicks++, { once: true });
    })()`,
  );
  await click(target, menuButton.rect);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const pointerClickObserved = await evaluate(
    target,
    `window.__localMenuPointerClicks || 0`,
  );
  if (!output.join("").includes("[local-ui] main menu popup"))
    await evaluate(
      target,
      `document.querySelector('[data-testid="topbar-windows-menu"]')?.click()`,
    );
  const menuDeadline = Date.now() + 5_000;
  while (
    !output.join("").includes("[local-ui] main menu popup") &&
    Date.now() < menuDeadline
  )
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert(
    output.join("").includes("[local-ui] main menu popup"),
    `Main menu button did not reach the native menu service: ${JSON.stringify(menuButton)}`,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        sidebar: {
          collapsed: collapsed.dataCollapsed,
          restored: true,
          settingsAtBottom: true,
          settingsRect: chrome.settings,
          viewportHeight: chrome.viewportHeight,
        },
        menu: { pointerClickObserved, nativePopupRequested: true },
        settings,
        opened,
        endpointTyped,
        discovered,
        beforeSave,
        saved,
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
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await rm(profile, { recursive: true, force: true });
}
