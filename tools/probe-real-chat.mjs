import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const baseUrl = process.env.CLAUDE_REAL_BASE_URL || "http://127.0.0.1:1234/v1";
const model = process.env.CLAUDE_REAL_MODEL || "llm";
const mode = process.argv[2] || "chat";
const attachmentMode = mode === "attachment";
const artifactMode = mode === "artifact";
const expected = artifactMode
  ? "LIVE_ARTIFACT_OK"
  : attachmentMode
    ? "LIVE_ATTACHMENT_OK"
    : "LIVE_CHAT_OK";
const prompt = artifactMode
  ? "Call the artifacts function now to create a text/html artifact with id live-artifact-ok, title LIVE_ARTIFACT_OK, and content <html><body><h1>LIVE_ARTIFACT_OK</h1></body></html>. Do not merely describe it."
  : attachmentMode
    ? "Read the attached file. Reply with exactly LIVE_ATTACHMENT_OK if its secret phrase is present."
    : "Reply with exactly LIVE_CHAT_OK and no other text.";
const attachmentText = "secret phrase: local real attachment proof 7f2b";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function pageTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Target list returned ${response.status}`);
  const targets = await response.json();
  return targets.find(
    (target) =>
      target.type === "page" && target.url.startsWith("app://localhost"),
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
      socket.addEventListener("message", function listener(event) {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else if (message.result?.exceptionDetails)
          reject(
            new Error(
              message.result.exceptionDetails.exception?.description ||
                message.result.exceptionDetails.text ||
                "Evaluation failed",
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

async function setFileInput(target, file) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      socket.addEventListener("message", function listener(event) {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  try {
    const evaluated = await send("Runtime.evaluate", {
      expression:
        'document.querySelector(\'input[type="file"][data-testid="file-upload"]\')',
      returnByValue: false,
    });
    const objectId = evaluated.result?.objectId;
    if (!objectId) throw new Error("File input did not render");
    await send("DOM.setFileInputFiles", { files: [file], objectId });
  } finally {
    socket.close();
  }
}

async function eventually(port, operation, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await pageTarget(port);
      if (target?.webSocketDebuggerUrl) return await operation(target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error("Timed out waiting for renderer");
}

await fetch(`${baseUrl}/models`).then((response) => {
  assert(response.ok, `Real provider is unavailable: HTTP ${response.status}`);
});

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-real-chat-"));
const attachmentPath = path.join(profile, "live-attachment.txt");
if (attachmentMode) await writeFile(attachmentPath, attachmentText, "utf8");
const debuggerPort = await unusedPort();
const output = [];
const child = spawn(
  electron,
  [".", `--remote-debugging-port=${debuggerPort}`],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_LOCAL_BASE_URL: baseUrl,
      CLAUDE_LOCAL_MODEL: model,
      CLAUDE_TRACE_LOCAL_API: "1",
      CLAUDE_TRACE_LOCAL_UI: "1",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  if (attachmentMode) {
    await eventually(
      debuggerPort,
      (target) =>
        evaluate(
          target,
          `(async () => {
            const deadline = Date.now() + 25000;
            let addFiles;
            while (!addFiles && Date.now() < deadline) {
              addFiles = [...document.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === "Add files, connectors, and more");
              if (!addFiles) await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!addFiles) throw new Error("Add-files control did not render");
            addFiles.click();
            while (!document.querySelector('input[type="file"][data-testid="file-upload"]') && Date.now() < deadline)
              await new Promise(resolve => setTimeout(resolve, 50));
            return Boolean(document.querySelector('input[type="file"][data-testid="file-upload"]'));
          })()`,
        ),
      35_000,
    );
    await eventually(debuggerPort, (target) =>
      setFileInput(target, attachmentPath),
    );
  }
  const submitted = await eventually(
    debuggerPort,
    (target) =>
      evaluate(
        target,
        `(async () => {
          const deadline = Date.now() + 25000;
          let editor;
          while (Date.now() < deadline) {
            editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
            if (editor && location.pathname === "/new") break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (!editor) throw new Error("Chat composer did not render at " + location.href);
          if (${artifactMode}) {
            window.__realArtifactRendered = null;
            window.addEventListener("message", event => {
              if (event.origin === "app://artifacts.local" && event.data?.type === "local-artifact-rendered")
                window.__realArtifactRendered = event.data;
            });
          }
          if (${attachmentMode}) {
            while (!document.body?.innerText?.includes("live-attachment.txt") && Date.now() < deadline)
              await new Promise(resolve => setTimeout(resolve, 50));
            if (!document.body?.innerText?.includes("live-attachment.txt")) throw new Error("Attachment did not appear in composer");
          }
          editor.focus();
          if (!document.execCommand("insertText", false, ${JSON.stringify(prompt)})) {
            editor.textContent = ${JSON.stringify(prompt)};
            editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ${JSON.stringify(prompt)} }));
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          const send = [...document.querySelectorAll("button")].find(button =>
            /send message|start task/i.test(button.getAttribute("aria-label") || "") && !button.disabled
          );
          if (!send) throw new Error("Enabled send button not found");
          send.click();
          return { path: location.pathname, sendLabel: send.getAttribute("aria-label"), prompt: editor.textContent };
        })()`,
      ),
    35_000,
  );

  const rendered = await eventually(
    debuggerPort,
    (target) =>
      evaluate(
        target,
        `(async () => {
          const deadline = Date.now() + 240000;
          let conversation;
          while (Date.now() < deadline) {
            const uuid = location.pathname.startsWith("/chat/")
              ? location.pathname.split("/")[2]
              : undefined;
            if (uuid) {
              const response = await fetch('/api/organizations/00000000-0000-4000-8000-000000000001/chat_conversations/' + encodeURIComponent(uuid));
              if (response.ok) {
                conversation = await response.json();
                const assistant = conversation.chat_messages?.find(message => message.sender === "assistant");
                const complete = ${artifactMode}
                  ? assistant?.content?.some(block => block.type === "tool_use" && block.name === "artifacts" && block.input?.title === "LIVE_ARTIFACT_OK")
                  : assistant?.text?.includes(${JSON.stringify(expected)});
                if (complete) break;
              }
            }
            await new Promise(resolve => setTimeout(resolve, 250));
          }
          while (!document.body?.innerText?.includes("Claude finished the response") && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 100));
          if (${artifactMode}) {
            while (!window.__realArtifactRendered && Date.now() < deadline)
              await new Promise(resolve => setTimeout(resolve, 100));
          }
          const assistant = conversation?.chat_messages?.find(message => message.sender === "assistant");
          return {
            ok: ${artifactMode}
              ? assistant?.content?.some(block => block.type === "tool_use" && block.name === "artifacts" && block.input?.title === "LIVE_ARTIFACT_OK") || false
              : assistant?.text?.includes(${JSON.stringify(expected)}) || false,
            assistantText: assistant?.text || null,
            uiSettled: document.body?.innerText?.includes("Claude finished the response") || false,
            path: location.pathname,
            bodyText: document.body?.innerText?.slice(0, 8000) || "",
            iframes: [...document.querySelectorAll("iframe")].map(frame => ({ src: frame.getAttribute("src"), sandbox: frame.getAttribute("sandbox"), title: frame.title })),
            artifactRendered: window.__realArtifactRendered || null,
            dialogs: [...document.querySelectorAll('[role="dialog"]')]
              .filter(element => element.getClientRects().length)
              .map(element => element.textContent?.trim().slice(0, 1000)),
            alerts: [...document.querySelectorAll('[role="alert"]')]
              .filter(element => element.getClientRects().length)
              .map(element => element.textContent?.trim().slice(0, 1000))
          };
        })()`,
      ),
    250_000,
  );
  assert(
    rendered.ok,
    `Real response did not render: ${JSON.stringify(rendered)}`,
  );
  assert(
    rendered.uiSettled,
    `Real response did not settle in the UI: ${JSON.stringify(rendered)}`,
  );
  assert(
    !rendered.alerts.some((text) => /error|failed|unable/i.test(text || "")),
    `Visible error alert after send: ${JSON.stringify(rendered.alerts)}`,
  );

  const persisted = JSON.parse(
    await readFile(path.join(profile, "local-backend.json"), "utf8"),
  );
  const messages = persisted.conversations?.[0]?.chat_messages || [];
  assert(
    messages.some(
      (message) => message.sender === "human" && message.text === prompt,
    ),
    "Prompt was not persisted",
  );
  const assistant = messages.find((message) => message.sender === "assistant");
  assert(assistant, "Assistant reply was not persisted");
  if (artifactMode) {
    assert(
      !rendered.bodyText.includes("couldn’t finish this response"),
      `Artifact turn was marked incomplete in the UI: ${JSON.stringify(rendered.bodyText)}`,
    );
    assert(
      assistant.content?.some(
        (block) =>
          block.type === "tool_use" &&
          block.name === "artifacts" &&
          block.input?.title === expected,
      ),
      "Artifact tool call was not persisted",
    );
    assert(
      persisted.artifacts?.some(
        (artifact) =>
          artifact.title === expected &&
          artifact.versions?.at(-1)?.content?.includes(expected),
      ),
      "Artifact content was not persisted",
    );
    assert(
      rendered.bodyText.includes(expected),
      "Artifact was not visible in the UI",
    );
    assert(
      rendered.iframes?.some((frame) =>
        frame.src?.startsWith("app://artifacts.local"),
      ),
      "Artifact preview did not use the local sandbox",
    );
    assert(
      rendered.artifactRendered?.artifactType === "text/html",
      "Artifact renderer did not receive the live artifact",
    );
  } else {
    assert(
      assistant.text?.includes(expected),
      "Assistant reply was not persisted",
    );
  }
  if (attachmentMode) {
    const human = messages.find((message) => message.sender === "human");
    assert(
      human?.attachments?.some(
        (attachment) =>
          attachment.file_name === "live-attachment.txt" &&
          attachment.extracted_content.includes("7f2b"),
      ) ||
        human?.files?.some((file) => file.file_name === "live-attachment.txt"),
      "Attachment content was not persisted",
    );
  }

  await eventually(debuggerPort, (target) =>
    evaluate(target, `(() => { location.reload(); return true; })()`),
  ).catch(() => undefined);
  const reloaded = await eventually(
    debuggerPort,
    (target) =>
      evaluate(
        target,
        `(async () => {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            const hydrated = document.body?.innerText?.includes(${artifactMode ? JSON.stringify("Interactive artifact") : JSON.stringify("Claude responded")}) &&
              document.body?.innerText?.includes(${JSON.stringify(expected)});
            if (performance.getEntriesByType("navigation")[0]?.type === "reload" && hydrated)
              return { hydrated: true, path: location.pathname };
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          return { hydrated: false, path: location.pathname, bodyText: document.body?.innerText?.slice(0, 2000) };
        })()`,
      ),
    35_000,
  );
  assert(
    reloaded.hydrated,
    `Persisted conversation did not hydrate after reload: ${JSON.stringify(reloaded)}`,
  );

  const lifecycle = await eventually(debuggerPort, (target) =>
    evaluate(
      target,
      `(async () => {
        const uuid = location.pathname.split("/")[2];
        const endpoint = '/api/organizations/00000000-0000-4000-8000-000000000001/chat_conversations/' + encodeURIComponent(uuid);
        const renamedResponse = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Live renamed conversation", is_starred: true })
        });
        const renamed = await renamedResponse.json();
        const deletedResponse = await fetch(endpoint, { method: "DELETE" });
        const missingStatus = (await fetch(endpoint)).status;
        location.assign("app://localhost/new?mode=chat&surface=chat");
        return { renamedStatus: renamedResponse.status, renamed, deletedStatus: deletedResponse.status, missingStatus };
      })()`,
    ),
  );
  assert(
    lifecycle.renamed?.name === "Live renamed conversation" &&
      lifecycle.renamed?.is_starred === true,
    `Conversation rename/star failed: ${JSON.stringify(lifecycle)}`,
  );
  assert(
    lifecycle.deletedStatus === 200 && lifecycle.missingStatus === 404,
    `Conversation deletion failed: ${JSON.stringify(lifecycle)}`,
  );
  const newChat = await eventually(
    debuggerPort,
    (target) =>
      evaluate(
        target,
        `(async () => {
          const deadline = Date.now() + 25000;
          const hasComposer = () => Boolean(document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]'));
          while ((location.pathname !== "/new" || !hasComposer()) && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 100));
          return { path: location.pathname, hasComposer: hasComposer() };
        })()`,
      ),
    30_000,
  );
  assert(
    newChat.path === "/new" && newChat.hasComposer,
    `New-chat state did not recover after delete: ${JSON.stringify(newChat)}`,
  );

  process.stdout.write(
    `${JSON.stringify({ mode, submitted, rendered, reloaded, lifecycle, newChat, persistedMessages: messages.map(({ sender, text, content }) => ({ sender, text, contentTypes: content?.map((block) => block.type) })), persistedArtifacts: persisted.artifacts?.length || 0 }, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({ error: String(error), electronOutput: output.join("") }, null, 2)}\n`,
  );
  throw error;
} finally {
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
