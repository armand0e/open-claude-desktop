import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";
import { createMockOpenAiHandler } from "./mock-openai-server.mjs";

const mode = process.argv[2] || "chat";
const mixedFlowMode = mode === "flow";
const artifactMode = mode === "artifact" || mixedFlowMode;
const attachmentMode = mode === "attachment";
const reasoningMode =
  mode === "reasoning" || mode === "artifact" || mixedFlowMode;
const diagramMode = mode === "diagram";
const webDisabledMode = mode === "web-disabled";
const retryMode = mode === "retry";
const retryFollowUp = "Retry this follow-up without replacing the page.";
const retryRecoveredText = "Retry recovered in place.";
const attachmentText = "local attachment end-to-end proof phrase";
const reasoningText = "I should verify the native reasoning surface.";
const prompt = artifactMode
  ? "Create an interactive HTML artifact for the local smoke test."
  : attachmentMode
    ? "Read the attached local file and confirm receipt."
    : diagramMode
      ? "Explain a two-step process with an inline Mermaid diagram."
      : "Reply with the local smoke-test phrase.";
const reply = artifactMode
  ? "Local Artifact Demo"
  : attachmentMode
    ? "Local attachment contents received."
    : diagramMode
      ? "Inline visual rendered below.\n\n```mermaid\nflowchart LR\n  A[Cell input] --> B[Cell output]\n```"
      : "Hello from the local model.";
const replyMarker = diagramMode ? "Inline visual rendered below." : reply;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  if (!response.ok)
    throw new Error(`CDP target list returned HTTP ${response.status}`);
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
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "CDP evaluation failed",
      );
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function setFileInputFiles(target, files) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(JSON.stringify({ id, method, params }));
    });
  try {
    const evaluated = await send("Runtime.evaluate", {
      expression:
        'document.querySelector(\'input[type="file"][data-testid="file-upload"]\')',
      returnByValue: false,
    });
    const objectId = evaluated.result?.objectId;
    if (!objectId) throw new Error("File input object was not available");
    await send("DOM.setFileInputFiles", { files, objectId });
    return { requestedFiles: files.length };
  } finally {
    socket.close();
  }
}

async function evaluateEventually(port, expression, timeout = 30_000) {
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
  throw lastError ?? new Error("Timed out waiting for the local renderer");
}

async function setFileInputFilesEventually(port, files, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = (await targetsAt(port)).find(
        (candidate) =>
          candidate.type === "page" &&
          candidate.url.startsWith("app://localhost"),
      );
      if (target?.webSocketDebuggerUrl) {
        return await setFileInputFiles(target, files);
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error("Timed out setting the local file input");
}

async function listen(server) {
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  assert(typeof address === "object" && address, "Provider did not bind");
  return address.port;
}

const requests = [];
const defaultProviderHandler = async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    if (retryMode && requests.length === 2) {
      response.writeHead(504, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ error: { message: "Intentional retry state probe" } }),
      );
      return;
    }
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    if (artifactMode) {
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: reasoningText } }] })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_local_artifact_smoke",
                    function: {
                      name: "artifacts",
                      arguments: JSON.stringify({
                        command: "create",
                        id: "local-artifact-smoke",
                        title: reply,
                        type: "text/html",
                        content:
                          '<!doctype html><html><body><h1>Local Artifact Demo</h1><button id="counter">Count: 0</button><script>let count=0;counter.onclick=()=>counter.textContent=`Count: ${++count}`;<\/script></body></html>',
                      }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
      return;
    }
    if (reasoningMode)
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: reasoningText } }] })}\n\n`,
      );
    const text =
      retryMode && requests.length === 3 ? retryRecoveredText : reply;
    const split = Math.floor(text.length / 2);
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(0, split) } }] })}\n\n`,
    );
    await new Promise((resolve) => setTimeout(resolve, 75));
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(split) } }] })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
};
const provider = createHttpServer(
  mixedFlowMode
    ? createMockOpenAiHandler({ requests, delayMs: 180 })
    : defaultProviderHandler,
);

