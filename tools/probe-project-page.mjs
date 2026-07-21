// Scratch probe: does the native project detail page render an upload
// control and the knowledge file list against the local backend?
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

async function evaluateEventually(port, expression, timeout = 40_000) {
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

const provider = createHttpServer((request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-project-page-"));
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
  const report = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      window.__projectRequests = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.includes("/projects")) window.__projectRequests.push({
          method: init?.method || (typeof input === "object" && input?.method) || "GET",
          url: url.slice(0, 140),
        });
        return originalFetch(input, init);
      };
      const project = await fetch("/api/organizations/local/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "KB probe project", description: "d" }),
      }).then(r => r.json());
      const form = new FormData();
      form.append("file", new File(["kb file body"], "kb-note.txt", { type: "text/plain" }));
      const initialUploadResponse = await fetch(\`/api/organizations/local/projects/\${project.uuid}/upload\`, { method: "POST", body: form });
      const initialUpload = {
        status: initialUploadResponse.status,
        body: await initialUploadResponse.text(),
      };
      const initialDocs = await fetch(\`/api/organizations/local/projects/\${project.uuid}/docs\`).then(r => r.json());
      history.pushState(history.state, "", \`/project/\${project.uuid}\`);
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
      await new Promise(resolve => setTimeout(resolve, 4000));
      const visible = el => el.getClientRects().length > 0;
      const text = document.body?.innerText || "";
      // Drive the knowledge card's own file input (not the chat composer's).
      const inputs = [...document.querySelectorAll('input[type="file"]')];
      const kbInput = inputs.find(el => el.id !== "chat-input-file-upload-onpage");
      let uploadDrive = null;
      if (kbInput) {
        const dt = new DataTransfer();
        dt.items.add(new File(["native upload proof body"], "native-upload.txt", { type: "text/plain" }));
        kbInput.files = dt.files;
        kbInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 4000));
        uploadDrive = {
          requestsAfter: window.__projectRequests.slice(),
          listsNativeUpload: (document.body?.innerText || "").includes("native-upload"),
          storedDocs: await fetch(\`/api/organizations/local/projects/\${project.uuid}/docs\`).then(r => r.json()),
        };
      }
      const text2 = document.body?.innerText || "";
      return {
        path: location.pathname,
        initialUpload,
        pageTail: text2.slice(400, 2600),
        hasFileInput: inputs.length,
        kbInputFound: Boolean(kbInput),
        initialDocs,
        uploadDrive,
        mentionsKbFile: text2.includes("kb-note.txt"),
      };
    })()`,
  );
  console.log(JSON.stringify(report, null, 2));
  assert(
    report.path.startsWith("/project/"),
    "Project detail route did not open",
  );
  assert(report.initialUpload?.status === 200, "Direct project upload failed");
  assert(
    report.initialDocs?.some((entry) => entry.file_name === "kb-note.txt"),
    "Uploaded project file was missing from the docs hydration contract",
  );
  assert(report.kbInputFound, "Project knowledge upload input is missing");
  assert(
    report.uploadDrive?.listsNativeUpload,
    "Native project upload did not render",
  );
  assert(
    report.mentionsKbFile,
    "Persisted project upload disappeared from the page",
  );
  assert(
    report.uploadDrive?.storedDocs?.some(
      (entry) => entry.file_name === "native-upload.txt",
    ),
    "Native project upload was not persisted",
  );
  console.log(
    "PROBE PASS: project uploads persist and hydrate through the native page",
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
