// Probe: dictation must transcribe WHILE recording (streaming partials),
// not only after the mic is toggled off. Uses Chromium's fake audio device;
// asserts multiple /api/local/dictation/transcribe calls occur while the
// recorder is still running, then a final pass on stop, with the button
// returning to idle and no error surfaced.
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

const provider = createHttpServer((request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve, reject) =>
  provider.listen(0, "127.0.0.1", resolve).once("error", reject),
);
const providerPort = provider.address().port;

const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-dictation-"));
const output = [];
const child = spawn(
  electron,
  [
    ".",
    `--remote-debugging-port=${debuggerPort}`,
    "--use-fake-device-for-media-capture",
    "--use-fake-ui-for-media-capture",
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
  const started = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      let button;
      while (Date.now() < deadline) {
        button = document.querySelector('[data-testid="local-dictate-button"]');
        if (button) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!button) throw new Error("Dictate button did not render");
      // Preload fetches are invisible here; the dictation code announces
      // each transcription pass as a DOM event instead.
      if (!window.__dictationProbe) {
        window.__dictationProbe = { during: 0, after: 0 };
        document.addEventListener("local-dictation-pass", (event) => {
          if (event.detail?.phase === "final") window.__dictationProbe.after += 1;
          else window.__dictationProbe.during += 1;
        });
      }
      button.title = "Dictate (on-device transcription)";
      button.click();
      const stateDeadline = Date.now() + 5000;
      while (button.dataset.state !== "recording" && Date.now() < stateDeadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      return { state: button.dataset.state ?? null, title: button.title };
    })()`,
  );
  assert(
    started?.state === "recording",
    `Recording did not start: ${JSON.stringify(started)}`,
  );

  const streamed = await evaluateEventually(
    debuggerPort,
    `(async () => {
      // Two partial cadences plus transcription time.
      await new Promise(resolve => setTimeout(resolve, 9000));
      const button = document.querySelector('[data-testid="local-dictate-button"]');
      return {
        during: window.__dictationProbe.during,
        state: button?.dataset.state ?? null,
      };
    })()`,
    30_000,
  );
  assert(
    streamed.state === "recording",
    `Recorder stopped early: ${JSON.stringify(streamed)}`,
  );
  assert(
    streamed.during >= 2,
    `Expected >=2 partial transcriptions while recording, saw ${streamed.during}`,
  );

  const stopped = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const button = document.querySelector('[data-testid="local-dictate-button"]');
      button.click();
      const deadline = Date.now() + 30000;
      while (button.dataset.state && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      return {
        state: button.dataset.state ?? null,
        after: window.__dictationProbe.after,
        during: window.__dictationProbe.during,
        title: button.title,
      };
    })()`,
    45_000,
  );
  console.log("dictation probe:", JSON.stringify(stopped, null, 2));
  assert(stopped.state === null, "Button did not return to idle after stop");
  assert(stopped.after >= 1, "No final transcription pass ran on stop");
  assert(
    stopped.title === "Dictate (on-device transcription)",
    `An error surfaced on the button: ${stopped.title}`,
  );

  console.log(
    `PROBE PASS: dictation streamed ${stopped.during} partial transcriptions while recording`,
  );
} catch (error) {
  console.error("PROBE FAIL:", error.message);
  console.error(output.join("").slice(-4000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
}
