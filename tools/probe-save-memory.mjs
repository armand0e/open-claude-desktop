// Probe: saving a memory from chat must render exactly one native
// "Saved memory" chain row, in chain position (after the preceding thinking
// row), with no raw wrench "Save memory" pill and no Result chip — both
// while the completion settles and after a full reload of the persisted
// conversation.
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const memoryContent = "Prefers concise answers over long explanations.";
const finalText = "Done — saved that preference.";
const thinkingText = "I should store this preference in memory.";

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
    requests.push(JSON.parse(body));
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    const isToolResultTurn = requests
      .at(-1)
      .messages.some((message) => message.role === "tool");
    if (!isToolResultTurn) {
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: thinkingText } }] })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_save_memory_probe",
                    function: {
                      name: "save_memory",
                      arguments: JSON.stringify({
                        topic: "Preferences",
                        content: memoryContent,
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
        `data: ${JSON.stringify({ choices: [{ delta: { content: finalText } }] })}\n\n`,
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
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-save-memory-"));
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

const chainAudit = `(() => {
  const visible = element => element.getClientRects().length > 0;
  const nativeRows = [...document.querySelectorAll("[data-local-memory-content]")]
    .filter(visible);
  const bodyText = document.body?.innerText || "";
  const lines = bodyText.split("\\n").map(line => line.trim());
  const thinkingIndex = lines.findIndex(line =>
    /^(Thought (process|for)|Thinking)/.test(line) ||
    line.includes(${JSON.stringify(thinkingText)}));
  const savedRowIndex = lines.findIndex(line => line.includes("Saved memory"));
  // In-chain check: the row must precede the final assistant text within
  // the rendered message flow (the regression orphaned it above the chain,
  // detached from the message that produced it).
  let savedBeforeFinalText = null;
  if (nativeRows.length === 1) {
    const finalHost = [...document.querySelectorAll("*")].find(element =>
      visible(element) && element.children.length === 0 &&
      (element.textContent || "").includes(${JSON.stringify(finalText)}) &&
      !(element.textContent || "").includes("Claude responded"));
    if (finalHost) {
      const relation = nativeRows[0].compareDocumentPosition(finalHost);
      savedBeforeFinalText = Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING);
    }
  }
  const contextLines = savedRowIndex >= 0
    ? lines.slice(Math.max(0, savedRowIndex - 4), savedRowIndex + 5)
    : [];
  return {
    nativeRowCount: nativeRows.length,
    nativeRowText: nativeRows[0]?.textContent?.trim() ?? null,
    savedBeforeFinalText,
    wrenchPill: /(^|\\n)\\s*Save memory\\s*(\\n|$)/.test(bodyText),
    resultChip: lines.includes("Result"),
    savedRowIndex,
    thinkingIndex,
    contextLines,
    transientLabels: [...new Set(window.__transientLabels || [])],
    finalVisible: bodyText.includes(${JSON.stringify(finalText)}),
    path: location.pathname
  };
})()`;

try {
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
      // Sample the chain during streaming: neither the generic in-flight
      // "Using a MCP tool" label nor a raw wrench "Save memory" line may
      // ever paint, even for a frame the user can see.
      window.__transientLabels = [];
      const sampler = setInterval(() => {
        const text = document.body?.innerText || "";
        if (/Using a MCP tool/i.test(text)) window.__transientLabels.push("using-mcp-tool");
        if (/(^|\\n)\\s*Save memory\\s*(\\n|$)/.test(text)) window.__transientLabels.push("wrench-save-memory");
      }, 40);
      setTimeout(() => clearInterval(sampler), 20000);
      editor.focus();
      if (!document.execCommand("insertText", false, "add a memory that I prefer concise answers")) {
        editor.textContent = "add a memory that I prefer concise answers";
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

  const settled = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if ((document.body?.innerText || "").includes(${JSON.stringify(finalText)})) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      // Give the post-completion refetch time to re-render the chain.
      await new Promise(resolve => setTimeout(resolve, 3000));
      return ${chainAudit};
    })()`,
    45_000,
  );
  console.log("after streaming:", JSON.stringify(settled, null, 2));
  assert(settled.finalVisible, "Final assistant text did not render");
  assert(
    settled.nativeRowCount === 1,
    `Expected exactly one native Saved memory row, saw ${settled.nativeRowCount}`,
  );
  assert(!settled.wrenchPill, "Raw wrench 'Save memory' pill rendered");
  assert(!settled.resultChip, "A Result chip rendered for the memory save");
  assert(
    settled.savedBeforeFinalText === true,
    "Saved memory row is not positioned in the chain before the final text",
  );
  assert(
    settled.transientLabels.length === 0,
    `Transient labels flashed during streaming: ${settled.transientLabels.join(", ")}`,
  );

  const reloaded = await evaluateEventually(
    debuggerPort,
    `(async () => {
      if (!window.__saveMemoryProbeReloaded) {
        window.__saveMemoryProbeReloaded = true;
        location.reload();
        return null;
      }
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if ((document.body?.innerText || "").includes(${JSON.stringify(finalText)})) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      return ${chainAudit};
    })()`,
  );
  const persisted =
    reloaded ??
    (await evaluateEventually(
      debuggerPort,
      `(async () => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          if ((document.body?.innerText || "").includes(${JSON.stringify(finalText)})) break;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
        return ${chainAudit};
      })()`,
      45_000,
    ));
  console.log("after reload:", JSON.stringify(persisted, null, 2));
  assert(persisted.finalVisible, "Persisted conversation did not re-render");
  assert(
    persisted.nativeRowCount === 1,
    `Persisted render: expected one native Saved memory row, saw ${persisted.nativeRowCount}`,
  );
  assert(!persisted.wrenchPill, "Persisted render shows the wrench pill");
  assert(!persisted.resultChip, "Persisted render shows a Result chip");
  assert(
    persisted.savedBeforeFinalText === true,
    "Persisted Saved memory row is not in chain position",
  );

  console.log("PROBE PASS: save-memory chain row renders once, in place");
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
