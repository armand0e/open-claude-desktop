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

async function evaluate(target, expression, timeout = 45_000) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CDP evaluation timed out after ${timeout}ms`));
      }, timeout);
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
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
    '<!doctype html><title>Code Browser Probe</title><style>body{background:#17324d;color:white;font:20px system-ui}</style><h1 id="proof">Built-in Code browser proof</h1><label>Probe input <input id="probe-input"></label><button id="probe-button" onclick="document.body.dataset.clicked=\'yes\'">Activate probe</button><script>console.log("open-claude-browser-probe-ready")</script>',
  );
});
await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve));
const sitePort = site.address().port;
let providerRequests = 0;
const providerBodies = [];
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "code-browser-probe" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    providerBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
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
    } else if (providerRequests >= 2 && providerRequests <= 5) {
      const tabId = [...(providerBodies.at(-1)?.messages ?? [])]
        .reverse()
        .filter((message) => message.role === "tool")
        .map(
          (message) =>
            String(message.content ?? "").match(/"tabId"\s*:\s*"([^"]+)"/)?.[1],
        )
        .find(Boolean);
      if (!tabId) throw new Error("Browser creation result omitted tabId");
      const steps = {
        2: {
          id: "call_builtin_browser_read",
          name: "mcp__Claude_Browser__read_page",
          input: { tabId },
        },
        3: {
          id: "call_builtin_browser_type",
          name: "mcp__Claude_Browser__type",
          input: { tabId, selector: "#probe-input", text: "automation works" },
        },
        4: {
          id: "call_builtin_browser_click",
          name: "mcp__Claude_Browser__click",
          input: { tabId, selector: "#probe-button" },
        },
        5: {
          id: "call_builtin_browser_screenshot",
          name: "mcp__Claude_Browser__screenshot",
          input: { tabId },
        },
      };
      const step = steps[providerRequests];
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: step.id,
                    function: {
                      name: step.name,
                      arguments: JSON.stringify(step.input),
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
const uiPageUrl = `http://127.0.0.1:${sitePort}/proof?ui_probe=${encodeURIComponent(sessionId)}`;
const publicProbeUrl =
  process.env.OPEN_CLAUDE_PUBLIC_BROWSER_URL?.trim() || null;
if (publicProbeUrl && new URL(publicProbeUrl).protocol !== "https:")
  throw new Error("OPEN_CLAUDE_PUBLIC_BROWSER_URL must use HTTPS");
await writeFile(
  path.join(profile, "local-code-sessions.json"),
  JSON.stringify({
    version: 1,
    sessions: [],
  }),
  "utf8",
);

