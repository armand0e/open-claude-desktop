import { spawn } from "node:child_process";
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

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-real-navigation-"));
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
      CLAUDE_TRACE_LOCAL_UI: "1",
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
        const rect = element => element.getBoundingClientRect().toJSON();
        return {
          path: location.pathname + location.search,
          headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map(element => element.textContent?.trim()).filter(Boolean),
          promptChips: [...document.querySelectorAll("button")].filter(visible).map(button => button.textContent?.trim()).filter(text => /^(Write|Learn|Code|Life stuff|Claude.?s choice)$/i.test(text || "")),
          bodyText: document.body?.innerText?.slice(0, 5000),
          rects: {
            home: rect(home), code: rect(code), menu: rect(menu), sidebar: rect(sidebar),
            search: rect(search), back: rect(back), forward: rect(forward),
            add: add ? rect(add) : null
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
      landing.promptChips.length >= 5 &&
      !landing.bodyText.includes("Local Claude Workbench"),
    `Original native Home landing did not render: ${JSON.stringify(landing)}`,
  );

  let target = await targetAt(debuggerPort);
  await click(target, landing.rects.sidebar);
  const collapsed = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const button = document.querySelector('button[aria-label="Expand sidebar"]');
        return button ? button.getBoundingClientRect().toJSON() : null;
      })()`,
    );
    if (!result) throw new Error("Sidebar did not collapse");
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
  await click(target, landing.rects.search);
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

  target = await targetAt(debuggerPort);
  await click(target, landing.rects.add);
  const addMenu = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `(() => {
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        const labels = [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"], button')]
          .filter(visible).map(element => element.textContent?.replace(/\\s+/g, " ").trim()).filter(Boolean);
        return labels.some(label => /Web search/i.test(label)) ? labels : null;
      })()`,
    );
    if (!result) throw new Error("Attachment menu with Web search did not open");
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
        return {
          path: location.pathname + location.search,
          home: home.getBoundingClientRect().toJSON(),
          codeActive: code.hasAttribute("data-active") || code.getAttribute("aria-current"),
          headings: [...document.querySelectorAll("h1,h2,h3")].map(element => element.textContent?.trim()).filter(Boolean),
          bodyText: document.body?.innerText?.slice(0, 5000)
        };
      })()`,
    );
    if (!result) throw new Error("Native Code landing did not open");
    return result;
  });
  assert(
    /Describe a task|New session|What.s up next|code/i.test(codeLanding.bodyText),
    `Native Code landing content is missing: ${JSON.stringify(codeLanding)}`,
  );

  target = await targetAt(debuggerPort);
  await click(target, codeLanding.home);
  const returnedHome = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `location.pathname.startsWith("/new") ? { path: location.pathname + location.search, back: document.querySelector('button[aria-label="Back"]')?.getBoundingClientRect().toJSON() } : null`,
    );
    if (!result?.back) throw new Error("Home did not reopen from Code");
    return result;
  });

  target = await targetAt(debuggerPort);
  await click(target, returnedHome.back);
  const backed = await eventually(debuggerPort, async (activeTarget) => {
    const result = await evaluate(
      activeTarget,
      `location.pathname.startsWith("/code") || location.pathname.startsWith("/epitaxy") ? { path: location.pathname, forward: document.querySelector('button[aria-label="Forward"]')?.getBoundingClientRect().toJSON() } : null`,
    );
    if (!result?.forward) throw new Error("Back button did not return to Code");
    return result;
  });
  target = await targetAt(debuggerPort);
  await click(target, backed.forward);
  const forwarded = await eventually(debuggerPort, async (activeTarget) => {
    const path = await evaluate(activeTarget, `location.pathname`);
    if (!path.startsWith("/new")) throw new Error("Forward button did not return Home");
    return path;
  });

  target = await targetAt(debuggerPort);
  await click(target, landing.rects.menu);
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
          promptChips: landing.promptChips,
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
