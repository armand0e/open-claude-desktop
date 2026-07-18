// Probe: the Connectors surface end to end — /customize/connectors renders
// (no bounce to skills), a custom connector added against a real local
// streamable-HTTP MCP server lists with its connection state, and the
// connector's tool is callable from chat.
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unusedPort() {
  const server = createNetServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function targetsAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP ${response.status}`);
  return response.json();
}

async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    const result = await new Promise((resolve, reject) => {
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ?? "CDP eval failed",
      );
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function evaluateEventually(port, expression, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = (await targetsAt(port)).find(
        (candidate) =>
          candidate.type === "page" &&
          candidate.url.startsWith("app://localhost"),
      );
      if (target?.webSocketDebuggerUrl)
        return await evaluate(target, expression);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("Timed out");
}

// Minimal streamable-HTTP MCP server with one echo tool.
const mcpServer = createHttpServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  let message = {};
  try {
    message = JSON.parse(body);
  } catch {
    // Fall through to 400 below.
  }
  const reply = (result) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  };
  console.error("mcp-server saw:", message.method ?? body.slice(0, 120));
  switch (message.method) {
    case "initialize":
      return reply({
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "probe-mcp", version: "1.0.0" },
      });
    case "notifications/initialized":
      response.writeHead(202).end();
      return;
    case "tools/list":
      return reply({
        tools: [
          {
            name: "echo",
            description: "Echoes text back",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
      });
    case "tools/call":
      return reply({
        content: [
          {
            type: "text",
            text: `echo ${message.params?.arguments?.text ?? ""}`,
          },
        ],
      });
    default:
      response.writeHead(400).end();
  }
});
await new Promise((resolve) => mcpServer.listen(0, "127.0.0.1", resolve));
const mcpUrl = `http://127.0.0.1:${mcpServer.address().port}/`;

const requests = [];
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const parsed = JSON.parse(body);
    requests.push(parsed);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const hasToolResult = parsed.messages.some(
      (message) => message.role === "tool",
    );
    const echoTool = (parsed.tools ?? []).find((tool) =>
      /^mcp__probe[-_]connector__echo$/.test(tool.function?.name ?? ""),
    );
    if (!hasToolResult && !echoTool)
      console.error(
        "tool names in request:",
        (parsed.tools ?? []).map((tool) => tool.function?.name).join(", "),
      );
    if (!hasToolResult && echoTool) {
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_echo",
                    function: {
                      name: echoTool.function.name,
                      arguments: JSON.stringify({ text: "connector-proof" }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
    } else {
      const toolText = parsed.messages
        .filter((message) => message.role === "tool")
        .map((message) => String(message.content))
        .join("\n");
      if (hasToolResult) console.error("tool result content:", toolText.slice(0, 300));
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                content: hasToolResult
                  ? `Connector run complete: ${toolText.slice(0, 60)}`
                  : "TOOL-MISSING",
              },
            },
          ],
        })}\n\n`,
      );
    }
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-connectors-"));
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
      CLAUDE_LOCAL_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      CLAUDE_LOCAL_MODEL: "smoke-model",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const created = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      // Create the connector through the page-facing API first. The raw
      // fetch bypasses the app's mutation cache invalidation, so reach the
      // page with a hard navigation (fresh queries) instead of SPA routing.
      const created = await (await fetch("/api/organizations/local/mcp/remote_servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "probe-connector", url: ${JSON.stringify(mcpUrl)} }),
      })).json();
      setTimeout(() => location.assign("/customize/connectors"), 100);
      return created;
    })()`,
    90_000,
  );
  await new Promise((resolve) => setTimeout(resolve, 8000));
  // The fullscreen /customize surface is retired: navigating there bounces
  // to /new and opens the settings dialog at Customize > Connectors.
  const page = await evaluateEventually(
    debuggerPort,
    `(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')]
        .find(candidate => candidate.getBoundingClientRect().width > 0);
      const text = (dialog?.innerText || "").replace(/\\s+/g, " ");
      return {
        path: location.pathname,
        dialogOpen: Boolean(dialog),
        listsConnector: text.includes("probe-connector"),
        snippet: text.slice(0, 700),
      };
    })()`,
  );
  console.log("page:", JSON.stringify(page, null, 2));
  assert(created?.uuid, "Connector create failed");
  assert(
    page.path === "/new",
    `Retired customize route did not bounce home: ${page.path}`,
  );
  assert(
    page.dialogOpen,
    "Settings dialog did not open for the customize redirect",
  );
  assert(page.listsConnector, "Created connector missing from the dialog");
  // Close the dialog before the chat round trip.
  await evaluateEventually(
    debuggerPort,
    `(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')]
        .find(candidate => candidate.getBoundingClientRect().width > 0);
      const close = dialog?.querySelector('button[aria-label="Close"], button[aria-label="Close settings"]');
      if (close) close.click();
      else document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return true;
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // The connector's tool must reach chat and execute.
  await evaluateEventually(
    debuggerPort,
    `(() => {
      history.pushState(history.state, "", "/new");
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      return true;
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const chat = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const composerDeadline = Date.now() + 20000;
      let editor = null;
      while (Date.now() < composerDeadline) {
        editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
        if (editor) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!editor) return { failed: "no-composer" };
      editor.focus();
      document.execCommand("insertText", false, "use the connector");
      await new Promise(resolve => setTimeout(resolve, 400));
      [...document.querySelectorAll("button")].find(b =>
        /send message/i.test(b.getAttribute("aria-label") || "") && !b.disabled)?.click();
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        const text = document.body?.innerText || "";
        if (text.includes("Connector run complete") || text.includes("TOOL-MISSING")) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      // The completion marker appears mid-stream; wait for the stream to
      // finish rendering before reading the final text.
      const settleDeadline = Date.now() + 15000;
      while (
        (document.body?.innerText || "").includes("Claude is responding") &&
        Date.now() < settleDeadline
      )
        await new Promise(resolve => setTimeout(resolve, 300));
      await new Promise(resolve => setTimeout(resolve, 500));
      const text = document.body?.innerText || "";
      return {
        toolMissing: text.includes("TOOL-MISSING"),
        finalVisible: text.includes("Connector run complete"),
        echoed: /echo:?\\s*connector-proof/.test(text),
        tail: text.slice(-400),
      };
    })()`,
    90_000,
  );
  console.log("chat:", JSON.stringify(chat, null, 2));
  assert(!chat.failed, chat.failed);
  assert(!chat.toolMissing, "Connector tool missing from chat tool list");
  assert(chat.finalVisible, "Chat run did not complete");
  assert(chat.echoed, "Connector tool result did not flow back");

  console.log(
    "PROBE PASS: connectors page renders, lists the connector, and its tool works in chat",
  );
} catch (error) {
  console.error("PROBE FAIL:", error.message);
  console.error(output.join("").slice(-3000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
  mcpServer.close();
}