const stderr = [];
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
  const isAppTarget = (candidate) =>
    candidate.type === "page" &&
    candidate.url.startsWith("app://localhost") &&
    !candidate.url.startsWith("app://localhost/blank");
  let appTarget = await waitForTarget(debuggerPort, isAppTarget, child);
  const evaluateApp = async (expression, timeout = 45_000) => {
    const deadline = Date.now() + timeout;
    let lastError;
    while (Date.now() < deadline) {
      appTarget = await waitForTarget(
        debuggerPort,
        isAppTarget,
        child,
        Math.max(1_000, deadline - Date.now()),
      );
      try {
        return await evaluate(
          appTarget,
          expression,
          Math.max(1_000, deadline - Date.now()),
        );
      } catch (error) {
        lastError = error;
        if (
          !/Execution context was destroyed|target closed/iu.test(String(error))
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw lastError ?? new Error("Timed out waiting for a stable app target");
  };

  const started = await evaluateApp(
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!window["claude.web"]?.Launch && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      if (!window["claude.web"]?.Launch)
        throw new Error("Local Launch bridge did not become available");
      const existing = await window["claude.web"].LocalSessions.getSession(${JSON.stringify(sessionId)});
      if (existing) return { sessionId: existing.sessionId };
      return window["claude.web"].LocalSessions.start({
        cwd: ${JSON.stringify(workspace)},
        message: "Open the built-in browser and verify the supplied page.",
        title: "Panel probe",
        permissionMode: "bypassPermissions",
        sessionId: ${JSON.stringify(sessionId)}
      });
    })()`,
    30_000,
  );
  const activeSessionId = started.sessionId;
  const completionDeadline = Date.now() + 30_000;
  let completedSession = null;
  while (Date.now() < completionDeadline) {
    completedSession = await evaluateApp(
      `window["claude.web"].LocalSessions.getSession(${JSON.stringify(activeSessionId)})`,
      5_000,
    );
    if (
      completedSession &&
      completedSession.status !== "running" &&
      completedSession.status !== "queued"
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (
    !completedSession ||
    completedSession.status === "running" ||
    completedSession.status === "queued"
  )
    throw new Error("Code browser session did not finish before the deadline");

  const panel = await evaluateApp(
    `(async () => {
      const activeSessionId = ${JSON.stringify(activeSessionId)};
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
      return {
        opened: true,
        path: location.pathname,
        browserLabel: browserButton.getAttribute("aria-label") || browserButton.getAttribute("title") || browserButton.textContent,
        browserPressed: browserButton.getAttribute("aria-pressed"),
        serverId: browser.serverId,
        sessionId: activeSessionId
      };
    })()`,
  );
  if (!panel?.opened || !panel.serverId)
    throw new Error(
      `Native browser panel did not open after ${providerRequests} provider requests: ${JSON.stringify(panel)}\n${stderr.join("").slice(-4000)}`,
    );

  const tab = await evaluateApp(
    `(async () => {
      const launch = window["claude.web"].Launch;
      const serverId = ${JSON.stringify(panel.serverId)};
      const initial = await launch.getPreviewTabs(serverId);
      const tabId = await launch.openPreviewTab(serverId, ${JSON.stringify(workspace)});
      await launch.setActivePreviewTab(serverId, tabId);
      const navigated = await launch.navigatePreview(serverId, ${JSON.stringify(uiPageUrl)}, tabId);
      return {
        initial,
        tabId,
        navigated,
        tabs: await launch.getPreviewTabs(serverId)
      };
    })()`,
  );
  const ui = { ...panel, ...tab };
  if (!ui?.opened || !ui.serverId || ui.navigated !== true)
    throw new Error(
      `Native browser panel did not open after ${providerRequests} provider requests: ${JSON.stringify(ui)}\n${stderr.join("").slice(-4000)}`,
    );
  const pageTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url === uiPageUrl,
    child,
  );
  const modelPageTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url === `http://127.0.0.1:${sitePort}/proof`,
    child,
  );
  const captureResult = await evaluateApp(
    `(async () => {
      const launch = window["claude.web"].Launch;
      const serverId = ${JSON.stringify(ui.serverId)};
      const tabId = ${JSON.stringify(ui.tabId)};
      const timed = (label, operation) => Promise.race([
        operation,
        new Promise((_, reject) => setTimeout(
          () => reject(new Error(label + " timed out after 30000ms")),
          30000,
        )),
      ]);
      return {
        shown: await timed("showPreview", launch.showPreview(serverId, { x: 80, y: 140, width: 800, height: 600 })),
        viewport: await timed("setPreviewViewport", launch.setPreviewViewport(serverId, 390, 844, tabId)),
        screenshot: await timed("capturePreviewScreenshot", launch.capturePreviewScreenshot(serverId, tabId)),
        logs: await timed("getLogs", launch.getLogs(serverId)),
        colorScheme: await timed("setPreviewColorScheme", launch.setPreviewColorScheme(serverId, "dark", tabId)),
        invalidOrigin: await timed("add invalid origin", launch.addPreviewAllowedOrigin("not-a-url")),
        loopbackOrigin: await timed("add loopback origin", launch.addPreviewAllowedOrigin("http://127.0.0.1")),
        allowedOrigins: await timed("getPreviewAllowedOrigins", launch.getPreviewAllowedOrigins()),
        tabs: await timed("getPreviewTabs", launch.getPreviewTabs(serverId)),
        nav: await timed("getPreviewNavState", launch.getPreviewNavState(serverId, tabId)),
        paneText: [...document.querySelectorAll("[data-pane-root]")]
          .map(element => (element.textContent || "").trim())
          .join("\\n")
      };
    })()`,
    120_000,
  );
  const rendered = await evaluate(
    pageTarget,
    `({
    title: document.title,
    text: document.body.innerText,
    background: getComputedStyle(document.body).backgroundColor,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }
  })`,
  );
  const modelRendered = await evaluate(
    modelPageTarget,
    `({
      inputValue: document.querySelector("#probe-input")?.value,
      clicked: document.body.dataset.clicked,
      jsExecuted: (() => 21 * 2)()
    })`,
  );
  const screenshot = captureResult?.screenshot;
  let publicRendered = null;
  if (publicProbeUrl) {
    const publicNavigated = await evaluateApp(
      `window["claude.web"].Launch.navigatePreview(${JSON.stringify(ui.serverId)}, ${JSON.stringify(publicProbeUrl)}, ${JSON.stringify(ui.tabId)})`,
      30_000,
    );
    if (publicNavigated !== true)
      throw new Error(
        `Public browser navigation was rejected: ${publicProbeUrl}`,
      );
    publicRendered = await evaluate(
      pageTarget,
      `(async () => {
        const deadline = Date.now() + 25000;
        while ((document.readyState !== "complete" || location.href === ${JSON.stringify(uiPageUrl)}) && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        return {
          title: document.title,
          url: location.href,
          text: document.body?.innerText?.slice(0, 1000) || "",
          scriptCount: document.scripts.length,
          jsExecuted: (() => 21 * 2)()
        };
      })()`,
      30_000,
    );
    if (
      !publicRendered?.url?.startsWith("https://") ||
      publicRendered.jsExecuted !== 42
    )
      throw new Error(
        `Public browser page did not render or execute JavaScript: ${JSON.stringify(publicRendered)}`,
      );
  }
  const closed = await evaluateApp(
    `window["claude.web"].Launch.closePreviewTab(${JSON.stringify(ui.serverId)}, ${JSON.stringify(ui.tabId)})`,
  );
  if (!rendered?.text?.includes("Built-in Code browser proof"))
    throw new Error(`Browser page did not render: ${JSON.stringify(rendered)}`);
  if (
    modelRendered.inputValue !== "automation works" ||
    modelRendered.clicked !== "yes" ||
    modelRendered.jsExecuted !== 42
  )
    throw new Error(
      `Model-driven browser interaction did not execute: ${JSON.stringify({ modelRendered, providerBodies: providerBodies.slice(-3) })}`,
    );
  if (typeof screenshot !== "string" || screenshot.length < 100)
    throw new Error(
      `Browser screenshot did not return a PNG: ${JSON.stringify({ ui, rendered, captureResult, screenshotLength: screenshot?.length, providerBodies: providerBodies.slice(-2) })}\n${stderr.join("").slice(-12000)}`,
    );
  const modelScreenshotResult = providerBodies
    .flatMap((body) => body.messages ?? [])
    .find(
      (message) =>
        message.role === "tool" &&
        String(message.content).includes('"mimeType":"image/png"'),
    );
  if (!modelScreenshotResult)
    throw new Error(
      `Model-driven browser screenshot did not return a PNG tool result: ${JSON.stringify(providerBodies.slice(-2))}`,
    );
  if (
    captureResult.shown !== true ||
    captureResult.viewport !== true ||
    captureResult.colorScheme !== true ||
    captureResult.invalidOrigin !== "invalid" ||
    captureResult.loopbackOrigin !== "loopback" ||
    !captureResult.allowedOrigins?.some(
      (entry) => entry.origin === "http://127.0.0.1" && entry.builtin === true,
    )
  )
    throw new Error(
      "Native preview emulation/origin policy did not round-trip",
    );
  if (captureResult?.paneText?.includes("preview-status"))
    throw new Error("Code Browser mounted the cloud preview pane");
  if (closed !== true) throw new Error("Browser tab did not close");
  process.stdout.write(
    `${JSON.stringify(
      {
        ...ui,
        rendered,
        modelRendered,
        screenshotBytes: Math.floor(screenshot.length * 0.75),
        modelScreenshotVerified: true,
        publicRendered,
        closed,
      },
      null,
      2,
    )}\nPROBE PASS: native Code browser opened a second tab, navigated, rendered, captured through both UI and model paths, and closed it\n`,
  );
} catch (error) {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  throw new Error(
    `${message}\nElectron stderr (tail):\n${stderr.join("").slice(-12000)}`,
    { cause: error },
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
