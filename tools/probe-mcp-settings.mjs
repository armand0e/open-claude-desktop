// Proves the native Local MCP servers settings page (Settings > Desktop app >
// Developer) works end to end with a stdio server: the page is reachable, the
// seeded server is listed, and its status badge reaches "running" — which
// requires the app to actually spawn the server and complete an
// initialize + tools/list round trip over stdio.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-mcp-settings-"));

// A minimal MCP server speaking newline-delimited JSON-RPC over stdio.
const serverScript = path.join(profile, "mcp-echo-server.mjs");
await writeFile(
  serverScript,
  `import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
const reply = (id, result) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
rl.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (typeof message.id !== "number") return;
  if (message.method === "initialize")
    reply(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "probe-echo", version: "1.0.0" },
    });
  else if (message.method === "tools/list")
    reply(message.id, {
      tools: [{
        name: "echo",
        description: "Echo back the provided text",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      }],
    });
  else if (message.method === "tools/call")
    reply(message.id, {
      content: [{ type: "text", text: "echo: " + (message.params?.arguments?.text ?? "") }],
    });
  else reply(message.id, {});
});
`,
  "utf8",
);
await writeFile(
  path.join(profile, "claude-local-desktop.json"),
  `${JSON.stringify(
    {
      appConfig: {
        mcpServers: {
          "local-echo": { command: "node", args: [serverScript] },
        },
      },
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const debuggerPort = await unusedPort();
const output = [];
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const child = spawn(
  packagedExecutable ?? electron,
  [
    ...(packagedExecutable ? [] : ["."]),
    `--remote-debugging-port=${debuggerPort}`,
  ],
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
  // Open the Settings dialog from the sidebar.
  const settingsButton = await eventually(debuggerPort, async (target) => {
    const state = await evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        const button = document.querySelector('[data-testid="local-settings-sidebar-button"]');
        if (!button) throw new Error("Settings sidebar button did not render");
        return { rect: button.getBoundingClientRect().toJSON() };
      })()`,
    );
    return state;
  });
  let target = await targetAt(debuggerPort);
  await click(target, settingsButton.rect);

  // The Desktop app group must expose the Developer section.
  const developer = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')]
          .find(candidate => candidate.getBoundingClientRect().width > 0);
        if (!dialog) return null;
        const buttons = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
          .filter(button => button.getClientRects().length > 0);
        const labels = buttons.map(button =>
          button.querySelector('.truncate')?.textContent?.trim() || button.textContent?.trim());
        const developerButton = buttons[labels.indexOf("Developer")];
        if (!developerButton) return { labels, missing: true };
        return { labels, rect: developerButton.getBoundingClientRect().toJSON() };
      })()`,
    );
    if (!state) throw new Error("Settings dialog did not open");
    if (state.missing)
      throw new Error(
        `Developer section is not in Settings: ${JSON.stringify(state.labels)}`,
      );
    return state;
  });
  assert(
    developer.labels.includes("Extensions"),
    `Extensions section is missing from Settings: ${JSON.stringify(developer.labels)}`,
  );
  target = await targetAt(debuggerPort);
  await click(target, developer.rect);

  // The Local MCP servers page lists the seeded stdio server and its status
  // badge reaches "running" once the spawn + initialize + tools/list round
  // trip completes.
  const page = await eventually(
    debuggerPort,
    async (activeTarget) => {
      const state = await evaluate(
        activeTarget,
        `(() => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')]
            .find(candidate => candidate.getBoundingClientRect().width > 0);
          if (!dialog) return null;
          const text = dialog.innerText || "";
          if (!text.includes("Local MCP servers")) return null;
          const row = dialog.querySelector('[data-config-key="local-echo"]');
          if (!row) return { pageText: text.slice(0, 1500), noRow: true };
          row.click();
          const badge = [...dialog.querySelectorAll("h2")]
            .find(header => header.textContent?.trim() === "local-echo")
            ?.parentElement?.querySelector("div");
          return {
            listed: true,
            status: badge?.textContent?.trim() ?? null,
            pageText: text.slice(0, 1500),
          };
        })()`,
      );
      if (!state) throw new Error("Local MCP servers page did not render");
      if (state.noRow)
        throw new Error(`Seeded server is not listed: ${state.pageText}`);
      if (state.status !== "running")
        throw new Error(
          `Server status is "${state.status}", waiting for "running": ${state.pageText}`,
        );
      return state;
    },
    45_000,
  );
  assert(page.listed && page.status === "running", "MCP server did not run");

  // The Customize > Connectors section lists the same stdio server as a
  // connected "Desktop · Local dev" row (the renderer's own MCP client over
  // the MessagePort bridge).
  const connectors = await eventually(
    debuggerPort,
    async (activeTarget) => {
      const state = await evaluate(
        activeTarget,
        `(async () => {
          const dialog = [...document.querySelectorAll('[role="dialog"]')]
            .find(candidate => candidate.getBoundingClientRect().width > 0);
          if (!dialog) return null;
          const buttons = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
            .filter(button => button.getClientRects().length > 0);
          const target = buttons.filter(button =>
            (button.querySelector('.truncate')?.textContent?.trim() || button.textContent?.trim()) === "Connectors").pop();
          if (!target) return { missingNav: true };
          target.click();
          await new Promise(resolve => setTimeout(resolve, 1200));
          const text = dialog.innerText.replace(/\\s+/g, " ");
          return {
            hasRow: /local-echo/.test(text),
            hasLocalDev: /Local dev/.test(text),
            hasConnected: /Connected/.test(text),
            text: text.slice(0, 900),
          };
        })()`,
      );
      if (!state) throw new Error("Settings dialog disappeared");
      if (state.missingNav)
        throw new Error("Customize > Connectors nav item is missing");
      if (!state.hasRow || !state.hasLocalDev)
        throw new Error(
          `Stdio server is not a Local dev connector row: ${state.text}`,
        );
      return state;
    },
    30_000,
  );
  assert(
    connectors.hasConnected,
    `Connector row is not marked connected: ${connectors.text}`,
  );

  // Capabilities is a native settings-nav entry now
  // (add-capabilities-settings-nav-entry patch): it opens inside the
  // settings modal like every other section — no fullscreen page.
  const capabilities = await eventually(debuggerPort, async (activeTarget) => {
    const state = await evaluate(
      activeTarget,
      `(async () => {
        const strip = s => (s || "").replace(/[\\uE000-\\uF8FF]/gu, "").trim();
        const button = [...document.querySelectorAll('[role=dialog] button, [role=dialog] a')]
          .find(el => el.getClientRects().length > 0 && strip(el.textContent) === "Capabilities");
        if (!button) return { missing: true };
        button.click();
        await new Promise(resolve => setTimeout(resolve, 1800));
        const dialog = document.querySelector('[role="dialog"]');
        return {
          url: location.pathname,
          inDialog: !!dialog,
          text: (dialog ? dialog.innerText : document.body.innerText).replace(/\\s+/g, " ").slice(0, 900),
        };
      })()`,
    );
    if (state.missing)
      throw new Error(
        "Capabilities nav item was not found in the settings modal",
      );
    return state;
  });
  assert(
    capabilities.inDialog &&
      capabilities.url !== "/settings/capabilities" &&
      /Visuals/.test(capabilities.text) &&
      /Artifacts/.test(capabilities.text),
    `Capabilities did not render inside the settings modal: ${JSON.stringify(capabilities)}`,
  );

  console.log(
    JSON.stringify(
      {
        settingsLabels: developer.labels,
        serverStatus: page.status,
      },
      null,
      2,
    ),
  );
  console.log("PROBE OK: mcp-settings");
} catch (error) {
  console.error(error);
  console.error(output.join("").slice(-4_000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
