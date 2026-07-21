import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Target list returned ${response.status}`);
  return response.json();
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
              message.result.exceptionDetails.exception?.description ??
                message.result.exceptionDetails.text ??
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

async function waitForTarget(port, predicate, child, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Electron exited early (${child.exitCode})`);
    try {
      const target = (await targets(port)).find(predicate);
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // The debugging endpoint is published shortly after app startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for Electron target");
}

async function eventually(operation, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await operation();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error("Timed out waiting for condition");
}

const debuggerPort = await unusedPort();
const profile = await mkdtemp(
  path.join(os.tmpdir(), "claude-code-artifact-selection-profile-"),
);
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-code-artifact-selection-workspace-"),
);
const seedSessionId = `workspace-seed-${Date.now()}`;
let sessionId = seedSessionId;
const artifactPath = path.join(workspace, "selectable-artifact.html");
const artifactUrl = pathToFileURL(artifactPath).toString();
const title = "Selectable artifact proof";
const now = new Date().toISOString();
await writeFile(
  artifactPath,
  '<!doctype html><style>body{background:#18314a;color:white}h1{padding:24px}</style><h1 id="selection-target" class="hero proof" data-probe="toolbar-selection">Select me from the Code toolbar</h1>',
  "utf8",
);

const providerRequests = [];
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "selection-probe-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    providerRequests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify(
        providerRequests.length === 1
          ? {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "I created the selectable artifact.",
                    tool_calls: [
                      {
                        id: "selection-artifact-call",
                        type: "function",
                        function: {
                          name: "Artifact",
                          arguments: JSON.stringify({
                            action: "publish",
                            file_path: artifactPath,
                            title,
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }
          : {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: "The selectable artifact is ready.",
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            },
      ),
    );
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve, reject) =>
  provider.listen(0, "127.0.0.1", resolve).once("error", reject),
);
const providerAddress = provider.address();
assert(
  typeof providerAddress === "object" && providerAddress,
  "Provider did not bind",
);
await writeFile(
  path.join(profile, "local-code-sessions.json"),
  `${JSON.stringify(
    {
      version: 1,
      sessions: [
        {
          sessionId,
          cwd: workspace,
          originCwd: workspace,
          isRunning: false,
          model: "selection-probe-model",
          effort: "medium",
          createdAt: Date.now() - 2_000,
          lastActivityAt: Date.now(),
          isArchived: false,
          title: "Artifact selection probe",
          homePath: os.homedir(),
          folderExists: true,
          pendingToolPermissions: [],
          permissionMode: "acceptEdits",
          rootDetected: true,
          additionalDirectories: [],
          initialMessage: "Create a selectable HTML artifact",
          transcript: [
            {
              type: "user",
              uuid: "selection-user",
              session_id: sessionId,
              sessionId,
              parent_tool_use_id: null,
              timestamp: now,
              message: {
                role: "user",
                content: "Create a selectable HTML artifact",
              },
            },
            {
              type: "assistant",
              uuid: "selection-assistant-tool",
              session_id: sessionId,
              sessionId,
              parentUuid: "selection-user",
              parent_tool_use_id: null,
              timestamp: now,
              message: {
                id: "selection-assistant-tool",
                type: "message",
                role: "assistant",
                model: "selection-probe-model",
                content: [
                  {
                    type: "tool_use",
                    id: "selection-artifact-call",
                    name: "Artifact",
                    input: {
                      action: "publish",
                      file_path: artifactPath,
                      title,
                    },
                  },
                ],
                stop_reason: "tool_use",
                stop_sequence: null,
                usage: {
                  input_tokens: 1,
                  output_tokens: 1,
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 0,
                },
              },
            },
            {
              type: "user",
              uuid: "selection-tool-result",
              session_id: sessionId,
              sessionId,
              parentUuid: "selection-assistant-tool",
              parent_tool_use_id: null,
              sourceToolAssistantUUID: "selection-assistant-tool",
              timestamp: now,
              message: {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: "selection-artifact-call",
                    content: JSON.stringify({
                      url: artifactUrl,
                      path: artifactPath,
                      title,
                      version: "toolbar-selection-proof",
                      contract: "local-desktop-artifact-v1",
                      updated: false,
                    }),
                    is_error: false,
                  },
                ],
              },
              toolUseResult: {
                url: artifactUrl,
                path: artifactPath,
                title,
                version: "toolbar-selection-proof",
                contract: "local-desktop-artifact-v1",
                updated: false,
              },
              tool_use_result: {
                url: artifactUrl,
                path: artifactPath,
                title,
                version: "toolbar-selection-proof",
                contract: "local-desktop-artifact-v1",
                updated: false,
              },
            },
            {
              type: "assistant",
              uuid: "selection-assistant-final",
              session_id: sessionId,
              sessionId,
              parentUuid: "selection-tool-result",
              parent_tool_use_id: null,
              timestamp: now,
              message: {
                id: "selection-assistant-final",
                type: "message",
                role: "assistant",
                model: "selection-probe-model",
                content: [{ type: "text", text: "The artifact is ready." }],
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: {
                  input_tokens: 1,
                  output_tokens: 1,
                  cache_creation_input_tokens: 0,
                  cache_read_input_tokens: 0,
                },
              },
            },
            {
              type: "result",
              subtype: "success",
              uuid: "selection-result",
              session_id: sessionId,
              sessionId,
              parentUuid: "selection-assistant-final",
              is_error: false,
              duration_ms: 10,
              duration_api_ms: 10,
              num_turns: 2,
              stop_reason: "end_turn",
              total_cost_usd: 0,
              result: "The artifact is ready.",
              usage: {},
              modelUsage: {},
              permission_denials: [],
            },
          ],
          artifacts: [
            {
              title,
              url: artifactUrl,
              path: artifactPath,
              updatedAt: now,
              version: "toolbar-selection-proof",
            },
          ],
        },
      ],
    },
    null,
    2,
  )}\n`,
  "utf8",
);
await writeFile(
  path.join(profile, "local-code-sessions.json"),
  `${JSON.stringify(
    {
      version: 1,
      sessions: [
        {
          sessionId: seedSessionId,
          cwd: workspace,
          originCwd: workspace,
          isRunning: false,
          model: "selection-probe-model",
          effort: "medium",
          createdAt: Date.now() - 1_000,
          lastActivityAt: Date.now() - 1_000,
          isArchived: false,
          title: "Workspace seed",
          homePath: os.homedir(),
          folderExists: true,
          pendingToolPermissions: [],
          permissionMode: "acceptEdits",
          rootDetected: true,
          additionalDirectories: [],
          transcript: [],
          artifacts: [],
        },
      ],
    },
    null,
    2,
  )}\n`,
  "utf8",
);

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
      CLAUDE_TRACE_CODE_IPC: "1",
      CLAUDE_LOCAL_BASE_URL: `http://127.0.0.1:${providerAddress.port}/v1`,
      CLAUDE_LOCAL_MODEL: "selection-probe-model",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const appTarget = await waitForTarget(
    debuggerPort,
    (candidate) =>
      candidate.type === "page" &&
      candidate.url.startsWith("app://localhost") &&
      !candidate.url.startsWith("app://localhost/blank"),
    child,
  );
  await evaluate(
    appTarget,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const visible = element => element.getClientRects().length > 0;
      let detectedProjects = [];
      while (Date.now() < deadline) {
        detectedProjects = await window["claude.web"].LocalSessions.getDetectedProjects();
        if (detectedProjects.some(project => project.path === ${JSON.stringify(workspace)})) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      let code;
      while (!code && Date.now() < deadline) {
        code = [...document.querySelectorAll('button[aria-label="Code"]')].find(visible);
        if (!code) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!code) throw new Error("Code navigation button was not found");
      location.assign("app://localhost/epitaxy");
      return true;
    })()`,
  ).catch((error) => {
    if (!/Execution context was destroyed/u.test(String(error))) throw error;
  });
  const started = await eventually(async () => {
    const codeTarget = await waitForTarget(
      debuggerPort,
      (candidate) =>
        candidate.type === "page" &&
        candidate.url.startsWith("app://localhost"),
      child,
      2_000,
    );
    return evaluate(
      codeTarget,
      `(async () => {
      const deadline = Date.now() + 25000;
      while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const existingSessions = await window["claude.web"].LocalSessions.getAll();
      const existingSession = existingSessions.find(candidate =>
        candidate.sessionId !== ${JSON.stringify(seedSessionId)} &&
        candidate.initialMessage === "Create a selectable HTML artifact"
      );
      if (existingSession) {
        const artifactDeadline = Date.now() + 15000;
        let published;
        while (!published && Date.now() < artifactDeadline) {
          const artifacts = await window["claude.web"].LocalSessions.getAllArtifacts();
          published = artifacts.find(candidate => candidate.sessionId === existingSession.sessionId);
          if (!published) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (published)
          return { sessionId: existingSession.sessionId, artifactId: published.id, url: location.href };
      }
      if (!location.pathname.startsWith("/epitaxy")) {
        location.assign("app://localhost/epitaxy");
        return null;
      }
      window.__toolbarSelection = null;
      window.__toolbarSelectionDispose = window["claude.web"].Launch.onElementSelected((serverId, context) => {
        window.__toolbarSelection = { serverId, context };
      });
      const visible = element => element.getClientRects().length > 0;
      while (!document.body?.innerText?.includes("What’s up next?") && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const folderButton = [...document.querySelectorAll("button")].find(button =>
        visible(button) && /select folder/i.test(button.textContent || "")
      );
      if (folderButton) {
        folderButton.click();
        const folderDeadline = Date.now() + 10000;
        let folderChoice;
        while (!folderChoice && Date.now() < folderDeadline) {
          const label = [...document.querySelectorAll("*")].find(element =>
            element !== folderButton &&
            visible(element) &&
            (element.textContent || "").trim() === ${JSON.stringify(path.basename(workspace))}
          );
          folderChoice = label?.closest('button,[role="option"],[role="menuitem"]') || label;
          if (!folderChoice) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!folderChoice) throw new Error("Seeded workspace was not offered by the native folder selector");
        folderChoice.click();
      }
      const composer = [...document.querySelectorAll('[contenteditable="true"]')].find(element =>
        visible(element) && element.getAttribute("aria-label") === "Prompt"
      );
      if (!composer) throw new Error("Native Code prompt composer was not found");
      composer.focus();
      document.execCommand("insertText", false, "Create a selectable HTML artifact");
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: "Create a selectable HTML artifact"
      }));
      await new Promise(resolve => setTimeout(resolve, 300));
      const send = [...document.querySelectorAll('button[aria-label="Send"]')].find(button =>
        visible(button) && !button.disabled
      );
      if (!send) throw new Error("Native Code send button was not enabled");
      send.click();
      const sessionDeadline = Date.now() + 20000;
      let session;
      while (!session && Date.now() < sessionDeadline) {
        const sessions = await window["claude.web"].LocalSessions.getAll();
        session = sessions.find(candidate =>
          candidate.sessionId !== ${JSON.stringify(seedSessionId)} &&
          candidate.initialMessage === "Create a selectable HTML artifact"
        );
        if (!session) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!session) throw new Error("Native Code launcher did not create a session");
      const artifactDeadline = Date.now() + 15000;
      let published;
      while (!published && Date.now() < artifactDeadline) {
        const artifacts = await window["claude.web"].LocalSessions.getAllArtifacts();
        published = artifacts.find(candidate => candidate.sessionId === session.sessionId);
        if (!published) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!published) throw new Error("Local Artifact tool did not publish");
      return { sessionId: session.sessionId, artifactId: published.id, url: location.href };
      })()`,
    );
  }, 55_000);
  assert(
    started?.sessionId,
    `Native Code launch failed: ${JSON.stringify(started)}`,
  );
  sessionId = started.sessionId;

  const toolbar = await eventually(async () => {
    const target = await waitForTarget(
      debuggerPort,
      (candidate) =>
        candidate.type === "page" &&
        candidate.url.startsWith(`app://localhost/epitaxy/${sessionId}`),
      child,
      2_000,
    );
    const result = await evaluate(
      target,
      `(async () => {
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        const view = [...document.querySelectorAll("button[aria-label]")].find(button =>
          visible(button) && button.getAttribute("aria-label") === ${JSON.stringify(`View ${title}`)}
        );
        const publishedArtifact = [...document.querySelectorAll('button,a,[role="button"]')].find(element =>
          visible(element) && /selectable-artifact\.html/i.test(element.textContent || "")
        );
        if (view) view.click();
        else if (publishedArtifact && !window.__publishedArtifactClicked) {
          window.__publishedArtifactClicked = true;
          publishedArtifact.click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        let select = [...document.querySelectorAll('button[aria-label="Select element"]')].find(visible);
        if (!select && !window.__selectionPreviewRequested) {
          const artifacts = await window["claude.web"].LocalSessions.getAllArtifacts();
          const artifact = artifacts.find(candidate => candidate.sessionId === ${JSON.stringify(sessionId)});
          if (artifact) {
            window.__selectionPreviewRequested = true;
            const next = new URL(location.href);
            next.searchParams.set("open_local_artifact", artifact.id);
            history.replaceState(history.state, "", next.toString());
            window.dispatchEvent(new PopStateEvent("popstate"));
            await new Promise(resolve => setTimeout(resolve, 600));
            select = [...document.querySelectorAll('button[aria-label="Select element"]')].find(visible);
          }
        }
        if (!select) return null;
        window.__toolbarSelection ??= null;
        if (!window.__toolbarSelectionDispose)
          window.__toolbarSelectionDispose = window["claude.web"].Launch.onElementSelected((serverId, context) => {
            window.__toolbarSelection = { serverId, context };
          });
        select.click();
        return {
          url: location.href,
          selectDisabled: select.disabled,
          bodyText: document.body?.innerText?.slice(-5000) || "",
          buttons: [...document.querySelectorAll("button[aria-label]")]
            .filter(visible)
            .map(button => button.getAttribute("aria-label"))
            .filter(Boolean)
        };
      })()`,
    );
    return result ? { target, result } : null;
  }, 35_000);

  const previewTarget = await waitForTarget(
    debuggerPort,
    (candidate) => candidate.url.startsWith("claude-local-launch://"),
    child,
    15_000,
  );
  const picker = await eventually(async () => {
    const result = await evaluate(
      previewTarget,
      `(() => {
        if (!window.__claudeLocalElementPicker) return null;
        const target = document.querySelector("#selection-target");
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        const highlighted = document.querySelector("[data-claude-local-element-picker=overlay]")?.style.display === "block";
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
        return { highlighted, text: document.body?.innerText };
      })()`,
    );
    return result;
  }, 10_000);

  const selection = await eventually(async () => {
    const target = await waitForTarget(
      debuggerPort,
      (candidate) =>
        candidate.type === "page" &&
        candidate.url.startsWith(`app://localhost/epitaxy/${sessionId}`),
      child,
      2_000,
    );
    return evaluate(target, "window.__toolbarSelection");
  }, 10_000);

  assert(
    toolbar.result.selectDisabled === false,
    "Select element was disabled",
  );
  assert(picker.highlighted, "Toolbar did not activate the preview picker");
  assert(
    selection?.context?.id === "selection-target" &&
      selection.context?.attributes?.["data-probe"] === "toolbar-selection" &&
      typeof selection.context?.screenshot === "string" &&
      selection.context.screenshot.length > 100,
    `Toolbar selection context was incomplete: ${JSON.stringify(selection)}`,
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        toolbar: toolbar.result,
        picker,
        selection: {
          serverId: selection.serverId,
          tagName: selection.context.tagName,
          id: selection.context.id,
          selector: selection.context.parentPath,
          screenshotBytes: Math.floor(
            selection.context.screenshot.length * 0.75,
          ),
        },
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  const targetList = await targets(debuggerPort).catch(() => []);
  const rendererTarget = targetList.find((target) =>
    target.url.startsWith("app://localhost"),
  );
  const rendererDiagnostics = rendererTarget
    ? await evaluate(
        rendererTarget,
        `(async () => {
          const servers = await window["claude.web"]?.Launch?.activeServersStore?.getState?.().catch(() => []);
          const previewTabs = await Promise.all((servers || []).map(async server => ({
            serverId: server.serverId,
            tabs: await window["claude.web"]?.Launch?.getPreviewTabs?.(server.serverId).catch(() => null)
          })));
          return {
            url: location.href,
            bodyText: document.body?.innerText?.slice(-10000) || "",
            servers,
            previewTabs,
            buttons: [...document.querySelectorAll("button")].map(button => ({
              text: button.textContent?.replace(/\\s+/g, " ").trim().slice(0, 200),
              aria: button.getAttribute("aria-label"),
              visible: button.getClientRects().length > 0,
              disabled: button.disabled
            })).filter(button => button.visible)
          };
        })()`,
      ).catch(() => null)
    : null;
  throw new Error(
    `${error instanceof Error ? error.message : String(error)}\nTargets: ${JSON.stringify(targetList.map((target) => ({ type: target.type, url: target.url })))}\nRenderer: ${JSON.stringify(rendererDiagnostics)}\n${output.join("").slice(-8_000)}`,
  );
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await Promise.all([
    rm(profile, { recursive: true, force: true }),
    rm(workspace, { recursive: true, force: true }),
  ]);
  await new Promise((resolve) => provider.close(resolve));
}
