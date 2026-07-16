import { execFileSync, spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const realMode = process.argv.includes("real");
const allToolsMode = process.argv.includes("all-tools");
const permissionMode = process.argv.includes("permission");
const bypassMode = process.argv.includes("bypass");
const toolPermissionMode = permissionMode || bypassMode;
const terminalMode = process.argv.includes("terminal");
const expectedReasoning = toolPermissionMode
  ? "I should request approval before running the command."
  : "I should inspect fixture.txt before writing the proof.";
const expectedReply = realMode
  ? allToolsMode
    ? "LIVE_CODE_ALL_TOOLS_OK"
    : toolPermissionMode
      ? "LIVE_CODE_PERMISSION_OK"
      : "LIVE_CODE_OK"
  : toolPermissionMode
    ? "Local Code permission smoke complete"
    : "Local Code smoke complete";
const initialPrompt = realMode
  ? allToolsMode
    ? "Use every named tool in this exact workflow: (1) Glob for **/*.txt, (2) Grep for native Code renderer proof phrase, (3) Read fixture.txt, (4) Write all-tools.md containing '# All tools' and 'phase=one' and the fixture phrase, (5) Edit all-tools.md to replace phase=one with phase=two, (6) Bash to print all-tools-bash-ok, (7) Artifact with action publish and file_path all-tools.md and title SDK Artifact Proof, and (8) mcp__desktop__present_artifact with title MCP Artifact Proof, type text/html, and content <html><body>MCP_ARTIFACT_OK</body></html>. Use the tools, do not merely describe them. After every tool succeeds, reply with exactly LIVE_CODE_ALL_TOOLS_OK."
    : toolPermissionMode
      ? "Use the Bash tool to run node -e \"process.stdout.write('live permission proof')\". After the approved command succeeds, reply with exactly LIVE_CODE_PERMISSION_OK."
      : "Use Read to read fixture.txt. Then use Write to create code-smoke-proof.md containing the fixture phrase. After both tools succeed, reply with exactly LIVE_CODE_OK."
  : toolPermissionMode
    ? "Run a harmless command to prove the permission flow."
    : "Read fixture.txt, then create a Markdown proof file.";

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

async function listen(server) {
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  assert(typeof address === "object" && address, "Provider did not bind");
  return address.port;
}

async function targetsAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok)
    throw new Error(`CDP target list returned HTTP ${response.status}`);
  return response.json();
}

async function cdpCall(target, method, params = {}) {
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
          method,
          params,
        }),
      );
    });
    return result;
  } finally {
    socket.close();
  }
}

async function evaluate(target, expression) {
  const result = await cdpCall(target, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "CDP evaluation failed",
    );
  return result.result?.value;
}

async function appTarget(port) {
  return (await targetsAt(port)).find(
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
  );
}

async function captureScreenshot(port, clip) {
  const target = await appTarget(port);
  if (!target?.webSocketDebuggerUrl)
    throw new Error("The app CDP target was not available for a screenshot");
  const result = await cdpCall(target, "Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: { ...clip, scale: 1 },
  });
  return { target, data: result.data };
}

async function screenshotPixelStats(target, pngBase64) {
  return evaluate(
    target,
    `(async () => {
      const image = new Image();
      image.src = ${JSON.stringify(`data:image/png;base64,${pngBase64}`)};
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Map();
      let brightPixels = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const key = (red << 16) | (green << 8) | blue;
        colors.set(key, (colors.get(key) || 0) + 1);
        if (Math.max(red, green, blue) >= 100) brightPixels += 1;
      }
      const totalPixels = pixels.length / 4;
      const dominantPixels = Math.max(...colors.values());
      return {
        width: canvas.width,
        height: canvas.height,
        totalPixels,
        distinctColors: colors.size,
        nonDominantPixels: totalPixels - dominantPixels,
        brightPixels
      };
    })()`,
  );
}

async function evaluateEventually(port, expression, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await appTarget(port);
      if (target?.webSocketDebuggerUrl)
        return await evaluate(target, expression);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError ?? new Error("Timed out waiting for the Code renderer");
}

