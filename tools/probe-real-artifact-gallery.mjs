import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
      socket.addEventListener(
        "close",
        () => reject(new Error("CDP target closed before evaluation completed")),
        { once: true },
      );
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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-gallery-profile-"));
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-gallery-workspace-"),
);
const sessionId = "artifact-gallery-session";
const title = "Native local artifact gallery proof";
const artifactPath = path.join(workspace, "gallery-proof.html");
const content =
  '<!doctype html><style>body{background:rgb(31,53,75);color:white}</style><h1>Native artifact opened locally</h1>';
await writeFile(artifactPath, content, "utf8");
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
        title: "Artifact gallery session",
        homePath: workspace,
        folderExists: true,
        pendingToolPermissions: [],
        permissionMode: "acceptEdits",
        rootDetected: true,
        additionalDirectories: [],
        transcript: [],
        artifacts: [
          {
            title,
            url: pathToFileURL(artifactPath).toString(),
            path: artifactPath,
            updatedAt: new Date().toISOString(),
            version: "probe-version",
          },
        ],
      },
    ],
  }),
  "utf8",
);

const stderr = [];
const keepAlive = setInterval(() => {}, 1_000);
const child = spawn(electron, [".", `--remote-debugging-port=${debuggerPort}`], {
  cwd: process.cwd(),
  windowsHide: true,
  stdio: ["ignore", "ignore", "pipe"],
  env: {
    ...process.env,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
  },
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

try {
  process.stderr.write("artifact-gallery-probe: waiting for app\n");
  let appTarget = await waitForTarget(
    debuggerPort,
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
    child,
  );
  process.stderr.write("artifact-gallery-probe: app ready\n");
  await evaluate(
    appTarget,
    `(() => {
      const code = [...document.querySelectorAll("button")].find(button =>
        button.getAttribute("aria-label") === "Code" || button.textContent?.trim() === "Code"
      );
      code?.click();
      return Boolean(code);
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  await evaluate(
    appTarget,
    `(() => {
      const artifacts = [...document.querySelectorAll("button")].find(button =>
        button.getAttribute("aria-label") === "Artifacts" || button.textContent?.trim() === "Artifacts"
      );
      artifacts?.click();
      return Boolean(artifacts);
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  appTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url === "app://localhost/epitaxy/apps",
    child,
  );
  process.stderr.write("artifact-gallery-probe: gallery route ready\n");
  await new Promise((resolve) => setTimeout(resolve, 8_000));
  const gallery = await evaluate(
    appTarget,
    `(async () => {
      const frames = await fetch("/api/frame/frames?thumb=1&limit=60&org=00000000-0000-4000-8000-000000000001").then(response => response.json());
      const frame = frames.frames?.[0];
      return {
        nativePage: location.pathname === "/epitaxy/apps",
        titleVisible: document.body?.innerText?.includes(${JSON.stringify(title)}),
        bodyText: document.body?.innerText?.slice(0, 2500),
        frame,
        customOverlayPresent: Boolean(document.querySelector("#local-code-artifacts"))
      };
    })()`,
  );
  process.stderr.write(`artifact-gallery-probe: evaluated ${JSON.stringify(gallery)}\n`);
  if (!gallery.nativePage || !gallery.titleVisible || gallery.customOverlayPresent)
    throw new Error(
      `Native gallery failed: ${JSON.stringify(gallery)}\n${stderr.join("").slice(-6000)}`,
    );
  process.stderr.write("artifact-gallery-probe: assertions passed\n");
  process.stdout.write(
    `${JSON.stringify({ gallery }, null, 2)}\n`,
  );
} finally {
  clearInterval(keepAlive);
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
    process.stderr.write(stderr.join("").slice(-6000));
}
