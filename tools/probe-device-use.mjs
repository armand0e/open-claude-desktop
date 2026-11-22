// Probe: browser use and computer use end to end — enable both toggles,
// let the mock provider navigate a real Chrome window to a local page,
// read it back, then capture a screen shot (never clicks or keys: probes
// must not inject input into the user's machine).
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const PAGE_MARKER = "Example Domain";

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

async function evaluateEventually(port, expression, timeout = 45_000) {
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

// Use a stable public page. Browser Use deliberately blocks loopback/private
// destinations at its forward proxy, so a local fixture would only exercise
// the SSRF guard rather than a successful navigation and read.
const siteUrl = "https://example.com/";

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
    const parsed = JSON.parse(body);
    requests.push(parsed);
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const toolMessages = parsed.messages.filter(
      (message) => message.role === "tool",
    );
    const toolCall = (name, args) => {
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: `call_${name}_${toolMessages.length}`,
                    function: { name, arguments: JSON.stringify(args) },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
    };
    if (toolMessages.length === 0)
      toolCall("browser_navigate", { url: siteUrl });
    else if (toolMessages.length === 1) toolCall("browser_read_page", {});
    else if (toolMessages.length === 2) toolCall("computer_screenshot", {});
    else {
      const shot = toolMessages
        .map((message) => String(message.content))
        .join("\n")
        .match(/\/api\/local\/computer\/shots\/\S+\.png/)?.[0];
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                content: shot
                  ? `Device run complete. ![screen](${shot})`
                  : "NO-SHOT-LINK",
              },
            },
          ],
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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-device-use-"));
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
  const result = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      let editor;
      while (Date.now() < deadline) {
        editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
        if (editor && location.pathname === "/new") break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!editor) throw new Error("Composer did not render");
      await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_browser_use: true, enabled_computer_use: true }),
      });
      editor.focus();
      document.execCommand("insertText", false, "probe the device tools");
      await new Promise(resolve => setTimeout(resolve, 400));
      [...document.querySelectorAll("button")].find(b =>
        /send message/i.test(b.getAttribute("aria-label") || "") && !b.disabled)?.click();
      const doneDeadline = Date.now() + 90000;
      while (Date.now() < doneDeadline) {
        const text = document.body?.innerText || "";
        if (text.includes("Device run complete") || text.includes("NO-SHOT-LINK")) break;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      await new Promise(resolve => setTimeout(resolve, 1200));
      // Completed chains collapse; expand to audit the tool rows.
      const chainToggle = [...document.querySelectorAll("button")].find(b =>
        b.getClientRects().length > 0 &&
        /Worked|Thought|steps|tool/i.test(b.textContent || "") &&
        b.getAttribute("aria-expanded") === "false");
      chainToggle?.click();
      await new Promise(resolve => setTimeout(resolve, 700));
      // Images sit behind the client's "Show Image" reveal.
      [...document.querySelectorAll("button")].find(b =>
        /show image/i.test(b.textContent || ""))?.click();
      await new Promise(resolve => setTimeout(resolve, 900));
      const text = document.body?.innerText || "";
      const shotPath = text.match(/[/]api[/]local[/]computer[/]shots[/][^\\s)]+\\.png/)?.[0] ?? null;
      let imageOk = null;
      if (shotPath) {
        const response = await fetch(shotPath);
        imageOk = { status: response.status, type: response.headers.get("Content-Type") };
      }
      return {
        usedTools: /Used 3 tools/i.test(text),
        toolRows: (text.match(/Mcp tool/gi) || []).length,
        finalVisible: text.includes("Device run complete"),
        noShot: text.includes("NO-SHOT-LINK"),
        shotPath,
        imageOk,
      };
    })()`,
    120_000,
  );
  console.log(JSON.stringify(result, null, 2));
  assert(result.usedTools, "'Used 3 tools' group missing from the chain");
  assert(!result.noShot, "Screenshot link missing from tool results");
  assert(result.finalVisible, "Final message missing");
  assert(result.shotPath, "Screenshot path missing from the final message");
  assert(
    result.imageOk?.status === 200 && result.imageOk.type === "image/png",
    `Screenshot endpoint failed: ${JSON.stringify(result.imageOk)}`,
  );
  const readResult = requests
    .flatMap((request) => request.messages)
    .filter((message) => message.role === "tool")
    .map((message) => String(message.content))
    .join("\n");
  assert(
    readResult.includes(PAGE_MARKER),
    "browser_read_page did not return the test page content",
  );
  console.log(
    "PROBE PASS: browser use navigated and read a real page; computer use captured the screen",
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