const requests = [];
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "code-smoke-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "application/json" });
    if (requests.length === 1) {
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                reasoning_content: expectedReasoning,
                content: toolPermissionMode
                  ? "I’ll run a harmless verification command."
                  : "I’ll inspect the fixture first.",
                tool_calls: [
                  toolPermissionMode
                    ? {
                        id: "call_permission_bash",
                        type: "function",
                        function: {
                          name: "Bash",
                          arguments: JSON.stringify({
                            command:
                              "node -e \"process.stdout.write('permission proof')\"",
                          }),
                        },
                      }
                    : {
                        id: "call_read_fixture",
                        type: "function",
                        function: {
                          name: "Read",
                          arguments: JSON.stringify({
                            file_path: "fixture.txt",
                          }),
                        },
                      },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 8 },
        }),
      );
      return;
    }
    if (toolPermissionMode) {
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  "Local Code permission smoke complete: the approved command returned permission proof.",
              },
            },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 12 },
        }),
      );
      return;
    }
    if (requests.length === 2) {
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "I found the fixture and will create the proof file.",
                tool_calls: [
                  {
                    id: "call_write_proof",
                    type: "function",
                    function: {
                      name: "Write",
                      arguments: JSON.stringify({
                        file_path: "code-smoke-proof.md",
                        content:
                          "# Local Code proof\n\nRead fixture: native Code renderer proof phrase\n",
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 12 },
        }),
      );
      return;
    }
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Local Code smoke complete: I read fixture.txt and created code-smoke-proof.md.",
            },
          },
        ],
        usage: { prompt_tokens: 60, completion_tokens: 15 },
      }),
    );
    return;
  }
  response.writeHead(404).end();
});

