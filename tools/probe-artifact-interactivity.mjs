// Probe: artifact scripts actually EXECUTE — the chat pane's artifact
// contains a counter button; click it inside the sandbox frame and assert
// the DOM updates. Guards the srcdoc-CSP class of bug where artifacts
// render but their scripts are silently blocked.
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
  if (!response.ok) throw new Error(`CDP ${response.status}`);
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
        result.exceptionDetails.exception?.description ?? "CDP eval failed",
      );
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function evaluateInAppPage(port, expression, timeout = 60_000) {
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
  throw lastError ?? new Error("Timed out");
}

// Find the frame target that can see the artifact button, regardless of how
// origins nest (artifacts.local renderer vs its inner srcdoc frame).
async function findArtifactFrame(port, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const candidates = (await targetsAt(port)).filter(
      (candidate) =>
        candidate.url.startsWith("app://artifacts.local") ||
        candidate.url === "about:srcdoc",
    );
    for (const candidate of candidates) {
      if (!candidate.webSocketDebuggerUrl) continue;
      try {
        const probe = await evaluate(
          candidate,
          `(() => {
            const local = document.getElementById("counter");
            if (local) return { where: "self", text: local.textContent };
            for (let i = 0; i < window.frames.length; i++) {
              try {
                const nested = window.frames[i].document.getElementById("counter");
                if (nested) return { where: "child", text: nested.textContent };
              } catch { /* cross-origin child */ }
            }
            return null;
          })()`,
        );
        if (probe) return { target: candidate, probe };
      } catch {
        // Frame not ready yet.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("No frame containing the artifact button was found");
}

const requests = [];
const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const hasToolResult = requests
      .at(-1)
      .messages.some((message) => message.role === "tool");
    if (!hasToolResult) {
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_interactive_artifact",
                    function: {
                      name: "artifacts",
                      arguments: JSON.stringify({
                        command: "create",
                        id: "interactive-artifact-probe",
                        title: "Interactivity Proof",
                        type: "text/html",
                        content:
                          '<!doctype html><html><body><h1>Interactivity Proof</h1><button id="counter">Count: 0</button><script>let count=0;document.getElementById("counter").addEventListener("click",()=>{count+=1;document.getElementById("counter").textContent="Count: "+count;});<\/script></body></html>',
                      }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
    } else {
      response.write(
        `data: ${JSON.stringify({
          choices: [{ delta: { content: "Artifact ready to try." } }],
        })}\n\n`,
      );
    }
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-artifact-int-"));
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
  const sent = await evaluateInAppPage(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      let editor = null;
      while (Date.now() < deadline) {
        editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
        if (editor) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!editor) return { failed: "no-composer" };
      editor.focus();
      document.execCommand("insertText", false, "make an interactive artifact");
      await new Promise(resolve => setTimeout(resolve, 400));
      [...document.querySelectorAll("button")].find(b =>
        /send message/i.test(b.getAttribute("aria-label") || "") && !b.disabled)?.click();
      return { sent: true };
    })()`,
    90_000,
  );
  assert(sent?.sent, sent?.failed ?? "Message was not sent");

  const found = await findArtifactFrame(debuggerPort);
  assert(
    /^Count: 0$/.test(found.probe.text ?? ""),
    `Unexpected initial button text: ${JSON.stringify(found.probe)}`,
  );

  const afterClick = await evaluate(
    found.target,
    `(async () => {
      const find = () => {
        const local = document.getElementById("counter");
        if (local) return local;
        for (let i = 0; i < window.frames.length; i++) {
          try {
            const nested = window.frames[i].document.getElementById("counter");
            if (nested) return nested;
          } catch { /* cross-origin child */ }
        }
        return null;
      };
      const button = find();
      if (!button) return { failed: "button-vanished" };
      button.click();
      button.click();
      await new Promise(resolve => setTimeout(resolve, 200));
      return { text: find()?.textContent };
    })()`,
  );
  assert(
    afterClick?.text === "Count: 2",
    `Artifact script did not react to clicks (CSP block?): ${JSON.stringify(afterClick)}`,
  );

  console.log(
    `PROBE PASS: artifact script executed — button in ${found.probe.where} frame advanced to "${afterClick.text}" after two clicks`,
  );
} catch (error) {
  console.error("PROBE FAIL:", error.message);
  console.error(output.join("").slice(-3000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  provider.close();
}
