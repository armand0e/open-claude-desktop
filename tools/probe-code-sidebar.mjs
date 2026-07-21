// Probe: the default Code sidebar keeps local sessions in one flat Recents
// list. Native grouping remains available through the sidebar filter menu,
// but no preload shim may force directory/project headers while Group by is
// set to None.
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
      const svc = window["claude.web"]?.LocalSessions;
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
      const wantedTitles = sessions.map(([title]) => title);
      const audit = () => {
        const visible = [...document.querySelectorAll('a, button')]
          .filter(element => element.getClientRects().length > 0)
          .map(element => ({
            element,
            text: (element.textContent || "").replace(/[\uE000-\uF8FF]/gu, "").trim(),
          }));
        const rows = wantedTitles.map(title => {
          const match = visible.find(({ text }) => text === title || text.includes(title));
          return match ? {
            title,
            tag: match.element.tagName,
            left: Math.round(match.element.getBoundingClientRect().left),
          } : null;
        });
        return {
          rows,
          hasForcedTree: Boolean(document.querySelector('[data-testid="local-code-dir-groups"]')),
          nativeRowsHidden: Boolean(document.querySelector('[data-local-hidden-for-groups]')),
          visibleText: document.body.innerText,
        };
      };
      const rowsDeadline = Date.now() + 15000;
      let before = audit();
      while (before.rows.some(row => !row) && Date.now() < rowsDeadline) {
        await new Promise(resolve => setTimeout(resolve, 300));
        before = audit();
      }
      const sessionRow = [...document.querySelectorAll('a, button')].find(element =>
        element.getClientRects().length > 0 &&
        (element.textContent || "").includes(wantedTitles[0])
      );
      sessionRow?.click();
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        created,
        path: location.pathname,
        ...before,
      };
    })()`,
    60_000,
  );
  console.log(JSON.stringify(report, null, 2));
  const rows = report.rows.filter(Boolean);
  if (rows.length !== 3)
    throw new Error(
      `Expected 3 visible native session rows: ${JSON.stringify(report.rows)}`,
    );
  if (
    Math.max(...rows.map((row) => row.left)) -
      Math.min(...rows.map((row) => row.left)) >
    2
  )
    throw new Error(`Session rows are not flat: ${JSON.stringify(rows)}`);
  if (report.hasForcedTree)
    throw new Error("The preload-injected directory tree is still present");
  if (report.nativeRowsHidden)
    throw new Error("Native session rows are still hidden by grouping markup");
  for (const workspace of [path.basename(wsA), path.basename(wsB)])
    if (report.visibleText.includes(workspace))
      throw new Error(
        `Default None grouping exposed a workspace header: ${workspace}`,
      );
  if (!/^\/epitaxy\/[0-9a-f-]{36}$/.test(report.path))
    throw new Error(`Clicking a session did not navigate: ${report.path}`);
  console.log("PROBE PASS: Group by None renders one flat native session list");
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
