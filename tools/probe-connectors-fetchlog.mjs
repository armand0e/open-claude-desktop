// Diagnostic: which MCP-related API calls does the connectors page make,
// and what do they return?
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

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

class Cdp {
  #socket;
  #nextId = 1;
  #pending = new Map();
  static async connect(url) {
    const cdp = new Cdp();
    cdp.#socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      cdp.#socket.addEventListener("open", resolve, { once: true });
      cdp.#socket.addEventListener("error", reject, { once: true });
    });
    cdp.#socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.#pending.has(message.id)) {
        const { resolve, reject } = cdp.#pending.get(message.id);
        cdp.#pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
    return cdp;
  }
  send(method, params = {}) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.#socket.close();
  }
}

const mcpServer = createHttpServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  let message = {};
  try {
    message = JSON.parse(body);
  } catch {
    // 400 below
  }
  const reply = (result) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  };
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
    default:
      response.writeHead(400).end();
  }
});
await new Promise((resolve) => mcpServer.listen(0, "127.0.0.1", resolve));
const mcpUrl = `http://127.0.0.1:${mcpServer.address().port}/`;

const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-conn-fetch-"));
const output = [];
const child = spawn(electron, [".", `--remote-debugging-port=${debuggerPort}`], {
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
});
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

const fetchLogScript = `(() => {
  const push = (entry) => {
    try {
      const log = JSON.parse(sessionStorage.getItem("__fetchlog") || "[]");
      log.push(entry);
      sessionStorage.setItem("__fetchlog", JSON.stringify(log));
    } catch {}
  };
  const original = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : (input?.url ?? String(input));
    const interesting = /mcp|remote_server/i.test(url);
    try {
      const response = await original.apply(this, arguments);
      if (interesting) {
        let body = "";
        try { body = (await response.clone().text()).slice(0, 500); } catch {}
        push({ url, status: response.status, body });
      }
      return response;
    } catch (error) {
      if (interesting) push({ url, error: String(error) });
      throw error;
    }
  };
})();`;

try {
  const deadline = Date.now() + 60_000;
  let target;
  while (Date.now() < deadline && !target) {
    try {
      target = (await targetsAt(debuggerPort)).find(
        (candidate) =>
          candidate.type === "page" &&
          candidate.url.startsWith("app://localhost"),
      );
    } catch {
      // retry
    }
    if (!target) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!target) throw new Error("no app page target");
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: fetchLogScript,
  });
  await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const deadline = Date.now() + 30000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      await (await fetch("/api/organizations/local/mcp/remote_servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "probe-connector", url: ${JSON.stringify(mcpUrl)} }),
      })).json();
    })()`,
    awaitPromise: true,
  });
  await cdp.send("Runtime.evaluate", {
    expression: `setTimeout(() => location.assign("/customize/connectors"), 50)`,
  });
  await new Promise((resolve) => setTimeout(resolve, 12_000));
  const fresh = (await targetsAt(debuggerPort)).find(
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
  );
  const cdp2 = await Cdp.connect(fresh.webSocketDebuggerUrl);
  const result = await cdp2.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      path: location.pathname,
      listsConnector: (document.body?.innerText || "").includes("probe-connector"),
      fetchlog: JSON.parse(sessionStorage.getItem("__fetchlog") || "null"),
    }, null, 1)`,
    returnByValue: true,
  });
  console.log(result.result?.value);
  cdp.close();
  cdp2.close();
} catch (error) {
  console.error("DIAG FAIL:", error.message);
  console.error(output.join("").slice(-2500));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
  mcpServer.close();
}
