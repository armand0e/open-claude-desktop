// Diagnostic: record every history mutation (with stacks) during a hard
// navigation to a customize page (argv[2]) to find what redirects away.
const diagPath = process.argv[2] ?? "/customize/connectors";
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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-conn-nav-"));
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

const navlogScript = `(() => {
  const read = () => {
    try { return JSON.parse(sessionStorage.getItem("__navpersist") || "[]"); }
    catch { return []; }
  };
  const push = (entry) => {
    const log = read();
    log.push(entry);
    try { sessionStorage.setItem("__navpersist", JSON.stringify(log)); } catch {}
  };
  push({ kind: "doc-start", url: location.pathname + location.hash });
  const wrap = (kind) => {
    const original = History.prototype[kind];
    History.prototype[kind] = function (...args) {
      push({
        kind,
        url: String(args[2] ?? ""),
        at: location.pathname + location.hash,
        stack: (new Error().stack || "").split("\\n").slice(2, 8).join(" | "),
      });
      return original.apply(this, args);
    };
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("beforeunload", () =>
    push({ kind: "doc-unload", url: location.pathname + location.hash }),
  );
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
    source: navlogScript,
  });
  // Wait for app ready, then hard-navigate.
  await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      const deadline = Date.now() + 30000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
    })()`,
    awaitPromise: true,
  });
  await cdp.send("Runtime.evaluate", {
    expression: `setTimeout(() => location.assign(${JSON.stringify(diagPath)}), 50)`,
  });
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  // The document was replaced; reconnect to the (same) target.
  const fresh = (await targetsAt(debuggerPort)).find(
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
  );
  const cdp2 = await Cdp.connect(fresh.webSocketDebuggerUrl);
  const result = await cdp2.send("Runtime.evaluate", {
    expression: `JSON.stringify({ path: location.pathname + location.hash, log: JSON.parse(sessionStorage.getItem("__navpersist") || "null") }, null, 1)`,
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
}
