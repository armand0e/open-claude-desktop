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
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  return response.json();
}

async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    const id = 1;
    return await new Promise((resolve, reject) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
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
          id,
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
      // Chromium publishes targets shortly after the debug port binds.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for an Electron target");
}

const port = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-preview-profile-"));
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-preview-workspace-"),
);
const sessionId = "preview-probe-session";
await writeFile(
  path.join(workspace, "style.css"),
  "body { background: rgb(12, 34, 56); color: white; }",
  "utf8",
);
await writeFile(
  path.join(workspace, "index.html"),
  '<!doctype html><link rel="stylesheet" href="style.css"><h1>Native local preview proof</h1>',
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
        model: "local-model",
        effort: "medium",
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        isArchived: false,
        title: "Preview probe",
        homePath: workspace,
        folderExists: true,
        pendingToolPermissions: [],
        permissionMode: "acceptEdits",
        rootDetected: true,
        additionalDirectories: [],
        transcript: [],
        artifacts: [],
      },
    ],
  }),
  "utf8",
);

const stderr = [];
const child = spawn(electron, [".", `--remote-debugging-port=${port}`], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ["ignore", "ignore", "pipe"],
  env: {
    ...process.env,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    CLAUDE_TRACE_CODE_IPC: "1",
  },
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

try {
  const appTarget = await waitForTarget(
    port,
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
    child,
  );
  const shown = await evaluate(
    appTarget,
    `(async () => {
      const deadline = Date.now() + 20000;
      while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      return window["claude.web"].LocalSessions.showSessionFilePreview(
        ${JSON.stringify(sessionId)},
        ${JSON.stringify(path.join(workspace, "index.html"))},
        { x: 420, y: 100, width: 600, height: 500 },
        "preview-probe"
      );
    })()`,
  );
  if (!shown?.ok)
    throw new Error(
      `Preview declined: ${JSON.stringify(shown)}\n${stderr.join("").slice(-4000)}`,
    );
  const previewTarget = await waitForTarget(
    port,
    (candidate) => candidate.url.startsWith("claude-local-preview://"),
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
      if (document.readyState === "complete") done(); else addEventListener("load", done, { once: true });
    })`,
  );
  const capture = await evaluate(
    appTarget,
    `window["claude.web"].CoworkFilePreview.parkAndCapture(
      { x: 430, y: 110, width: 580, height: 480 },
      "preview-probe"
    )`,
  );
  const hidden = await evaluate(
    appTarget,
    `window["claude.web"].CoworkFilePreview.hide("preview-probe")`,
  );
  if (!rendered?.text?.includes("Native local preview proof"))
    throw new Error(`Preview HTML did not render: ${JSON.stringify(rendered)}`);
  if (rendered.background !== "rgb(12, 34, 56)")
    throw new Error(`Relative preview assets failed: ${JSON.stringify(rendered)}`);
  if (typeof capture !== "string" || capture.length < 100)
    throw new Error("Preview capture did not return a PNG");
  if (hidden !== true) throw new Error("Preview did not hide cleanly");
  process.stdout.write(
    `${JSON.stringify(
      {
        shown,
        rendered,
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
