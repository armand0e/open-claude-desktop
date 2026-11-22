import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

async function appTarget(port) {
  return (await targetsAt(port)).find(
    (candidate) =>
      candidate.type === "page" && candidate.url.startsWith("app://localhost"),
  );
}

async function cdpCall(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    return await new Promise((resolve, reject) => {
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(JSON.stringify({ id: 1, method, params }));
    });
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error("Timed out waiting for the Code renderer");
}

const requests = [];
let activeChildren = 0;
let maximumChildren = 0;
let releaseChildren;
const childGate = new Promise((resolve) => {
  releaseChildren = resolve;
});
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "background-probe-model" }] }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  const parsed = JSON.parse(body);
  requests.push(parsed);
  const system = String(parsed.messages?.[0]?.content ?? "");
  if (system.includes("background subagent launched")) {
    activeChildren += 1;
    maximumChildren = Math.max(maximumChildren, activeChildren);
    await childGate;
    const prompt = String(parsed.messages?.[1]?.content ?? "task");
    activeChildren -= 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: `Completed child report for ${prompt}`,
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 30 },
      }),
    );
    return;
  }

  const serialized = JSON.stringify(parsed.messages ?? []);
  const notificationCount = (serialized.match(/<background-task /g) ?? [])
    .length;
  const alreadyLaunched = serialized.includes("async_launched");
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          message: alreadyLaunched
            ? {
                role: "assistant",
                content:
                  notificationCount === 4
                    ? "PACKAGED_BACKGROUND_TASKS_OK"
                    : "Foreground work complete; waiting for background reports.",
              }
            : {
                role: "assistant",
                content: "Launching four independent background checks.",
                tool_calls: [1, 2, 3, 4].map((index) => ({
                  id: `call_packaged_background_${index}`,
                  type: "function",
                  function: {
                    name: "Task",
                    arguments: JSON.stringify({
                      description: `Packaged background ${index}`,
                      prompt: `packaged-background-${index}`,
                    }),
                  },
                })),
              },
        },
      ],
      usage: { prompt_tokens: 40, completion_tokens: 10 },
    }),
  );
});

