// Audit crawl: visit every major route in the live app and record failed
// API calls (4xx/5xx), console errors, and unhandled rejections, so gaps
// between what the UI advertises and what the local backend serves are
// found empirically instead of by guesswork.
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const ROUTES =
  process.argv[2] === "scheduled"
    ? ["/epitaxy", "/epitaxy/scheduled"]
    : [
        "/new",
        "/recents",
        "/projects",
        "/artifacts",
        "/customize",
        "/customize/skills",
        "/customize/memory",
        "/customize/styles",
        "/epitaxy",
        "/epitaxy/scheduled",
        "/epitaxy/apps",
        "/settings/profile",
        "/settings/appearance",
        "/settings/capabilities",
        "/settings/account",
        "/settings/data-privacy-controls",
      ];

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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-route-audit-"));
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
      CLAUDE_TRACE_CAPABILITY_IPC: "1",
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
      window.__audit = { failed: [], errors: [] };
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input?.url || "";
        return original(input, init).then(response => {
          if (response.status >= 400 && !url.includes("datadoghq"))
            window.__audit.failed.push(\`\${response.status} \${(init?.method || "GET")} \${url.slice(0, 110)} @\${location.pathname}\`);
          return response;
        }, error => {
          if (!url.includes("datadoghq"))
            window.__audit.errors.push(\`fetch-reject \${url.slice(0, 90)}: \${error}\`.slice(0, 160));
          throw error;
        });
      };
      const originalError = console.error.bind(console);
      console.error = (...args) => {
        const line = args.map(String).join(" ");
        if (!/datadog|ResizeObserver|Download the React DevTools/i.test(line))
          window.__audit.errors.push((location.pathname + " | " + line).slice(0, 220));
        originalError(...args);
      };
      window.addEventListener("unhandledrejection", event => {
        window.__audit.errors.push((location.pathname + " | unhandled: " + event.reason).slice(0, 220));
      });
      const routes = ${JSON.stringify(ROUTES)};
      const visited = [];
      for (const route of routes) {
        history.pushState(history.state, "", route);
        window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
        await new Promise(resolve => setTimeout(resolve, 2600));
        const shadowText = [...document.querySelectorAll("*")]
          .map(el => el.shadowRoot?.querySelector("main,section:not([hidden])")?.textContent || "")
          .join(" ");
        const text = ((document.body?.innerText || "") + " " + shadowText).replace(/\\s+/g, " ");
        const dialogs = [...document.querySelectorAll('[role="dialog"]')]
          .filter(element => {
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map(element => (element.innerText || element.textContent || "").replace(/\\s+/g, " ").slice(0, 220));
        const headings = [...document.querySelectorAll("h1,h2,h3")]
          .map(element => (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 12);
        visited.push({
          route,
          landed: location.pathname,
          empty: text.length < 200,
          notFound: /not found|nothing here|went wrong|error occurred/i.test(text),
          snippet: text.slice(0, 180),
          dialogs,
          headings,
        });
      }
      return { visited, failed: window.__audit.failed, errors: window.__audit.errors.slice(0, 40) };
    })()`,
    140_000,
  );
  const capabilityCalls = output
    .join("")
    .split(/\r?\n/)
    .flatMap((line) => {
      const marker = line.indexOf("[capability-ipc] ");
      if (marker === -1) return [];
      try {
        return [JSON.parse(line.slice(marker + "[capability-ipc] ".length))];
      } catch {
        return [];
      }
    });
  const uniqueCapabilities = [
    ...new Map(
      capabilityCalls.map((call) => [
        `${call.service}.${call.method}.${call.resultShape}`,
        call,
      ]),
    ).values(),
  ].sort((left, right) =>
    `${left.service}.${left.method}`.localeCompare(
      `${right.service}.${right.method}`,
    ),
  );
  const expectedCompatibilityCalls = new Set([
    "claude.settings.Custom3pSetup.bootstrapState_$store$_getState",
    "claude.settings.Custom3pSetup.getConfigHealth",
    "claude.settings.Custom3pSetup.getLoginDesktop3pStatus",
    "claude.settings.SupportBundle.supportBundleState_$store$_getState",
    "claude.settings.WakeScheduler.getStatus",
    "claude.web.Account.setAccountDetails",
    "claude.web.ComputerUseTcc.getState",
    "claude.web.GrandPrix.grandPrixStatus_$store$_getState",
    "claude.web.QuickEntry.setRecentChats",
    "claude.web.WebBuild.reportCommitHash",
  ]);
  const compatibilityCalls = uniqueCapabilities.filter(
    (call) => call.compatibilityOnly,
  );
  const unexpectedCompatibilityCalls = compatibilityCalls.filter(
    (call) => !expectedCompatibilityCalls.has(`${call.service}.${call.method}`),
  );
  if (unexpectedCompatibilityCalls.length > 0)
    throw new Error(
      `Visible routes invoked unreviewed compatibility behavior: ${JSON.stringify(unexpectedCompatibilityCalls)}`,
    );
  if (report.failed.length > 0 || report.errors.length > 0)
    throw new Error(
      `Route audit failed: ${JSON.stringify({ failed: report.failed, errors: report.errors })}`,
    );
  console.log(
    JSON.stringify(
      {
        ...report,
        capabilityCalls: uniqueCapabilities,
        compatibilityCalls,
        unexpectedCompatibilityCalls,
      },
      null,
      2,
    ),
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
}