const providerPort = await listen(provider);
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-local-code-"));
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-local-code-workspace-"),
);
await writeFile(
  path.join(workspace, "fixture.txt"),
  "native Code renderer proof phrase\n",
  "utf8",
);
await writeFile(
  path.join(workspace, "pixel.png"),
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4l8AAAAASUVORK5CYII=",
    "base64",
  ),
);
execFileSync("git", ["init", "-b", "main", workspace], {
  stdio: "ignore",
  windowsHide: true,
});
execFileSync("git", ["-C", workspace, "config", "user.name", "Local Test"], {
  stdio: "ignore",
  windowsHide: true,
});
execFileSync(
  "git",
  ["-C", workspace, "config", "user.email", "local@test.invalid"],
  {
    stdio: "ignore",
    windowsHide: true,
  },
);
execFileSync("git", ["-C", workspace, "add", "fixture.txt", "pixel.png"], {
  stdio: "ignore",
  windowsHide: true,
});
execFileSync("git", ["-C", workspace, "commit", "-m", "fixture"], {
  stdio: "ignore",
  windowsHide: true,
});
const seedSessionId = `workspace-seed-${Date.now()}`;
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
          model: realMode
            ? process.env.CLAUDE_REAL_MODEL || "llm"
            : "code-smoke-model",
          effort: "medium",
          createdAt: Date.now() - 1000,
          lastActivityAt: Date.now() - 1000,
          // Keep the workspace seed visible until the native launcher has
          // hydrated its recent-project state. Archived-only seeds made the
          // folder popover timing-sensitive across consecutive Electron runs.
          isArchived: false,
          title: "Workspace seed",
          homePath: os.homedir(),
          folderExists: true,
          pendingToolPermissions: [],
          permissionMode: "acceptEdits",
          rootDetected: true,
          additionalDirectories: [],
          transcript: [],
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
  [
    ".",
    ...(terminalMode && process.env.CLAUDE_SMOKE_DOM_TERMINAL === "1"
      ? ["--disable-gpu", "--disable-webgl", "--disable-software-rasterizer"]
      : []),
    `--remote-debugging-port=${debuggerPort}`,
  ],
  {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      CLAUDE_LOCAL_USER_DATA_DIR: profile,
      CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
      CLAUDE_DESKTOP_LOCAL_UI: "1",
      CLAUDE_LOCAL_BASE_URL: realMode
        ? process.env.CLAUDE_REAL_BASE_URL || "http://127.0.0.1:1234/v1"
        : `http://127.0.0.1:${providerPort}/v1`,
      CLAUDE_LOCAL_MODEL: realMode
        ? process.env.CLAUDE_REAL_MODEL || "llm"
        : "code-smoke-model",
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const started = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      let detectedProjects = [];
      while (Date.now() < deadline) {
        detectedProjects = await window["claude.web"].LocalSessions.getDetectedProjects();
        if (detectedProjects.some(project => project.path === ${JSON.stringify(workspace)}))
          break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!detectedProjects.some(project => project.path === ${JSON.stringify(workspace)}))
        throw new Error("Seeded workspace did not hydrate through LocalSessions: " + JSON.stringify(detectedProjects));
      window.__localCodeEvents = [];
      window["claude.web"].LocalSessions.onOnEvent(event => {
        window.__localCodeEvents.push({
          type: event?.type,
          sessionId: event?.sessionId,
          hasMessage: Boolean(event?.message),
          messageType: event?.message?.type
        });
      });
      const codeButton = [...document.querySelectorAll("button")].find(button =>
        button.getAttribute("aria-label") === "Code"
      );
      codeButton?.click();
      while (!document.body?.innerText?.includes("What’s up next?") && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise(resolve => setTimeout(resolve, 300));
      const visible = element =>
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden";
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
          folderChoice = label?.closest('button, [role="option"], [role="menuitem"]') || label;
          if (!folderChoice) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!folderChoice)
          throw new Error("Seeded workspace was not offered by the native folder selector despite hydrated projects: " + JSON.stringify(detectedProjects) + "\\n" + document.body?.innerText?.slice(-2000));
        folderChoice.click();
      } else if (!document.body?.innerText?.includes(${JSON.stringify(path.basename(workspace))})) {
        throw new Error("Native Code landing had neither a folder selector nor the seeded workspace: " + document.body?.innerText?.slice(-2500));
      }
      if (${JSON.stringify(bypassMode)}) {
        const modeButton = [...document.querySelectorAll("button")].find(button =>
          visible(button) && /^accept edits$/i.test(button.textContent?.trim() || "")
        );
        if (!modeButton) throw new Error("Accept edits permission control was not found");
        modeButton.click();
        const modeDeadline = Date.now() + 5000;
        let bypass;
        while (!bypass && Date.now() < modeDeadline) {
          const label = [...document.querySelectorAll("*")].find(element =>
            visible(element) && /^bypass permissions$/i.test(element.textContent?.trim() || "")
          );
          bypass = label?.closest('button,[role="menuitem"],[role="option"]') || label;
          if (!bypass) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!bypass)
          throw new Error("Bypass permissions option did not open: " + document.body?.innerText?.slice(-2000));
        bypass.click();
        const confirmDeadline = Date.now() + 5000;
        let confirm;
        while (!confirm && Date.now() < confirmDeadline) {
          confirm = [...document.querySelectorAll("button")].find(button =>
            visible(button) && /^bypass permissions$/i.test(button.textContent?.trim() || "")
          );
          if (!confirm) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!confirm)
          throw new Error("Bypass permissions confirmation did not open: " + document.body?.innerText?.slice(-2000));
        confirm.click();
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const composer = [...document.querySelectorAll('[contenteditable="true"]')]
        .find(element => visible(element) && element.getAttribute("aria-label") === "Prompt");
      if (!composer) throw new Error("Native Code prompt composer was not found: " + JSON.stringify({ body: document.body?.innerText?.slice(-3000), editables: [...document.querySelectorAll('[contenteditable]')].map(element => ({ aria: element.getAttribute('aria-label'), visible: visible(element), html: element.outerHTML.slice(0, 800) })) }));
      composer.focus();
      document.execCommand("insertText", false, ${JSON.stringify(initialPrompt)});
      composer.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: ${JSON.stringify(initialPrompt)}
      }));
      await new Promise(resolve => setTimeout(resolve, 300));
      const send = [...document.querySelectorAll('button[aria-label="Send"]')]
        .find(button => visible(button) && !button.disabled);
      if (!send)
        throw new Error("Native Code send button was not enabled: " + composer.textContent);
      send.click();
      const sessionDeadline = Date.now() + 20000;
      let session;
      while (!session && Date.now() < sessionDeadline) {
        const sessions = await window["claude.web"].LocalSessions.getAll();
        session = sessions.find(candidate =>
          candidate.sessionId !== ${JSON.stringify(seedSessionId)} &&
          candidate.initialMessage === ${JSON.stringify(initialPrompt)}
        );
        if (!session) await new Promise(resolve => setTimeout(resolve, 100));
      }
      const skills = await window["claude.web"].LocalAgentModeSessions?.listLocalSkills?.() || [];
      return session ? {
        sessionId: session.sessionId,
        skillNames: skills.map(skill => skill.name),
        builtinSkills: skills.filter(skill => skill.builtIn).map(skill => skill.name)
      } : null;
    })()`,
  );
  assert(
    started?.sessionId,
    "Native Code launcher did not start a local session",
  );
  assert(
    started.skillNames?.includes("frontend-design") &&
      started.skillNames?.includes("skill-creator"),
    `Built-in local skills were not available through the native API: ${JSON.stringify(started)}`,
  );

  let permissionDiagnostics = null;
  if (permissionMode || allToolsMode) {
    permissionDiagnostics = await evaluateEventually(
      debuggerPort,
      `(async () => {
        window.__localCodeEventsAfterPermission = [];
        window["claude.web"].LocalSessions.onOnEvent(event => {
          window.__localCodeEventsAfterPermission.push({
            type: event?.type,
            sessionId: event?.sessionId,
            hasMessage: Boolean(event?.message),
            messageType: event?.message?.type
          });
        });
        const deadline = Date.now() + ${realMode ? 240000 : 20000};
        let candidate;
        while (Date.now() < deadline) {
          candidate = [...document.querySelectorAll("button")].find(button =>
            /^(allow once|approve once|run once)/i.test(button.textContent?.trim() || "")
          );
          if (candidate) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const buttons = [...document.querySelectorAll("button")].map(button => ({
          text: button.textContent?.trim().slice(0, 100),
          ariaLabel: button.getAttribute("aria-label")
        })).filter(item => item.text || item.ariaLabel);
        if (!candidate) throw new Error("Native approval button was not found: " + JSON.stringify(buttons));
        const clicked = candidate.textContent?.trim();
        candidate.click();
        return { clicked, bodyText: document.body?.innerText?.slice(0, 4000), buttons };
      })()`,
      realMode ? 250_000 : 25_000,
    );
  }

  const rendered = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const expected = ${JSON.stringify(expectedReply)};
      const deadline = Date.now() + ${realMode ? 240000 : 30000};
      let session;
      let transcript = [];
      let completed = false;
      while (!completed && Date.now() < deadline) {
        session = await window["claude.web"].LocalSessions.getSession(${JSON.stringify(started.sessionId)});
        transcript = await window["claude.web"].LocalSessions.getTranscript(${JSON.stringify(started.sessionId)});
        completed = session?.isRunning === false && transcript.some(message =>
          message.type === "assistant" && Array.isArray(message.message?.content) &&
          message.message.content.some(block => block.type === "text" && block.text?.includes(expected))
        );
        if (completed) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {
        url: location.href,
        rendered: completed,
        bodyText: document.body?.innerText?.slice(0, 8000) || "",
        reconnectingHtml: [...document.querySelectorAll("*")]
          .filter(element => [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && /Reconnecting/.test(node.textContent || "")))
          .slice(-5)
          .map(element => element.outerHTML.slice(0, 2000)),
        session,
        transcriptTypes: transcript.map(message => message.type),
        thinkingBlocks: transcript.flatMap(message =>
          message.type === "assistant" && Array.isArray(message.message?.content)
            ? message.message.content
                .filter(block => block.type === "thinking")
                .map(block => block.thinking)
            : []
        ),
        observedEvents: window.__localCodeEventsAfterPermission || window.__localCodeEvents,
        toolNames: transcript.flatMap(message =>
          message.type === "assistant" && Array.isArray(message.message?.content)
            ? message.message.content.filter(block => block.type === "tool_use").map(block => block.name)
            : []
        )
      };
    })()`,
    realMode ? 250_000 : 40_000,
  );

  const proofPath = path.join(
    workspace,
    allToolsMode ? "all-tools.md" : "code-smoke-proof.md",
  );
  const proof = toolPermissionMode ? "" : await readFile(proofPath, "utf8");
  let lifecycleDiagnostics = null;
  if (realMode) {
    lifecycleDiagnostics = await evaluateEventually(
      debuggerPort,
      `(async () => {
        const sessions = window["claude.web"].LocalSessions;
        const sessionId = ${JSON.stringify(started.sessionId)};
        const cwd = ${JSON.stringify(workspace)};
        const before = await sessions.readSessionFile(sessionId, "fixture.txt");
        const write = await sessions.writeSessionFile(sessionId, "fixture.txt", "native Code renderer proof phrase\\nlifecycle edit\\n", before.hash);
        const conflict = await sessions.writeSessionFile(sessionId, "fixture.txt", "stale write", before.hash);
        const after = await sessions.readSessionFile(sessionId, "fixture.txt");
        const direct = await sessions.readFileAtCwd(cwd, "fixture.txt");
        const resolved = await sessions.resolveSessionFile(sessionId, "fixture.txt");
        const entries = await sessions.listSessionDirectory(sessionId, ".");
        const media = await sessions.readSessionImageAsDataUrl(sessionId, "pixel.png");
        const bash = await sessions.runBashCommand(sessionId, "echo LOCAL_SESSIONS_BASH_OK");
        await sessions.setEffort(sessionId, "high");
        const permissionSet = await sessions.setPermissionMode(sessionId, "auto");
        await sessions.setModel(sessionId, ${JSON.stringify(process.env.CLAUDE_REAL_MODEL || "llm")});
        const changedCwd = await sessions.changeCwd(sessionId, cwd);
        const directoriesAdded = await sessions.addDirectories(sessionId, [cwd]);
        await sessions.updateSession(sessionId, { title: "Live lifecycle session", isStarred: true });
        await sessions.archive(sessionId);
        const archived = await sessions.getSession(sessionId);
        await sessions.unarchive(sessionId);
        const current = await sessions.getSession(sessionId);
        return {
          before,
          write,
          conflict,
          after,
          direct,
          resolved,
          entryNames: entries.map(entry => entry.name),
          mediaPrefix: media?.slice(0, 30),
          bash,
          permissionSet,
          directoriesAdded,
          changedCwd,
          effort: await sessions.getEffort(sessionId),
          permissionMode: await sessions.getPermissionMode(sessionId),
          defaultEffort: await sessions.getDefaultEffort(),
          defaultPermissionMode: await sessions.getDefaultPermissionMode(cwd),
          archived,
          current,
          search: await sessions.searchSessions("Live lifecycle"),
          projects: await sessions.getDetectedProjects(),
          trust: await sessions.checkTrust(cwd),
          gitInfo: await sessions.getGitInfo(cwd),
          gitDiff: await sessions.getGitDiff(cwd, "HEAD", undefined, { includePatches: true }),
          gitDiffStats: await sessions.getGitDiffStats(cwd, "HEAD"),
          workingTree: await sessions.getWorkingTreeStatus(cwd),
          uncommitted: await sessions.getUncommittedChanges(sessionId),
          dirty: await sessions.isWorkingTreeDirty(cwd),
          branches: await sessions.getLocalBranches(cwd),
          commits: await sessions.getGitCommits(cwd, "HEAD"),
          allCount: (await sessions.getAll()).length
        };
      })()`,
      30_000,
    );
    assert(
      lifecycleDiagnostics.write?.status === "ok" &&
        lifecycleDiagnostics.conflict?.status === "conflict" &&
        lifecycleDiagnostics.after?.contents?.includes("lifecycle edit") &&
        lifecycleDiagnostics.direct?.contents?.includes("lifecycle edit") &&
        lifecycleDiagnostics.resolved?.endsWith("fixture.txt") &&
        lifecycleDiagnostics.entryNames?.includes("fixture.txt") &&
        lifecycleDiagnostics.mediaPrefix?.startsWith(
          "data:image/png;base64,",
        ) &&
        lifecycleDiagnostics.bash?.stdout?.includes("LOCAL_SESSIONS_BASH_OK") &&
        lifecycleDiagnostics.permissionSet === true &&
        lifecycleDiagnostics.directoriesAdded === true &&
        lifecycleDiagnostics.changedCwd?.cwd === workspace &&
        lifecycleDiagnostics.effort === "high" &&
        lifecycleDiagnostics.permissionMode === "auto" &&
        lifecycleDiagnostics.archived?.isArchived === true &&
        lifecycleDiagnostics.current?.isArchived === false &&
        lifecycleDiagnostics.current?.title === "Live lifecycle session" &&
        lifecycleDiagnostics.search?.some(
          (entry) => entry.sessionId === started.sessionId,
        ) &&
        lifecycleDiagnostics.projects?.some(
          (entry) => entry.path === workspace,
        ) &&
        lifecycleDiagnostics.trust?.trusted === true &&
        lifecycleDiagnostics.gitInfo?.branch === "main" &&
        lifecycleDiagnostics.gitDiff?.files?.some(
          (file) => file.filename === "fixture.txt",
        ) &&
        lifecycleDiagnostics.gitDiffStats?.fileCount >= 1 &&
        lifecycleDiagnostics.workingTree?.files?.some(
          (file) => file.path === "fixture.txt",
        ) &&
        lifecycleDiagnostics.uncommitted?.includes("fixture.txt") &&
        lifecycleDiagnostics.dirty === true &&
        lifecycleDiagnostics.branches?.includes("main") &&
        lifecycleDiagnostics.commits?.length >= 1 &&
        lifecycleDiagnostics.allCount >= 1,
      `LocalSessions lifecycle adapters failed: ${JSON.stringify(lifecycleDiagnostics)}`,
    );
  }
  let terminalDiagnostics = null;
  if (terminalMode) {
    const terminalReady = await evaluateEventually(
      debuggerPort,
      `(async () => {
        const visible = element =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden";
        const terminalButton = [...document.querySelectorAll("button")].find(button =>
          visible(button) && button.getAttribute("aria-label") === "Terminal"
        );
        if (!terminalButton) throw new Error("Native Terminal button was not found");
        let terminalVisible = [...document.querySelectorAll(".xterm")].some(visible);
        if (!terminalVisible) terminalButton.click();
        const deadline = Date.now() + 20000;
        let buffer = null;
        let terminalInput = null;
        while ((buffer === null || !terminalInput) && Date.now() < deadline) {
          buffer = await window["claude.web"].LocalSessions.getShellPtyBuffer(${JSON.stringify(started.sessionId)});
          terminalInput = document.querySelector(".xterm-helper-textarea");
          terminalVisible = [...document.querySelectorAll(".xterm")].some(visible);
          if (buffer === null || !terminalInput)
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (buffer === null) throw new Error("Native terminal did not acquire its PTY");
        if (!terminalInput) throw new Error("Native terminal input did not mount");
        await new Promise(resolve => setTimeout(resolve, 500));
        terminalInput.focus();
        return {
          buffer,
          terminalVisible,
          inputFocused: document.activeElement === terminalInput
        };
      })()`,
      25_000,
    );
    assert(
      terminalReady.terminalVisible === true && terminalReady.inputFocused,
      `Native terminal did not become keyboard-ready: ${JSON.stringify(terminalReady)}`,
    );
    const terminalTarget = await appTarget(debuggerPort);
    if (!terminalTarget?.webSocketDebuggerUrl)
      throw new Error("The app CDP target was unavailable for terminal input");
    await cdpCall(terminalTarget, "Input.insertText", {
      text: "Write-Output ('NATIVE_TERMINAL_' + 'EXECUTED')",
    });
    await cdpCall(terminalTarget, "Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Enter",
      code: "Enter",
      text: "\r",
      unmodifiedText: "\r",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    await cdpCall(terminalTarget, "Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    });
    terminalDiagnostics = await evaluateEventually(
      debuggerPort,
      `(async () => {
        const visible = element =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden";
        const deadline = Date.now() + 20000;
        let buffer = "";
        let terminalText = "";
        while (!buffer.includes("NATIVE_TERMINAL_EXECUTED") && Date.now() < deadline) {
          terminalText = document.querySelector(".xterm-rows")?.textContent || "";
          buffer = await window["claude.web"].LocalSessions.getShellPtyBuffer(
            ${JSON.stringify(started.sessionId)}
          ) || "";
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await new Promise(resolve => setTimeout(resolve, 750));
        const busy = await window["claude.web"].LocalSessions.getBusyShellPtyKeys(
          ${JSON.stringify(started.sessionId)}
        );
        const terminalVisible = [...document.querySelectorAll(".xterm")].some(visible);
        terminalText = document.querySelector(".xterm-rows")?.textContent || "";
        const surfaces = [...document.querySelectorAll(".xterm canvas")].map(canvas => ({
          width: canvas.width,
          height: canvas.height,
          visible: visible(canvas)
        }));
        const ptyEvents = (window.__localCodeEvents || []).filter(event =>
          event.type === "shell_pty_data" && event.sessionId === ${JSON.stringify(started.sessionId)}
        );
        const xterms = [...document.querySelectorAll(".xterm")].map(element => ({
          rect: element.getBoundingClientRect().toJSON(),
          visible: visible(element),
          classes: [...element.querySelectorAll("*")].slice(0, 30).map(child => child.className),
          html: element.outerHTML.slice(0, 5000)
        }));
        const screenRect = document.querySelector(".xterm-screen")?.getBoundingClientRect().toJSON();
        return {
          terminalText,
          buffer,
          busy,
          terminalVisible,
          surfaces,
          xterms,
          screenRect,
          ptyEventCount: ptyEvents.length
        };
      })()`,
      25_000,
    );
    const screenshot = await captureScreenshot(
      debuggerPort,
      terminalDiagnostics.screenRect,
    );
    terminalDiagnostics.pixelStats = await screenshotPixelStats(
      screenshot.target,
      screenshot.data,
    );
    terminalDiagnostics.screenshotBytes = Buffer.from(
      screenshot.data,
      "base64",
    ).length;
    assert(
      terminalDiagnostics.buffer.includes("NATIVE_TERMINAL_EXECUTED") &&
        terminalDiagnostics.terminalVisible === true &&
        terminalDiagnostics.pixelStats?.distinctColors > 10 &&
        terminalDiagnostics.pixelStats?.nonDominantPixels > 500 &&
        terminalDiagnostics.pixelStats?.brightPixels > 100 &&
        terminalDiagnostics.ptyEventCount > 0 &&
        terminalDiagnostics.busy?.live?.includes(started.sessionId) &&
        terminalDiagnostics.busy?.probed === true,
      `Native terminal did not render PTY output: ${JSON.stringify(terminalDiagnostics)}`,
    );
  }
  const thinkingViewDiagnostics = !realMode
    ? await evaluateEventually(
        debuggerPort,
        `(async () => {
          const visible = element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          const candidates = [...document.querySelectorAll('button[aria-label="Session actions"], button[aria-label="More actions"]')].filter(visible);
          let option = null;
          for (const candidate of candidates) {
            candidate.click();
            await new Promise(resolve => setTimeout(resolve, 150));
            const transcriptView = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], button')]
              .find(element => visible(element) && /transcript view/i.test(element.textContent?.trim() || ""));
            if (transcriptView) {
              transcriptView.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
              transcriptView.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
              transcriptView.click();
            }
            const optionDeadline = Date.now() + 1500;
            while (!option && Date.now() < optionDeadline) {
              option = [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], button')]
                .find(element => visible(element) && element.textContent?.trim() === "Thinking");
              if (!option) await new Promise(resolve => setTimeout(resolve, 50));
            }
            if (option) break;
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          }
          const opened = Boolean(option);
          option?.click();
          const deadline = Date.now() + 5000;
          while (!document.body?.innerText?.includes(${JSON.stringify(expectedReasoning)}) && Date.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 50));
          return {
            opened,
            reasoningVisible: document.body?.innerText?.includes(${JSON.stringify(expectedReasoning)}) || false,
            moreActionsCount: candidates.length,
            buttons: [...document.querySelectorAll("button")]
              .filter(visible)
              .map(button => ({
                text: button.textContent?.trim().slice(0, 80),
                ariaLabel: button.getAttribute("aria-label"),
                title: button.getAttribute("title")
              }))
              .filter(button => button.text || button.ariaLabel || button.title)
              .slice(0, 120)
          };
        })()`,
        12_000,
      )
    : null;
  if (!realMode) {
    assert(
      requests.length === (toolPermissionMode ? 2 : 3),
      `Expected ${toolPermissionMode ? "two" : "three"} model turns, got ${requests.length}`,
    );
    assert(
      requests[0].tools?.some((tool) => tool.function?.name === "Read") &&
        requests[0].tools?.some(
          (tool) => tool.function?.name === "mcp__desktop__present_artifact",
        ),
      "Code and desktop artifact tools were not exposed to the provider",
    );
    assert(
      requests[1].messages?.some(
        (message) =>
          message.role === "tool" &&
          (toolPermissionMode
            ? message.tool_call_id === "call_permission_bash" &&
              message.content?.includes("permission proof")
            : message.tool_call_id === "call_read_fixture" &&
              message.content?.includes("native Code renderer proof phrase")),
      ),
      `${toolPermissionMode ? "Bash" : "Read"} result was not returned to the provider`,
    );
    assert(
      rendered.thinkingBlocks?.some((thinking) =>
        /request approval|inspect fixture\.txt/i.test(thinking),
      ),
      `Provider reasoning was not preserved in the native Code transcript: ${JSON.stringify(rendered.thinkingBlocks)}`,
    );
    assert(
      thinkingViewDiagnostics?.opened &&
        thinkingViewDiagnostics?.reasoningVisible,
      `Native Code Thinking transcript view did not expose provider reasoning: ${JSON.stringify(thinkingViewDiagnostics)}`,
    );
  }
  if (!toolPermissionMode)
    assert(
      proof.includes("native Code renderer proof phrase") &&
        (!allToolsMode || proof.includes("phase=two")),
      `The model-requested proof file was not written correctly: ${JSON.stringify({ proof, toolNames: rendered.toolNames, transcriptTypes: rendered.transcriptTypes })}`,
    );
  if (bypassMode)
    assert(
      rendered.session?.permissionMode === "bypassPermissions" &&
        rendered.session?.pendingToolPermissions?.length === 0,
      `Bypass permissions did not survive native session start: ${JSON.stringify(rendered.session)}`,
    );
  if (allToolsMode) {
    for (const tool of [
      "Glob",
      "Grep",
      "Read",
      "Write",
      "Edit",
      "Bash",
      "Artifact",
      "mcp__desktop__present_artifact",
    ])
      assert(
        rendered.toolNames?.includes(tool),
        `Live all-tools session did not execute ${tool}: ${JSON.stringify(rendered.toolNames)}`,
      );
    const store = JSON.parse(
      await readFile(path.join(profile, "local-code-sessions.json"), "utf8"),
    );
    const stored = store.sessions?.find(
      (session) => session.sessionId === started.sessionId,
    );
    assert(
      stored?.artifacts?.some(
        (artifact) => artifact.title === "SDK Artifact Proof",
      ) &&
        stored?.artifacts?.some(
          (artifact) => artifact.title === "MCP Artifact Proof",
        ),
      "Both Code artifact adapters did not persist artifacts",
    );
  }
  assert(
    rendered.rendered &&
      rendered.session?.isRunning === false &&
      (toolPermissionMode
        ? rendered.toolNames?.includes("Bash")
        : rendered.toolNames?.includes("Read") &&
          rendered.toolNames?.includes("Write")) &&
      rendered.transcriptTypes?.includes("result"),
    `Native Code session did not render the completed tool loop: ${JSON.stringify(rendered)}`,
  );
  if (realMode)
    assert(
      rendered.reconnectingHtml.length === 0,
      `Completed local session remained in reconnecting state: ${JSON.stringify(rendered.reconnectingHtml)}`,
    );
  let reloadDiagnostics = null;
  if (realMode) {
    await evaluateEventually(
      debuggerPort,
      `(() => { location.reload(); return true; })()`,
    ).catch(() => undefined);
    reloadDiagnostics = await evaluateEventually(
      debuggerPort,
      `(async () => {
        const deadline = Date.now() + 30000;
        while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        let session;
        let transcript = [];
        while (Date.now() < deadline) {
          session = await window["claude.web"].LocalSessions.getSession(${JSON.stringify(started.sessionId)});
          transcript = await window["claude.web"].LocalSessions.getTranscript(${JSON.stringify(started.sessionId)});
          const hydrated = transcript.some(message => message.type === "assistant" && Array.isArray(message.message?.content) && message.message.content.some(block => block.type === "text" && block.text?.includes(${JSON.stringify(expectedReply)})));
          if (session?.isRunning === false && hydrated && document.body?.innerText?.includes(${JSON.stringify(expectedReply)})) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return {
          path: location.pathname,
          session,
          transcriptTypes: transcript.map(message => message.type),
          transcriptHydrated: transcript.some(message => message.type === "assistant" && Array.isArray(message.message?.content) && message.message.content.some(block => block.type === "text" && block.text?.includes(${JSON.stringify(expectedReply)}))),
          hydrated: document.body?.innerText?.includes(${JSON.stringify(expectedReply)}) && document.body?.innerText?.includes("Live lifecycle session"),
          reconnecting: document.body?.innerText?.includes("Reconnecting") || false,
          bodyText: document.body?.innerText?.slice(0, 4000) || ""
        };
      })()`,
      35_000,
    );
    assert(
      reloadDiagnostics.hydrated &&
        reloadDiagnostics.transcriptHydrated &&
        reloadDiagnostics.session?.isRunning === false &&
        reloadDiagnostics.session?.title === "Live lifecycle session" &&
        reloadDiagnostics.reconnecting === false,
      `Code session did not hydrate cleanly after reload: ${JSON.stringify(reloadDiagnostics)}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        realMode,
        sessionId: started.sessionId,
        requestCount: requests.length,
        toolNames: rendered.toolNames,
        transcriptTypes: rendered.transcriptTypes,
        proofPath,
        permissionDiagnostics,
        terminalDiagnostics,
        thinkingViewDiagnostics,
        lifecycleDiagnostics,
        reloadDiagnostics,
        nativeRendererText: rendered.bodyText.slice(0, 1200),
        reconnectingHtml: rendered.reconnectingHtml,
      },
      null,
      2,
    )}\n`,
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
  await new Promise((resolve) => provider.close(resolve));
  for (const directory of [profile, workspace]) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(directory, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }
}