const providerPort = await listen(provider);
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-local-chat-"));
const attachmentPath = path.join(profile, "local-proof.txt");
if (attachmentMode) await writeFile(attachmentPath, attachmentText, "utf8");
const output = [];
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
  let attachmentDiagnostics = null;
  if (attachmentMode) {
    await evaluateEventually(
      debuggerPort,
      `(async () => {
        const deadline = Date.now() + 25000;
        let addFiles;
        while (Date.now() < deadline) {
          addFiles = [...document.querySelectorAll("button")].find(button =>
            button.getAttribute("aria-label") === "Add files, connectors, and more"
          );
          if (addFiles) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!addFiles) throw new Error("Add files control did not render");
        addFiles.click();
        while (!document.querySelector('input[type="file"][data-testid="file-upload"]') && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return Boolean(document.querySelector('input[type="file"][data-testid="file-upload"]'));
      })()`,
    );
    attachmentDiagnostics = await setFileInputFilesEventually(debuggerPort, [
      attachmentPath,
    ]);
  }
  let webToggleDiagnostics = null;
  if (webDisabledMode) {
    webToggleDiagnostics = await evaluateEventually(
      debuggerPort,
      `(async () => {
        const deadline = Date.now() + 25000;
        let add;
        while (!add && Date.now() < deadline) {
          add = [...document.querySelectorAll("button")].find(button =>
            button.getAttribute("aria-label") === "Add files, connectors, and more"
          );
          if (!add) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!add) throw new Error("Search and tools control did not render");
        add.click();
        while (!/web search|search and tools/i.test(document.body?.innerText || "") && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 50));
        const visible = element => element.getClientRects().length > 0;
        const label = [...document.querySelectorAll("*")].find(element =>
          visible(element) && element.children.length === 0 &&
          /^web search$/i.test(element.textContent?.trim() || "")
        );
        const control = label?.closest('[role],button') || label;
        if (!control) throw new Error("Web search menu toggle did not render");
        const beforeChecked = control.getAttribute("aria-checked");
        control.click();
        const settingsDeadline = Date.now() + 5000;
        let persistedWebSearch;
        while (Date.now() < settingsDeadline) {
          const profile = await fetch("/api/account_profile").then(response => response.json());
          persistedWebSearch = profile?.settings?.enabled_web_search;
          if (persistedWebSearch === false) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        return {
          clicked: true,
          beforeChecked,
          persistedWebSearch,
          menuClosed: ![...document.querySelectorAll('[role="menuitemcheckbox"]')]
            .some(visible)
        };
      })()`,
    );
  }
  const submitted = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      let editor;
      while (Date.now() < deadline) {
        editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
        if (editor && location.pathname === "/new") break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!editor || location.pathname !== "/new") throw new Error("Chat composer did not render at /new; current path is " + location.pathname);
      window.__localArtifactRendered = null;
      window.addEventListener("message", event => {
        if (event.origin === "app://artifacts.local" && event.data?.type === "local-artifact-rendered") {
          window.__localArtifactRendered = event.data;
        }
      });
      if (${attachmentMode}) {
        while (!document.body?.innerText?.includes("local-proof.txt") && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        if (!document.body?.innerText?.includes("local-proof.txt")) throw new Error("Attached file did not appear in the composer");
      }
      editor.focus();
      if (!document.execCommand("insertText", false, ${JSON.stringify(prompt)})) {
        editor.textContent = ${JSON.stringify(prompt)};
        editor.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: ${JSON.stringify(prompt)}
        }));
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      const buttons = [...document.querySelectorAll("button")];
      const send = buttons.find(button =>
        /send message|start task/i.test(button.getAttribute("aria-label") || "") &&
        !button.disabled
      );
      if (!send) {
        throw new Error("Enabled send button not found: " + JSON.stringify(buttons.map(button => ({
          label: button.getAttribute("aria-label"),
          disabled: button.disabled,
          text: button.textContent?.trim().slice(0, 40)
        }))));
      }
      send.click();
      return {
        path: location.pathname,
        editorText: editor.textContent,
        sendLabel: send.getAttribute("aria-label"),
        attachedFileVisible: document.body?.innerText?.includes("local-proof.txt") || false,
        attachmentDiagnostics: ${JSON.stringify(attachmentDiagnostics)}
      };
    })()`,
  );

  const rendered = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 30000;
      const startedAt = performance.now();
      const streamTimeline = [];
      let previousState = "";
      const capture = () => {
        const text = document.body?.innerText || "";
        const state = {
          thoughtProcess: /Thought process|Thought for|Thinking/.test(text),
          firstTextFragment: text.includes("I’ll create Local"),
          secondTextFragment: text.includes("Artifact Demo now."),
          finalTextFragment: text.includes("The streamed artifact is ready."),
          artifactCard: Boolean(document.querySelector('button[aria-label="View Local Artifact Demo"]')),
          artifactFrame: Boolean(document.querySelector('iframe[src^="app://artifacts.local"]')),
          finished: text.includes("Claude finished the response")
        };
        const serialized = JSON.stringify(state);
        if (serialized !== previousState) {
          previousState = serialized;
          streamTimeline.push({ elapsedMs: Math.round(performance.now() - startedAt), ...state });
        }
        return text;
      };
      while ((!capture().includes(${JSON.stringify(replyMarker)}) || (${artifactMode ? "!window.__localArtifactRendered" : "false"}) || (${diagramMode ? '!document.querySelector(".local-inline-mermaid svg")' : "false"}) || (${mixedFlowMode ? '!document.body?.innerText?.includes("The streamed artifact is ready.") || !/Thought process|Thought for/.test(document.body?.innerText || "")' : "false"})) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      capture();
      return {
        path: location.pathname,
        rendered: document.body?.innerText?.includes(${JSON.stringify(replyMarker)}),
        preload: {
          ready: window.desktopReconstructionReady,
          localClaude: typeof window.localClaude,
          workbench: Boolean(document.getElementById("local-claude-workbench")),
          chromeStyle: Boolean(document.getElementById("local-claude-chrome-style"))
        },
        bodyText: document.body?.innerText?.slice(0, 4000),
        bodyContent: document.body?.textContent?.slice(0, 12000),
        iframes: [...document.querySelectorAll("iframe")].map(frame => ({
          title: frame.title,
          src: frame.getAttribute("src"),
          sandbox: frame.getAttribute("sandbox")
        })),
        artifactButtons: [...document.querySelectorAll("button")]
          .map(button => ({
            text: button.textContent?.trim().slice(0, 80),
            ariaLabel: button.getAttribute("aria-label")
          }))
          .filter(button => /artifact|preview|code|copy|download|version|close/i.test((button.text || "") + " " + (button.ariaLabel || ""))),
        diagramSvgs: [...document.querySelectorAll(".local-inline-mermaid svg")]
          .map(svg => ({
            id: svg.id,
            className: svg.getAttribute("class"),
            source: svg.closest(".local-inline-mermaid")?.dataset.localMermaidSource,
            labels: [...svg.querySelectorAll("text")]
              .map(label => label.textContent?.trim())
              .filter(Boolean)
          })),
        codeBlocks: [...document.querySelectorAll("pre,code")]
          .map(element => ({
            tag: element.tagName,
            className: element.getAttribute("class"),
            text: element.textContent?.slice(0, 500),
            html: element.outerHTML?.slice(0, 2000)
          }))
          .filter(block => /mermaid|Cell input|flowchart/.test(block.text || "")),
        localArtifactRendered: window.__localArtifactRendered,
        streamTimeline
      };
    })()`,
    attachmentMode ? 15_000 : 35_000,
  );

  const deadline = Date.now() + 10_000;
  while (requests.length === 0 && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 50));
  if (requests.length !== 1)
    process.stderr.write(
      `${JSON.stringify({ submitted, rendered, electronOutput: output.join("") }, null, 2)}\n`,
    );
  assert(
    requests.length === 1,
    `Expected one provider request, got ${requests.length}`,
  );
  assert(
    requests[0].model === "smoke-model",
    "Provider model was not forwarded",
  );
  const providerContent = requests[0].messages?.at(-1)?.content;
  assert(
    attachmentMode
      ? providerContent?.includes(prompt) &&
          providerContent?.includes(attachmentText)
      : providerContent === prompt,
    "Prompt and attachment content were not forwarded to the provider",
  );
  assert(
    requests[0].tools?.some((tool) => tool.function?.name === "artifacts"),
    "Artifact function was not exposed to the provider",
  );
  if (webDisabledMode) {
    const toolNames =
      requests[0].tools?.map((tool) => tool.function?.name).filter(Boolean) ??
      [];
    assert(
      !toolNames.includes("web_search") &&
        !toolNames.includes("visit_website") &&
        requests[0].messages?.[0]?.content?.includes(
          "Web search is disabled for this conversation.",
        ),
      `Disabled Web search still reached the provider: ${JSON.stringify({ toolNames, system: requests[0].messages?.[0]?.content, webToggleDiagnostics })}`,
    );
  }
  assert(
    rendered.rendered,
    `Streamed provider response did not render in the UI: ${JSON.stringify(rendered)}`,
  );
  const reasoningExpanded = reasoningMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const deadline = Date.now() + 10000;
          const control = [...document.querySelectorAll("button")]
            .find(button => /^(Thought process|Thought for )/.test(button.textContent?.trim() || ""));
          if (!control) return { control: false, rendered: false };
          control.click();
          while (!document.body?.innerText?.includes(${JSON.stringify(reasoningText)}) && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          return {
            control: true,
            rendered: document.body?.innerText?.includes(${JSON.stringify(reasoningText)}),
            bodyText: document.body?.innerText?.slice(0, 5000)
          };
        })()`,
      )
    : null;
  if (reasoningMode) {
    assert(
      /Thought process|Thought for /.test(rendered.bodyText ?? ""),
      `Native Thought process control did not render: ${JSON.stringify(rendered)}`,
    );
    assert(
      reasoningExpanded?.rendered,
      `Provider reasoning was not shown after expanding the native control: ${JSON.stringify(reasoningExpanded)}`,
    );
  }
  if (mixedFlowMode) {
    assert(
      rendered.streamTimeline?.some((entry) => entry.thoughtProcess) &&
        rendered.streamTimeline?.some((entry) => entry.firstTextFragment) &&
        rendered.streamTimeline?.some((entry) => entry.finalTextFragment) &&
        rendered.streamTimeline?.some((entry) => entry.artifactFrame),
      `Mixed stream did not visibly progress through reasoning, text, and tool UI: ${JSON.stringify(rendered.streamTimeline)}`,
    );
  }
  const retryDiagnostics = retryMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const deadline = Date.now() + 25000;
          const visible = element => element.getClientRects().length > 0;
          const editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
          if (!editor) return { submitted: false, reason: "composer_missing" };
          const stateSentinel = crypto.randomUUID();
          window.__localRetryStateSentinel = stateSentinel;
          editor.focus();
          document.execCommand("selectAll", false);
          if (!document.execCommand("insertText", false, ${JSON.stringify(retryFollowUp)})) {
            editor.textContent = ${JSON.stringify(retryFollowUp)};
            editor.dispatchEvent(new InputEvent("input", {
              bubbles: true,
              composed: true,
              inputType: "insertText",
              data: ${JSON.stringify(retryFollowUp)}
            }));
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          const send = [...document.querySelectorAll('button')].find(button =>
            visible(button) && /send message/i.test(button.getAttribute('aria-label') || '') && !button.disabled
          );
          if (!send) return { submitted: false, reason: "send_missing" };
          send.click();
          let retry;
          while (!retry && Date.now() < deadline) {
            retry = [...document.querySelectorAll('button')].find(button =>
              visible(button) && /^try again$/i.test(button.textContent?.trim() || '')
            );
            if (!retry) await new Promise(resolve => setTimeout(resolve, 100));
          }
          let retryAction = 'button';
          const errorVisible = !!retry || /couldn.t process|provider returned http 504|intentional retry state probe/i.test(
            document.body?.innerText || ''
          );
          if (retry) {
            retry.click();
          } else {
            retryAction = 'restored-composer';
            const restoredDeadline = Date.now() + 5000;
            let restoredSend;
            while (!restoredSend && Date.now() < restoredDeadline) {
              const restoredEditor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
              if ((restoredEditor?.textContent || '').includes(${JSON.stringify(retryFollowUp)})) {
                restoredSend = [...document.querySelectorAll('button')].find(button =>
                  visible(button) && /send message/i.test(button.getAttribute('aria-label') || '') && !button.disabled
                );
              }
              if (!restoredSend) await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!restoredSend)
              return { submitted: true, retryAction: null, bodyText: document.body?.innerText?.slice(0, 4000) };
            restoredSend.click();
          }
          const replyDeadline = Date.now() + 30000;
          while (!document.body?.innerText?.includes(${JSON.stringify(retryRecoveredText)}) && Date.now() < replyDeadline)
            await new Promise(resolve => setTimeout(resolve, 100));
          return {
            submitted: true,
            retryAction,
            errorVisible: errorVisible || retryAction === 'restored-composer',
            replyVisible: document.body?.innerText?.includes(${JSON.stringify(retryRecoveredText)}),
            keptDocumentState: window.__localRetryStateSentinel === stateSentinel,
            path: location.pathname
          };
        })()`,
        60_000,
      )
    : null;
  if (retryMode)
    assert(
      retryDiagnostics?.submitted &&
        retryDiagnostics?.retryAction &&
        retryDiagnostics?.errorVisible &&
        retryDiagnostics?.replyVisible &&
        retryDiagnostics?.keptDocumentState,
      `Retry did not preserve and recover the active Chat document: ${JSON.stringify(retryDiagnostics)}`,
    );
  if (diagramMode) {
    assert(
      rendered.diagramSvgs?.length > 0,
      `Inline Mermaid was not rendered as an SVG: ${JSON.stringify(rendered)}`,
    );
    assert(
      rendered.iframes?.length === 0,
      `Inline diagram unexpectedly opened an artifact pane: ${JSON.stringify(rendered.iframes)}`,
    );
  }
  if (artifactMode) {
    assert(
      !rendered.bodyText?.includes("couldn’t finish this response"),
      `Artifact turn was marked incomplete: ${JSON.stringify(rendered.bodyText)}`,
    );
    assert(
      rendered.iframes?.some((frame) =>
        frame.src?.startsWith("app://artifacts.local"),
      ),
      `Artifact preview did not use the local sandbox: ${JSON.stringify(rendered.iframes)}`,
    );
    assert(
      rendered.localArtifactRendered?.artifactType === "text/html" &&
        rendered.localArtifactRendered?.contentLength > 100,
      `Local artifact renderer did not receive the HTML content: ${JSON.stringify(rendered.localArtifactRendered)}`,
    );
  }

  const artifactLifecycle = artifactMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const close = document.querySelector('button[aria-label="Close artifact"]');
          if (!close) return { closed: false, reopened: false, reason: "close_missing" };
          close.click();
          const closeDeadline = Date.now() + 5000;
          const visibleArtifact = () => {
            const frame = document.querySelector('iframe[src^="app://artifacts.local"]');
            if (!frame) return false;
            const rect = frame.getBoundingClientRect();
            const style = getComputedStyle(frame);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
          };
          while (visibleArtifact() && Date.now() < closeDeadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          const closed = !visibleArtifact();
          const view = document.querySelector('button[aria-label="View Local Artifact Demo"]');
          view?.click();
          const openDeadline = Date.now() + 8000;
          while (!visibleArtifact() && Date.now() < openDeadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          return {
            closed,
            reopened: visibleArtifact(),
            viewPresent: Boolean(view),
            viewHtml: view?.outerHTML?.slice(0, 1800),
            frameAncestors: (() => {
              const result = [];
              let element = document.querySelector('iframe[src^="app://artifacts.local"]');
              while (element && result.length < 10) {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                result.push({ tag: element.tagName, className: String(element.className).slice(0, 300), display: style.display, visibility: style.visibility, width: rect.width, height: rect.height });
                element = element.parentElement;
              }
              return result;
            })()
          };
        })()`,
      )
    : null;
  if (artifactMode)
    assert(
      artifactLifecycle?.closed && artifactLifecycle?.reopened,
      `Chat artifact did not close and reopen: ${JSON.stringify(artifactLifecycle)}`,
    );

  const artifactPublishModal = artifactMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const visible = element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
          };
          const readControls = () => [...document.querySelectorAll('button,[role="button"],[role="menuitem"]')]
            .filter(visible)
            .map(element => ({
              element,
              text: element.textContent?.trim() || "",
              ariaLabel: element.getAttribute("aria-label") || "",
              title: element.getAttribute("title") || ""
            }));
          let controls = readControls();
          let publish = controls.find(({ text, ariaLabel, title }) =>
            /publish|share artifact/i.test([text, ariaLabel, title].join(" "))
          );
          if (!publish) {
            const more = controls.find(({ ariaLabel }) =>
              /more options for artifact/i.test(ariaLabel)
            );
            more?.element.click();
            const menuDeadline = Date.now() + 3000;
            while (!publish && Date.now() < menuDeadline) {
              controls = readControls();
              publish = controls.find(({ text, ariaLabel, title }) =>
                /publish|share artifact/i.test([text, ariaLabel, title].join(" "))
              );
              if (!publish) await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          if (!publish)
            return {
              opened: false,
              reason: "publish_control_missing",
              controls: controls.map(({ text, ariaLabel, title }) => ({ text, ariaLabel, title }))
            };
          publish.element.click();
          const deadline = Date.now() + 8000;
          let dialog;
          while (Date.now() < deadline) {
            dialog = [...document.querySelectorAll('[role="dialog"]')]
              .find(candidate => visible(candidate) && /Publish artifact/i.test(candidate.textContent || ""));
            if (dialog) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          if (!dialog)
            return {
              opened: false,
              reason: "publish_dialog_missing",
              clicked: { text: publish.text, ariaLabel: publish.ariaLabel, title: publish.title }
            };
          const text = dialog.textContent || "";
          const policyCards = dialog.querySelectorAll('.bg-bg-300.text-text-300.mt-3.flex.gap-3.rounded-xl').length;
          const screenshotPreviews = dialog.querySelectorAll('img').length;
          const createAction = [...dialog.querySelectorAll('button')]
            .find(button => button.textContent?.trim() === "Create & copy link");
          const close = [...dialog.querySelectorAll('button')]
            .find(button => /close/i.test(button.getAttribute('aria-label') || ""));
          close?.click();
          return {
            opened: true,
            text,
            policyCards,
            screenshotPreviews,
            createActionPresent: Boolean(createAction),
            closePresent: Boolean(close)
          };
        })()`,
      )
    : null;
  if (artifactMode)
    assert(
      artifactPublishModal?.opened &&
        artifactPublishModal?.text?.includes(
          "Create a link that opens this artifact. Your chat will remain private.",
        ) &&
        artifactPublishModal?.createActionPresent &&
        artifactPublishModal?.policyCards === 0 &&
        artifactPublishModal?.screenshotPreviews === 0,
      `Local artifact publish modal retained cloud-only UI: ${JSON.stringify(artifactPublishModal)}`,
    );

  const streamSettled = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const pending = sessionStorage.getItem("new-conversation-params-for-navigation");
        if (!pending || pending === "{}") return true;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return false;
    })()`,
  );
  assert(streamSettled, "Conversation navigation state did not settle");

  await evaluateEventually(
    debuggerPort,
    `(() => { sessionStorage.setItem("local-smoke-expect-reload", "1"); location.reload(); return true; })()`,
  );
  const reloaded = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const navigation = performance.getEntriesByType("navigation")[0];
        const replyVisible = document.body?.innerText?.includes(${JSON.stringify(replyMarker)});
        const diagramVisible = ${diagramMode ? 'Boolean(document.querySelector(".local-inline-mermaid svg"))' : "true"};
        if (navigation?.type === "reload" && replyVisible && diagramVisible) {
          return { rendered: true, path: location.pathname, diagramVisible };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {
        rendered: false,
        path: location.pathname,
        navigationType: performance.getEntriesByType("navigation")[0]?.type,
        bodyText: document.body?.innerText?.slice(0, 1000)
      };
    })()`,
    35_000,
  );
  assert(
    reloaded.rendered,
    `Persisted conversation did not render after reload: ${JSON.stringify(reloaded)}`,
  );

  const persisted = JSON.parse(
    await readFile(path.join(profile, "local-backend.json"), "utf8"),
  );
  const messages = persisted.conversations?.[0]?.chat_messages ?? [];
  assert(
    messages.some(
      (message) => message.sender === "human" && message.text === prompt,
    ),
    "Human message was not persisted",
  );
  const assistant = messages.find((message) => message.sender === "assistant");
  assert(assistant, "Assistant message was not persisted");
  if (artifactMode) {
    assert(
      assistant.content?.some(
        (block) =>
          block.type === "tool_use" &&
          block.name === "artifacts" &&
          block.input?.id === "local-artifact-smoke" &&
          block.input?.title === reply,
      ),
      "Native artifact tool block was not persisted",
    );
    assert(
      persisted.artifacts?.[0]?.versions?.[0]?.content?.includes(
        "Local Artifact Demo",
      ),
      "Artifact version content was not persisted",
    );
  } else {
    assert(assistant.text === reply, "Assistant message was not persisted");
  }
  if (retryMode) {
    assert(
      requests.length === 3,
      `Retry sent ${requests.length} provider requests`,
    );
    assert(
      messages.filter(
        (message) => message.sender === "human" && message.text === prompt,
      ).length === 1,
      "Retry duplicated the original human message",
    );
    assert(
      messages.filter(
        (message) =>
          message.sender === "human" && message.text === retryFollowUp,
      ).length === 1,
      "Retry duplicated the follow-up human message",
    );
    assert(
      messages.filter((message) => message.sender === "assistant").length === 2,
      "Retry persisted an extra failed assistant branch",
    );
  }
  if (reasoningMode)
    assert(
      assistant.content?.some(
        (block) =>
          block.type === "thinking" && block.thinking === reasoningText,
      ),
      "Provider reasoning was not persisted as a thinking block",
    );
  if (attachmentMode) {
    const human = messages.find((message) => message.sender === "human");
    assert(
      submitted.attachedFileVisible,
      "Attached file was not visible before send",
    );
    assert(
      human?.attachments?.some(
        (attachment) =>
          attachment.file_name === "local-proof.txt" &&
          attachment.extracted_content === attachmentText,
      ) || human?.files?.some((file) => file.file_name === "local-proof.txt"),
      "Local attachment metadata and content were not persisted",
    );
  }

  const artifactNavigation = artifactMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const stateSentinel = crypto.randomUUID();
          window.__localArtifactNavigationSentinel = stateSentinel;
          const rowLabel = element =>
            (element.textContent || '').replace(/[\\uE000-\\uF8FF]/gu, '').trim();
          const newChat = [...document.querySelectorAll('button')].find(button =>
            button.getClientRects().length > 0 && /^new chat/i.test(rowLabel(button))
          );
          if (!newChat) throw new Error('New chat control not found');
          newChat.click();
          const newDeadline = Date.now() + 8000;
          while (!/^\\/(new|chat\\/new)/.test(location.pathname) && Date.now() < newDeadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          await new Promise(resolve => setTimeout(resolve, 1200));
          const artifactVisible = () => {
            const frame = document.querySelector('iframe[src^="app://artifacts.local"]');
            if (!frame) return false;
            const rect = frame.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && getComputedStyle(frame).visibility !== 'hidden';
          };
          const closedOnLeave = !artifactVisible();
          const leakedWelcome = [...document.querySelectorAll('h1,h2,h3')]
            .some(heading => heading.textContent?.trim() === 'What can I help you with?');
          // The retained router replaces history entries for these
          // transitions (chrome Back is disabled, matching the cloud app),
          // so return to the conversation through the recents list.
          const recentsDeadline = Date.now() + 8000;
          let recent = null;
          while (!recent && Date.now() < recentsDeadline) {
            recent = [...document.querySelectorAll('a,button')].find(element =>
              element.getClientRects().length > 0 &&
              rowLabel(element).startsWith(${JSON.stringify(prompt.slice(0, 40))})
            );
            if (!recent) await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (!recent) throw new Error('Recents entry not found after leaving the chat');
          recent.click();
          const backDeadline = Date.now() + 8000;
          while (!/^\\/chat\\/[0-9a-f-]{36}/i.test(location.pathname) && Date.now() < backDeadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          await new Promise(resolve => setTimeout(resolve, 800));
          const view = document.querySelector('button[aria-label="View Local Artifact Demo"]');
          if (!artifactVisible()) view?.click();
          const reopenDeadline = Date.now() + 8000;
          while (!artifactVisible() && Date.now() < reopenDeadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          return {
            path: location.pathname,
            closedOnLeave,
            leakedWelcome,
            returnedToConversation: location.pathname.startsWith('/chat/'),
            reopenedAfterVisit: artifactVisible(),
            keptDocumentState: window.__localArtifactNavigationSentinel === stateSentinel,
            navigationType: performance.getEntriesByType('navigation')[0]?.type
          };
        })()`,
        30_000,
      )
    : null;
  if (artifactMode)
    assert(
      artifactNavigation?.closedOnLeave &&
        !artifactNavigation?.leakedWelcome &&
        artifactNavigation?.returnedToConversation &&
        artifactNavigation?.reopenedAfterVisit &&
        artifactNavigation?.keptDocumentState,
      `Artifact navigation lifecycle failed: ${JSON.stringify(artifactNavigation)}`,
    );

  process.stdout.write(
    `${JSON.stringify(
      {
        submitted,
        ...(retryMode ? { retryDiagnostics } : {}),
        rendered: { path: rendered.path, rendered: rendered.rendered },
        ...(mixedFlowMode ? { streamTimeline: rendered.streamTimeline } : {}),
        ...(reasoningMode ? { reasoningExpanded } : {}),
        ...(artifactMode
          ? {
              artifactUi: {
                bodyText: rendered.bodyText,
                iframes: rendered.iframes,
                buttons: rendered.artifactButtons,
                rendererSignal: rendered.localArtifactRendered,
              },
              artifactLifecycle,
              artifactPublishModal,
              artifactNavigation,
            }
          : {}),
        reloaded: reloaded.rendered,
        providerRequest: requests[0],
        ...(webDisabledMode ? { webToggleDiagnostics } : {}),
        artifactMode,
        attachmentMode,
        reasoningMode,
        diagramMode,
        mixedFlowMode,
        persistedArtifacts: persisted.artifacts?.length ?? 0,
        persistedMessages: messages.map(({ sender, text }) => ({
          sender,
          text,
        })),
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(`${output.join("")}\n`);
  throw error;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await new Promise((resolve) => provider.close(resolve));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
