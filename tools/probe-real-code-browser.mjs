import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

async function unusedPort() {
  const server = createNetServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function targets(port) {
  return fetch(`http://127.0.0.1:${port}/json/list`).then((response) =>
    response.json(),
  );
}

async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    return await new Promise((resolve, reject) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        if (message.error) reject(new Error(message.error.message));
        else if (message.result?.exceptionDetails)
          reject(
            new Error(
              message.result.exceptionDetails.exception?.description ??
                message.result.exceptionDetails.text,
            ),
          );
        else resolve(message.result?.result?.value);
      });
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });
  } finally {
    socket.close();
  }
}

async function waitForTarget(port, predicate, child, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Electron exited early (${child.exitCode})`);
    try {
      const target = (await targets(port)).find(predicate);
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Chromium publishes the endpoint after the app has initialized.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for an Electron target");
}

const site = createHttpServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(
    '<!doctype html><title>Code Browser Probe</title><style>body{background:#17324d;color:white;font:20px system-ui}</style><h1 id="proof">Built-in Code browser proof</h1>',
  );
});
await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
const sitePort = site.address().port;
let providerRequests = 0;
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "code-browser-probe" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    for await (const _chunk of request) {
      // Drain the provider request before responding.
    }
    providerRequests += 1;
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    if (providerRequests === 1) {
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_builtin_browser",
                    function: {
                      name: "mcp__Claude_Browser__tabs_create",
                      arguments: JSON.stringify({
                        url: `http://127.0.0.1:${sitePort}/proof`,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
    } else {
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Browser verified." } }] })}\n\n`,
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
const profile = await mkdtemp(
  path.join(os.tmpdir(), "claude-code-browser-profile-"),
);
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-code-browser-workspace-"),
);
const sessionId = randomUUID();
await writeFile(
  path.join(profile, "local-code-sessions.json"),
  JSON.stringify({
    version: 1,
    sessions: [],
  }),
  "utf8",
);

const stderr = [];
const child = spawn(
  electron,
  [".", `--remote-debugging-port=${debuggerPort}`],
  {
    cwd: process.cwd(),
    windowsHide: false,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      OPEN_CLAUDE_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_LOCAL_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      CLAUDE_LOCAL_MODEL: "code-browser-probe",
    },
  },
);
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

