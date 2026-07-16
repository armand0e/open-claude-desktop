import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

async function unusedPort() {
  const server = createServer();
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
        if (message.result?.exceptionDetails)
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
      // The debug endpoint is published shortly after startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for an Electron target");
}

const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-launch-profile-"));
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-launch-workspace-"),
);
const sessionId = "launch-probe-session";
await writeFile(
  path.join(workspace, "style.css"),
  "body { background: rgb(24, 46, 68); color: white; }",
  "utf8",
);
await writeFile(
  path.join(workspace, "index.html"),
  '<!doctype html><link rel="stylesheet" href="style.css"><h1 id="selection-target" class="hero proof" data-probe="element-selection">Native Launch preview proof</h1>',
  "utf8",
);
await writeFile(
  path.join(profile, "local-code-sessions.json"),
  JSON.stringify({
    version: 1,
    sessions: [
      {
        sessionId,
        cwd: workspace,
        originCwd: workspace,
        isRunning: false,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        isArchived: false,
        title: "Launch probe",
        homePath: workspace,
        folderExists: true,
        pendingToolPermissions: [],
        permissionMode: "acceptEdits",
        rootDetected: true,
        additionalDirectories: [],
        transcript: [],
        artifacts: [
          {
            title: "Native Launch preview proof",
            url: new URL(
              `file:///${path.join(workspace, "index.html").replaceAll("\\", "/")}`,
            ).toString(),
            path: path.join(workspace, "index.html"),
            updatedAt: new Date().toISOString(),
            version: "launch-probe-version",
          },
        ],
      },
    ],
  }),
  "utf8",
);

const stderr = [];
const child = spawn(
  electron,
  [".", `--remote-debugging-port=${debuggerPort}`],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
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
  const result = await evaluate(
    appTarget,
    `(async () => {
      const deadline = Date.now() + 20000;
      while (!window["claude.web"]?.Launch && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const launch = window["claude.web"].Launch;
      const artifacts = await window["claude.web"].CoworkArtifacts.getAllArtifacts();
      const serverId = await launch.loadClaudePagePreview(
        "/code/artifact/" + artifacts[0].id,
        ${JSON.stringify(workspace)},
        ${JSON.stringify(sessionId)}
      );
      const shown = await launch.showPreview(
        serverId,
        { x: 410, y: 90, width: 650, height: 520 },
        "launch-probe"
      );
      const activeServers = await launch.activeServersStore.getState();
      return { serverId, shown, activeServers, available: launch.isAvailable(), artifactId: artifacts[0].id };
    })()`,
  );
  if (!result?.serverId || result.shown !== true || result.available !== true)
    throw new Error(
      `Launch API failed: ${JSON.stringify(result)}\n${stderr.join("").slice(-4000)}`,
    );
  const previewTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url.startsWith("claude-local-launch://"),
    child,
  );
  const rendered = await evaluate(
    previewTarget,
    `new Promise(resolve => {
      const done = () => resolve({
        url: location.href,
        text: document.body.innerText,
        background: getComputedStyle(document.body).backgroundColor
      });
      if (document.readyState === "complete") done();
      else addEventListener("load", done, { once: true });
    })`,
  );
  const selectionStarted = await evaluate(
    appTarget,
    `(async () => {
      const launch = window["claude.web"].Launch;
      window.__localElementSelection = null;
      window.__localElementSelectionDispose?.();
      window.__localElementSelectionDispose = launch.onElementSelected((serverId, context) => {
        window.__localElementSelection = { serverId, context };
      });
      return launch.toggleSelectionMode(${JSON.stringify(result.serverId)}, true, "default");
    })()`,
  );
  const picker = await evaluate(
    previewTarget,
    `(async () => {
      const deadline = Date.now() + 10000;
      while (!window.__claudeLocalElementPicker && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 50));
      const target = document.querySelector("#selection-target");
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      target.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true, cancelable: true, clientX: x, clientY: y
      }));
      const highlighted = document.querySelector("[data-claude-local-element-picker=overlay]")?.style.display === "block";
      target.dispatchEvent(new MouseEvent("click", {
        bubbles: true, cancelable: true, clientX: x, clientY: y
      }));
      return { active: Boolean(window.__claudeLocalElementPicker), highlighted };
    })()`,
  );
  const selection = await evaluate(
    appTarget,
    `(async () => {
      const deadline = Date.now() + 10000;
      while (!window.__localElementSelection && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 50));
      window.__localElementSelectionDispose?.();
      return window.__localElementSelection;
    })()`,
  );
  const capture = await evaluate(
    appTarget,
    `window["claude.web"].Launch.capturePreviewScreenshot(${JSON.stringify(result.serverId)})`,
  );
  const hidden = await evaluate(
    appTarget,
    `window["claude.web"].Launch.hidePreview(${JSON.stringify(result.serverId)}, "launch-probe")`,
  );
  if (!rendered?.text?.includes("Native Launch preview proof"))
    throw new Error(`Launch HTML did not render: ${JSON.stringify(rendered)}`);
  if (rendered.background !== "rgb(24, 46, 68)")
    throw new Error(
      `Launch relative assets failed: ${JSON.stringify(rendered)}`,
    );
  if (selectionStarted !== true || !picker?.highlighted)
    throw new Error(
      `Element selection did not activate: ${JSON.stringify({ selectionStarted, picker })}`,
    );
  if (
    selection?.serverId !== result.serverId ||
    selection.context?.tagName !== "h1" ||
    selection.context?.id !== "selection-target" ||
    !selection.context?.classes?.includes("hero") ||
    selection.context?.attributes?.["data-probe"] !== "element-selection" ||
    !selection.context?.innerText?.includes("Native Launch preview proof") ||
    !selection.context?.parentPath?.includes("#selection-target") ||
    typeof selection.context?.screenshot !== "string" ||
    selection.context.screenshot.length < 100
  )
    throw new Error(
      `Selected element context was incomplete: ${JSON.stringify(selection)}`,
    );
  if (typeof capture !== "string" || capture.length < 100)
    throw new Error("Launch screenshot did not return a PNG");
  if (hidden !== true) throw new Error("Launch preview did not hide cleanly");
  process.stdout.write(
    `${JSON.stringify(
      {
        ...result,
        rendered,
        selection: {
          tagName: selection.context.tagName,
          id: selection.context.id,
          classes: selection.context.classes,
          selector: selection.context.parentPath,
          screenshotBytes: Math.floor(
            selection.context.screenshot.length * 0.75,
          ),
        },
        captureBytes: Math.floor(capture.length * 0.75),
        hidden,
      },
      null,
      2,
    )}\n`,
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
  await Promise.all(
    [profile, workspace].map((directory) =>
      rm(directory, { recursive: true, force: true }).catch(() => undefined),
    ),
  );
  if (child.exitCode && stderr.length)
    process.stderr.write(stderr.join("").slice(-4000));
}
