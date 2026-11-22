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
        () =>
          reject(new Error("CDP target closed before evaluation completed")),
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
const profile = await mkdtemp(
  path.join(os.tmpdir(), "claude-gallery-profile-"),
);
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-gallery-workspace-"),
);
const sessionId = "artifact-gallery-session";
const title = "Native local artifact gallery proof";
const chatSessionId = "old-chat-artifact-session";
const chatArtifactId = "old-chat-artifact-proof";
const chatArtifactUuid = "00000000-0000-4000-8000-000000000501";
const chatVersionUuid = "00000000-0000-4000-8000-000000000502";
const chatHumanUuid = "00000000-0000-4000-8000-000000000503";
const chatAssistantUuid = "00000000-0000-4000-8000-000000000504";
const chatTitle = "Old Chat Artifact Reopen Proof";
const artifactPath = path.join(workspace, "gallery-proof.html");
const content =
  "<!doctype html><style>body{background:rgb(31,53,75);color:white}</style><h1>Native artifact opened locally</h1>";
const chatContent =
  "<!doctype html><style>body{background:#261b36;color:white}</style><h1>Old chat artifact reopened without a page reload</h1>";
const now = new Date().toISOString();
await writeFile(artifactPath, content, "utf8");
await writeFile(
  path.join(profile, "local-backend.json"),
  JSON.stringify({
    version: 3,
    provider: {
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "gallery-probe-model",
    },
    accountProfile: {},
    accountSettings: {},
    files: [],
    conversations: [
      {
        uuid: chatSessionId,
        name: "Historical artifact chat",
        summary: "",
        model: "gallery-probe-model",
        created_at: now,
        updated_at: now,
        current_leaf_message_uuid: chatAssistantUuid,
        is_starred: false,
        is_temporary: false,
        settings: { enabled_web_search: false },
        chat_messages: [
          {
            uuid: chatHumanUuid,
            sender: "human",
            text: "Create the historical artifact",
            content: [
              {
                type: "text",
                text: "Create the historical artifact",
                citations: [],
              },
            ],
            created_at: now,
            updated_at: now,
            index: 0,
            attachments: [],
            files: [],
          },
          {
            uuid: chatAssistantUuid,
            sender: "assistant",
            text: "",
            content: [
              {
                type: "tool_use",
                id: "call_old_chat_artifact",
                name: "artifacts",
                input: {
                  command: "create",
                  id: chatArtifactId,
                  title: chatTitle,
                  type: "text/html",
                  content: chatContent,
                },
              },
            ],
            created_at: now,
            updated_at: now,
            index: 1,
            parent_message_uuid: chatHumanUuid,
            attachments: [],
            files: [],
          },
        ],
      },
    ],
    artifacts: [
      {
        uuid: chatArtifactUuid,
        artifact_identifier: chatArtifactId,
        conversation_uuid: chatSessionId,
        created_at: now,
        updated_at: now,
        title: chatTitle,
        artifact_type: "text/html",
        versions: [
          {
            uuid: chatVersionUuid,
            artifact_uuid: chatArtifactUuid,
            artifact_identifier: chatArtifactId,
            conversation_uuid: chatSessionId,
            message_uuid: chatAssistantUuid,
            created_at: now,
            updated_at: now,
            title: chatTitle,
            artifact_type: "text/html",
            content: chatContent,
            command: "create",
            visibility: "private",
            published_artifact_uuid: null,
            published_artifact_deleted_at: null,
          },
        ],
      },
    ],
  }),
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
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    },
  },
);
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
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const codeClick = await evaluate(
    appTarget,
    `(() => {
      const candidates = [...document.querySelectorAll("button")].filter(button => button.textContent?.trim() === "Code");
      const code = document.querySelector('button[data-mode="code"]') || candidates.find(button => button.closest(".df-pills")) || candidates[0];
      code?.click();
      return { clicked: Boolean(code), count: candidates.length, html: code?.outerHTML?.slice(0, 1000), path: location.pathname };
    })()`,
  );
  process.stderr.write(
    `artifact-gallery-probe: code click ${JSON.stringify(codeClick)}\n`,
  );
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  const artifactClick = await evaluate(
    appTarget,
    `(() => {
      const labels = [...document.querySelectorAll("[aria-label],.truncate,span")].filter(control =>
        control.getAttribute("aria-label") === "Artifacts" || control.textContent?.trim() === "Artifacts"
      );
      const candidates = labels.map(label => label.closest("button,a,[role=button]") || label);
      const artifacts = candidates.find(control => !control.hasAttribute("data-local-artifacts-button"));
      artifacts?.click();
      return { clicked: Boolean(artifacts), count: new Set(candidates).size, tags: candidates.map(control => control.tagName), html: artifacts?.outerHTML?.slice(0, 1200), path: location.pathname };
    })()`,
  );
  process.stderr.write(
    `artifact-gallery-probe: click ${JSON.stringify(artifactClick)}\n`,
  );
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const routeAfterClick = await evaluate(
    appTarget,
    `({ path: location.pathname, href: location.href, body: document.body?.innerText?.slice(0, 1200) })`,
  );
  if (routeAfterClick.path !== "/epitaxy/apps")
    throw new Error(
      `Artifacts control did not navigate: ${JSON.stringify({ artifactClick, routeAfterClick })}`,
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
        chatTitleVisible: document.body?.innerText?.includes(${JSON.stringify(chatTitle)}),
        bodyText: document.body?.innerText?.slice(0, 2500),
        frame,
        customOverlayPresent: Boolean(document.querySelector("#local-code-artifacts"))
      };
    })()`,
  );
  process.stderr.write(
    `artifact-gallery-probe: evaluated ${JSON.stringify(gallery)}\n`,
  );
  if (
    !gallery.nativePage ||
    !gallery.titleVisible ||
    !gallery.chatTitleVisible ||
    gallery.customOverlayPresent
  )
    throw new Error(
      `Native gallery failed: ${JSON.stringify(gallery)}\n${stderr.join("").slice(-6000)}`,
    );
  const chatCardClick = await evaluate(
    appTarget,
    `(() => {
      const stateSentinel = crypto.randomUUID();
      window.__oldChatArtifactSentinel = stateSentinel;
      const labels = [...document.querySelectorAll("*")].filter(element =>
        element.innerText?.trim() === ${JSON.stringify(chatTitle)}
      );
      const expectedPath = ${JSON.stringify(`/chat/${chatSessionId}`)};
      const control = [...document.querySelectorAll("a[href],button,[role=button]")].find(element => {
        const href = element instanceof HTMLAnchorElement ? new URL(element.href, location.href) : null;
        return href?.pathname === expectedPath ||
          element.getAttribute("aria-label") === ${JSON.stringify(chatTitle)} ||
          element.innerText?.trim() === ${JSON.stringify(chatTitle)};
      });
      control?.click();
      return {
        clicked: Boolean(control),
        stateSentinel,
        matches: labels.length,
        tag: control?.tagName,
        href: control instanceof HTMLAnchorElement ? control.href : null
      };
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  const chatOpened = await evaluate(
    appTarget,
    `(() => {
      const frame = document.querySelector('iframe[src^="app://artifacts.local"]');
      const rect = frame?.getBoundingClientRect();
      return {
        path: location.pathname,
        href: location.href,
        artifactId: new URL(location.href).searchParams.get("artifactId"),
        frameVisible: Boolean(frame && rect.width > 0 && rect.height > 0 && getComputedStyle(frame).visibility !== "hidden"),
        keptDocumentState: window.__oldChatArtifactSentinel === ${JSON.stringify(chatCardClick.stateSentinel)},
        bodyText: document.body?.innerText?.slice(0, 2500)
      };
    })()`,
  );
  if (
    !chatCardClick.clicked ||
    chatOpened.path !== `/chat/${chatSessionId}` ||
    chatOpened.artifactId !== chatArtifactId ||
    !chatOpened.frameVisible ||
    !chatOpened.keptDocumentState
  )
    throw new Error(
      `Old Chat artifact did not hydrate in the existing document: ${JSON.stringify({ chatCardClick, chatOpened })}`,
    );
  await evaluate(appTarget, "history.back(); true");
  const galleryDeadline = Date.now() + 8_000;
  while (Date.now() < galleryDeadline) {
    const pathNow = await evaluate(appTarget, "location.pathname");
    if (pathNow === "/epitaxy/apps") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  process.stderr.write(
    "artifact-gallery-probe: old Chat artifact reopened without reload\n",
  );
  const cardClick = await evaluate(
    appTarget,
    `(() => {
      const labels = [...document.querySelectorAll("*")].filter(element =>
        element.innerText?.trim() === ${JSON.stringify(title)}
      );
      const label = labels[0];
      const control = document.querySelector('a[aria-label=${JSON.stringify(title)}]') || label?.closest("button,a,[role=button]") || label;
      control?.click();
      return { clicked: Boolean(control), matches: labels.length, html: label?.parentElement?.parentElement?.parentElement?.parentElement?.outerHTML?.slice(0, 6000), path: location.pathname };
    })()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 4_000));
  const openTargets = await targets(debuggerPort);
  const opened = await evaluate(
    appTarget,
    `({
      path: location.pathname,
      href: location.href,
      bodyText: document.body?.innerText?.slice(0, 2500),
      titleVisible: document.body?.innerText?.includes(${JSON.stringify(title)})
    })`,
  );
  const previewTarget = openTargets.find((candidate) =>
    /^(?:claude-local-preview|claude-local-launch):\/\//.test(
      candidate.url ?? "",
    ),
  );
  const previewText = previewTarget
    ? await evaluate(previewTarget, "document.body?.innerText")
    : "";
  if (
    !cardClick.clicked ||
    !opened.path.startsWith("/epitaxy/") ||
    !previewTarget ||
    !previewText?.includes("Native artifact opened locally")
  )
    throw new Error(
      `Artifact card did not open its native local preview: ${JSON.stringify({ cardClick, opened, targetUrls: openTargets.map((target) => target.url) })}`,
    );
  process.stderr.write("artifact-gallery-probe: assertions passed\n");
  process.stdout.write(
    `${JSON.stringify({ gallery, chatCardClick, chatOpened, cardClick, opened, previewUrl: previewTarget.url, previewText }, null, 2)}\n`,
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
