// Diagnostic: is the served c6eedc03a chunk patched, and what happens on a
// hard navigation to a customize page? (path via argv[2], default connectors)
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

async function evaluateEventually(port, expression, timeout = 60_000) {
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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-conn-diag-"));
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

try {
  const served = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      const text = await (await fetch("/assets/v1/c6eedc03a-CsEFTfjy.js")).text();
      window.__diagErrors = [];
      return {
        featurePatch: text.includes("const nqe=()=>!0"),
        listPatch: text.includes("remote_servers\`,{custom3pCompatible:!0"),
        connectionPatch: text.includes("remote_servers_with_connection\`,{custom3pCompatible:!0"),
        length: text.length,
      };
    })()`,
    90_000,
  );
  console.log("served chunk:", JSON.stringify(served));

  // Hard navigation — the target document is replaced, so this evaluation
  // must not await anything after assign.
  await evaluateEventually(
    debuggerPort,
    `(() => { setTimeout(() => location.assign(${JSON.stringify(diagPath)}), 50); return true; })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 8000));
  const landed = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const mod = await import("/assets/v1/c6eedc03a-CsEFTfjy.js");
      const gates = {};
      for (const name of [
        "papi_mcp",
        "papi_disable_mcp_ui",
        "claudeai_customize_memory_tab_main",
        "claudeai_skills_claude_code_access",
        "claude_ai_plugins_in_chat",
      ])
        gates[name] = mod.v9(name);
      const text = (document.body?.innerText || "").replace(/\\s+/g, " ");
      return { path: location.pathname, gates, snippet: text.slice(0, 300) };
    })()`,
  );
  console.log("landed:", JSON.stringify(landed, null, 2));
} catch (error) {
  console.error("DIAG FAIL:", error.message);
  console.error(output.join("").slice(-3000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
}