const providerPort = await listen(provider);
const debuggerPort = await unusedPort();
const profile = await mkdtemp(
  path.join(os.tmpdir(), "open-claude-background-"),
);
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "open-claude-background-workspace-"),
);
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const output = [];
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
      CLAUDE_LOCAL_MODEL: "background-probe-model",
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
      const deadline = Date.now() + 30000;
      while (!window["claude.web"]?.LocalSessions || !window["claude.web"]?.ClaudeCode) {
        if (Date.now() >= deadline) throw new Error("Local Code APIs did not load");
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await window["claude.web"].ClaudeCode.patchUserSettings({ enableWorkflows: true });
      const settings = await window["claude.web"].ClaudeCode.resolveLocalSettings();
      if (settings?.enableWorkflows?.value !== true)
        throw new Error("Dynamic workflows did not persist");
      window.__backgroundEvents = [];
      window["claude.web"].LocalSessions.onOnEvent(event => {
        if (event?.message?.subtype?.startsWith("task_"))
          window.__backgroundEvents.push(event.message);
      });
      return window["claude.web"].LocalSessions.start({
        cwd: ${JSON.stringify(workspace)},
        message: "Launch four packaged background tasks",
        permissionMode: "bypassPermissions"
      });
    })()`,
    40_000,
  );
  assert(
    started?.sessionId,
    "Packaged LocalSessions.start returned no session",
  );

  const running = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const sessions = window["claude.web"].LocalSessions;
      const deadline = Date.now() + 30000;
      let transcript = [];
      while (Date.now() < deadline) {
        transcript = await sessions.getTranscript(${JSON.stringify(started.sessionId)});
        const starts = transcript.filter(message => message.subtype === "task_started");
        const running = transcript.filter(message =>
          message.subtype === "task_progress" && message.last_tool_name === "Starting agent"
        );
        if (starts.length === 4 && running.length >= 3) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const starts = transcript.filter(message => message.subtype === "task_started");
      const fourth = starts[3];
      if (!fourth) throw new Error("Four task_started rows were not emitted");
      await sessions.stopTask(${JSON.stringify(started.sessionId)}, fourth.task_id);
      const stoppedDeadline = Date.now() + 10000;
      while (Date.now() < stoppedDeadline) {
        transcript = await sessions.getTranscript(${JSON.stringify(started.sessionId)});
        if (transcript.some(message => message.subtype === "task_notification" && message.task_id === fourth.task_id && message.status === "stopped")) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {
        starts,
        fourth,
        stopped: transcript.some(message => message.subtype === "task_notification" && message.task_id === fourth.task_id && message.status === "stopped"),
        eventSubtypes: (window.__backgroundEvents || []).map(message => message.subtype)
      };
    })()`,
    40_000,
  );
  assert(
    running.starts?.length === 4,
    `Expected four starts: ${JSON.stringify(running)}`,
  );
  assert(
    running.stopped,
    `Queued fourth task did not stop: ${JSON.stringify(running)}`,
  );
  assert(
    maximumChildren === 3,
    `Expected three concurrent children, observed ${maximumChildren}`,
  );

  releaseChildren();
  const completed = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const sessions = window["claude.web"].LocalSessions;
      const deadline = Date.now() + 30000;
      let session;
      let transcript = [];
      while (Date.now() < deadline) {
        session = await sessions.getSession(${JSON.stringify(started.sessionId)});
        transcript = await sessions.getTranscript(${JSON.stringify(started.sessionId)});
        if (session?.isRunning === false && transcript.some(message => message.type === "result" && message.result === "PACKAGED_BACKGROUND_TASKS_OK")) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      history.pushState({}, "", "/epitaxy/${encodeURIComponent(started.sessionId)}");
      dispatchEvent(new PopStateEvent("popstate"));
      const renderDeadline = Date.now() + 10000;
      while (!document.body?.innerText?.includes("PACKAGED_BACKGROUND_TASKS_OK") && Date.now() < renderDeadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      const starts = transcript.filter(message => message.subtype === "task_started");
      const notifications = transcript.filter(message => message.subtype === "task_notification");
      const drillDown = await sessions.readCliTranscript(starts[0].task_id, 0, 100);
      return {
        session,
        transcriptTypes: transcript.map(message => message.type),
        subtypes: transcript.map(message => message.subtype).filter(Boolean),
        notifications,
        drillDownCount: drillDown.messages?.length,
        drillDownParents: drillDown.messages?.map(message => message.parent_tool_use_id),
        firstToolUseId: starts[0]?.tool_use_id,
        rendered: document.body?.innerText?.includes("PACKAGED_BACKGROUND_TASKS_OK") || false,
        bodyText: document.body?.innerText?.slice(-4000) || ""
      };
    })()`,
    45_000,
  );
  assert(
    completed.session?.isRunning === false && completed.rendered,
    `Native Code did not render the integrated result: ${JSON.stringify(completed)}`,
  );
  assert(
    completed.notifications?.length === 4 &&
      completed.notifications.filter((entry) => entry.status === "completed")
        .length === 3 &&
      completed.notifications.filter((entry) => entry.status === "stopped")
        .length === 1,
    `Wrong packaged task terminal states: ${JSON.stringify(completed.notifications)}`,
  );
  assert(
    completed.drillDownCount >= 2 &&
      completed.drillDownParents.every(
        (parent) => parent === completed.firstToolUseId,
      ),
    `Child transcript was not keyed to its parent tool: ${JSON.stringify(completed)}`,
  );
  assert(
    running.eventSubtypes.includes("task_started") &&
      running.eventSubtypes.includes("task_progress"),
    `Live task events did not reach the renderer: ${JSON.stringify(running)}`,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        packaged: Boolean(packagedExecutable),
        sessionId: started.sessionId,
        maximumChildren,
        requestCount: requests.length,
        terminalStatuses: completed.notifications.map((entry) => entry.status),
        eventSubtypes: running.eventSubtypes,
        drillDownCount: completed.drillDownCount,
        rendered: completed.rendered,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  releaseChildren();
  if (child.exitCode === null) child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  await new Promise((resolve) => provider.close(resolve));
  await Promise.all([
    rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    }),
    rm(workspace, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    }),
  ]);
}
