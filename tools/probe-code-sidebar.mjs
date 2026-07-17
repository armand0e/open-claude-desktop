// Probe: what does the Code sidebar render for local sessions across
// multiple working directories? Dumps row structure (text, indent, group
// affordances) to design/verify directory grouping.
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

async function evaluateEventually(port, expression, timeout = 40_000) {
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
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Done." } }] })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-code-sidebar-"));
const wsA = await mkdtemp(path.join(os.tmpdir(), "alpha-project-"));
const wsB = await mkdtemp(path.join(os.tmpdir(), "beta-project-"));
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
  const report = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      const svc = window["claude.web"]?.LocalSessions ?? window["claude.web"]?.CoworkSessions;
      const sessions = ${JSON.stringify([
        ["alpha one", "WSA"],
        ["alpha two", "WSA"],
        ["beta one", "WSB"],
      ])};
      const dirs = { WSA: ${JSON.stringify(wsA)}, WSB: ${JSON.stringify(wsB)} };
      const created = [];
      for (const [title, dirKey] of sessions) {
        const started = await svc.start({ cwd: dirs[dirKey], message: "hello from " + title, title });
        created.push(started);
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
      history.pushState(history.state, "", "/epitaxy");
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      await new Promise(resolve => setTimeout(resolve, 3500));
      const carets = [...document.querySelectorAll('button[aria-expanded="false"]')]
        .filter(el => el.getClientRects().length > 0 && !(el.textContent || "").trim());
      let expandedDump = null;
      if (carets.length > 0) {
        carets[0].click();
        await new Promise(resolve => setTimeout(resolve, 800));
        const host = carets[0].closest("div[class*=group], li, div");
        expandedDump = {
          ariaLabel: carets[0].getAttribute("aria-label"),
          hostHtml: host?.outerHTML?.slice(0, 1400) ?? null,
        };
      }
      const rows = [...document.querySelectorAll("aside a, aside button, nav a, nav button, [class*=sidebar] a, [class*=sidebar] button")]
        .filter(el => el.getClientRects().length > 0)
        .map(el => ({
          text: (el.textContent || "").trim().slice(0, 48),
          left: Math.round(el.getBoundingClientRect().left),
          expanded: el.getAttribute("aria-expanded"),
        }))
        .filter(row => row.text);
      return {
        created,
        path: location.pathname,
        rows: rows.slice(0, 40),
        expandedDump,
      };
    })()`,
    60_000,
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error("PROBE FAIL:", error.message);
  console.error(output.join("").slice(-3000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  for (const dir of [profile, wsA, wsB])
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
}
