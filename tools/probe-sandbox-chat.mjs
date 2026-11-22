// Probe: chat-mode code execution end to end against real Docker — enable
// the capability, let the mock provider call bash_code_execution, and
// assert the chain row renders, the command really ran in the container,
// and the generated file downloads through the app protocol.
// Requires Docker running and the open-claude-sandbox image built (the
// probe enables the toggle, which kicks a build if needed, and waits).
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const proofText = "sandbox-proof-1234567890";
const command = [
  "test -f uploads/_open_claude_manifest.json",
  "if touch /root/open-claude-rootfs-leak 2>/dev/null; then echo ROOTFS-WRITABLE; exit 88; fi",
  "if curl --max-time 3 -fsS https://example.com >/dev/null 2>&1; then echo NETWORK-LEAK; exit 89; fi",
  `echo ${proofText} > proof.txt`,
  "cat proof.txt",
].join(" && ");

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
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    const toolMessage = parsed.messages.findLast(
      (message) => message.role === "tool",
    );
    if (!toolMessage) {
      const hasCodeTool = (parsed.tools || []).some(
        (tool) => tool.function?.name === "bash_code_execution",
      );
      if (!hasCodeTool) {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "TOOL-MISSING" } }] })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_sandbox_probe",
                    function: {
                      name: "bash_code_execution",
                      arguments: JSON.stringify({ command }),
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
    } else {
      // Echo the download link the tool result reported, like the model
      // would when handing the file to the user.
      const link = String(toolMessage.content).match(
        /\/api\/local\/sandbox\/files\/\S+/,
      )?.[0];
      const text = link
        ? `Wrote the file: [proof.txt](${link})`
        : `NO-LINK-FOUND in: ${String(toolMessage.content).slice(0, 300)}`;
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
      );
    }
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve, reject) =>
  provider.listen(0, "127.0.0.1", resolve).once("error", reject),
);
const providerPort = provider.address().port;

const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-sandbox-chat-"));
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
  const enabled = await evaluateEventually(
    debuggerPort,
    `(async () => {
      await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled_wiggle: true }),
      });
      await fetch("/api/local/sandbox/build", { method: "POST" });
      const deadline = Date.now() + 1800000;
      let status;
      while (Date.now() < deadline) {
        status = await fetch("/api/local/sandbox/status").then(r => r.json());
        if (status.image === "ready") return status;
        if (status.docker !== "ok") return status;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      return status;
    })()`,
    120_000,
  );
  assert(
    enabled?.docker === "ok" && enabled?.image === "ready",
    `Sandbox not ready: ${JSON.stringify(enabled)}`,
  );

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
      if (!editor || location.pathname !== "/new") throw new Error("Chat composer did not render at /new");
      editor.focus();
      if (!document.execCommand("insertText", false, "write a proof file and run it")) {
        editor.textContent = "write a proof file and run it";
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: "x" }));
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      const send = [...document.querySelectorAll("button")].find(button =>
        /send message/i.test(button.getAttribute("aria-label") || "") && !button.disabled);
      if (!send) throw new Error("Enabled send button not found");
      send.click();
      return { sent: true };
    })()`,
  );
  assert(submitted?.sent, "Prompt was not submitted");

  const rendered = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 90000;
      while (Date.now() < deadline) {
        const text = document.body?.innerText || "";
        if (text.includes("Wrote the file") || text.includes("TOOL-MISSING") || text.includes("NO-LINK-FOUND")) break;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      const text = document.body?.innerText || "";
      const anchor = [...document.querySelectorAll("a")].find(a =>
        a.href.includes("/api/local/sandbox/files/"));
      let downloaded = null;
      if (anchor) {
        const pathName = new URL(anchor.href).pathname;
        const response = await fetch(pathName);
        downloaded = {
          status: response.status,
          disposition: response.headers.get("Content-Disposition"),
          body: (await response.text()).trim(),
        };
      }
      return {
        toolMissing: text.includes("TOOL-MISSING"),
        noLink: text.includes("NO-LINK-FOUND"),
        workspaceRow: text.includes("File/data workspace"),
        finalVisible: text.includes("Wrote the file"),
        anchorFound: Boolean(anchor),
        downloaded,
      };
    })()`,
    120_000,
  );
  console.log("rendered:", JSON.stringify(rendered, null, 2));
  const initialRequest = requests[0];
  const systemPrompt = String(
    initialRequest?.messages?.find((message) => message.role === "system")
      ?.content || "",
  );
  const codeToolDescription = String(
    initialRequest?.tools?.find(
      (tool) => tool.function?.name === "bash_code_execution",
    )?.function?.description || "",
  );
  const toolResult = String(
    requests.at(-1)?.messages?.findLast((message) => message.role === "tool")
      ?.content || "",
  );
  assert(!rendered.toolMissing, "bash_code_execution missing from tools");
  assert(
    systemPrompt.includes(
      "This is not Code mode and not a general software-development environment",
    ),
    "Chat received no file-workspace scope boundary",
  );
  assert(
    systemPrompt.includes("Only files under /workspace persist between calls"),
    "Chat received an inaccurate sandbox persistence contract",
  );
  assert(
    codeToolDescription.includes(
      "must not be used for project development, dev servers, deployment, general browsing, or ordinary text-only answers",
    ),
    "Code tool description did not reinforce the chat-only scope",
  );
  assert(!rendered.noLink, "Tool result carried no download link");
  assert(
    !toolResult.includes("ROOTFS-WRITABLE"),
    "Sandbox root filesystem is writable",
  );
  assert(
    !toolResult.includes("NETWORK-LEAK"),
    "Offline sandbox reached the public internet",
  );
  assert(
    toolResult.includes(proofText),
    "Sandbox hardening checks prevented the bounded file task",
  );
  assert(
    rendered.workspaceRow,
    "'File/data workspace' chain row did not render",
  );
  assert(rendered.finalVisible, "Final assistant text did not render");
  assert(rendered.anchorFound, "Download link did not render as an anchor");
  assert(
    rendered.downloaded?.status === 200,
    `Download failed: ${JSON.stringify(rendered.downloaded)}`,
  );
  assert(
    rendered.downloaded.body === proofText,
    `Downloaded content mismatch: ${rendered.downloaded.body}`,
  );
  assert(
    (rendered.downloaded.disposition || "").includes("proof.txt"),
    "Download is not served as an attachment",
  );

  console.log(
    "PROBE PASS: chat file/data workspace works end to end in its sandbox",
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