try {
  const appTarget = await waitForTarget(
    debuggerPort,
    (candidate) =>
      candidate.type === "page" &&
      candidate.url.startsWith("app://localhost") &&
      !candidate.url.startsWith("app://localhost/blank"),
    child,
  );
  const ui = await evaluate(
    appTarget,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!window["claude.web"]?.Launch && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const started = await window["claude.web"].LocalSessions.start({
        cwd: ${JSON.stringify(workspace)},
        message: "Open the built-in browser and verify the supplied page.",
        title: "Panel probe",
        permissionMode: "bypassPermissions",
        sessionId: ${JSON.stringify(sessionId)}
      });
      const activeSessionId = started.sessionId;
      const inventoryDeadline = Date.now() + 10000;
      let inventory = [];
      while (Date.now() < inventoryDeadline) {
        inventory = await window["claude.web"].LocalSessions.getAll();
        if (inventory.some(session => session.sessionId === activeSessionId)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      history.pushState(history.state, "", "/epitaxy/" + encodeURIComponent(activeSessionId));
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      const buttonInfo = () => [...document.querySelectorAll("button")].map(button => ({
        label: button.getAttribute("aria-label") || "",
        title: button.getAttribute("title") || "",
        text: (button.textContent || "").trim()
      }));
      const buttonDeadline = Date.now() + 15000;
      let browserButton = null;
      while (!browserButton && Date.now() < buttonDeadline) {
        browserButton = [...document.querySelectorAll("button")].find(button =>
          /browser|preview|browse/i.test(button.getAttribute("aria-label") || "")
        );
        if (!browserButton) await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!browserButton) {
        const bootstrap = await fetch("/api/bootstrap").then(response => response.json()).catch(error => ({ error: String(error) }));
        return {
          opened: false,
          path: location.pathname,
          launchAvailable: await window["claude.web"].Launch.isAvailable?.(),
          launchKeys: Object.keys(window["claude.web"].Launch),
          bootstrapKeys: Object.keys(bootstrap || {}),
          growthbook: bootstrap?.growthbook,
          browserFeature: bootstrap?.growthbook?.features?.["4112513247"],
          session: await window["claude.web"].LocalSessions.getSession(activeSessionId),
          transcript: await window["claude.web"].LocalSessions.getTranscript(activeSessionId),
          servers: await window["claude.web"].Launch.activeServersStore.getState(),
          buttons: buttonInfo()
        };
      }
      if (browserButton.getAttribute("aria-pressed") !== "true") {
        browserButton.click();
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
      const launch = window["claude.web"].Launch;
      const servers = await launch.activeServersStore.getState();
      const browser = servers.find(server => server.name === "Browser" && server.sessionId === activeSessionId);
      if (!browser) return { opened: false, path: location.pathname, buttons: buttonInfo(), text: document.body.innerText.slice(-2000) };
      const initial = await launch.getPreviewTabs(browser.serverId);
      const tabId = await launch.openPreviewTab(browser.serverId, ${JSON.stringify(workspace)});
      await launch.setActivePreviewTab(browser.serverId, tabId);
      const navigated = await launch.navigatePreview(browser.serverId, ${JSON.stringify(`http://127.0.0.1:${sitePort}/proof`)}, tabId);
      return {
        opened: true,
        path: location.pathname,
        browserLabel: browserButton.getAttribute("aria-label") || browserButton.getAttribute("title") || browserButton.textContent,
        browserPressed: browserButton.getAttribute("aria-pressed"),
        serverId: browser.serverId,
        sessionId: activeSessionId,
        initial,
        tabId,
        navigated,
        tabs: await launch.getPreviewTabs(browser.serverId)
      };
    })()`,
  );
  if (!ui?.opened || !ui.serverId || ui.navigated !== true)
    throw new Error(
      `Native browser panel did not open after ${providerRequests} provider requests: ${JSON.stringify(ui)}\n${stderr.join("").slice(-4000)}`,
    );
  const pageTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url === `http://127.0.0.1:${sitePort}/proof`,
    child,
  );
  const rendered = await evaluate(
    pageTarget,
    `({
    title: document.title,
    text: document.body.innerText,
    background: getComputedStyle(document.body).backgroundColor
  })`,
  );
  const captureResult = await evaluate(
    appTarget,
    `(async () => ({
      screenshot: await window["claude.web"].Launch.capturePreviewScreenshot(${JSON.stringify(ui.serverId)}, ${JSON.stringify(ui.tabId)}),
      tabs: await window["claude.web"].Launch.getPreviewTabs(${JSON.stringify(ui.serverId)}),
      nav: await window["claude.web"].Launch.getPreviewNavState(${JSON.stringify(ui.serverId)}, ${JSON.stringify(ui.tabId)}),
      paneText: [...document.querySelectorAll("[data-pane-root]")]
        .map(element => (element.textContent || "").trim())
        .join("\\n")
    }))()`,
  );
  const screenshot = captureResult?.screenshot;
  const closed = await evaluate(
    appTarget,
    `window["claude.web"].Launch.closePreviewTab(${JSON.stringify(ui.serverId)}, ${JSON.stringify(ui.tabId)})`,
  );
  if (!rendered?.text?.includes("Built-in Code browser proof"))
    throw new Error(`Browser page did not render: ${JSON.stringify(rendered)}`);
  if (typeof screenshot !== "string" || screenshot.length < 100)
    throw new Error(
      `Browser screenshot did not return a PNG: ${JSON.stringify({ ui, rendered, captureResult, screenshotLength: screenshot?.length })}\n${stderr.join("").slice(-12000)}`,
    );
  if (captureResult?.paneText?.includes("preview-status"))
    throw new Error("Code Browser mounted the cloud preview pane");
  if (closed !== true) throw new Error("Browser tab did not close");
  process.stdout.write(
    `${JSON.stringify(
      {
        ...ui,
        rendered,
        screenshotBytes: Math.floor(screenshot.length * 0.75),
        closed,
      },
      null,
      2,
    )}\nPROBE PASS: native Code browser opened, navigated, captured, and closed\n`,
  );
} finally {
  child.kill();
  if (child.exitCode === null)
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  await new Promise((resolve) => site.close(resolve));
  await new Promise((resolve) => provider.close(resolve));
  await Promise.all(
    [profile, workspace].map((directory) =>
      rm(directory, { recursive: true, force: true }).catch(() => undefined),
    ),
  );
}
