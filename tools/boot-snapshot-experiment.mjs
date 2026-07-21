import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const outDir = process.argv[2];
await mkdir(outDir, { recursive: true });
const allPatchIds = process.argv[3];
const port = 9351;
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-newboot-"));
const child = spawn(electron, [".", `--remote-debugging-port=${port}`], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    CLAUDE_DESKTOP_LOCAL_UI: "1",
    CLAUDE_TRACE_LOCAL_API: "1",
    CLAUDE_ION_DIST:
      "C:\\ProgramData\\aranr\\AnthropicClaude\\app-1.22209.0\\resources\\ion-dist",
    CLAUDE_LOCAL_DISABLE_PATCHES: allPatchIds,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: false,
});
const logs = [];
child.stdout.setEncoding("utf8");
child.stdout.on("data", (c) => logs.push(c));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (c) => logs.push(c));
child.on("exit", (code) => console.log("app exited early:", code));

let ws;
let nextId = 1;
const pending = new Map();
async function connect() {
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json();
  const page = targets.find(
    (t) => t.type === "page" && t.url.startsWith("app://localhost"),
  );
  if (!page) throw new Error("no page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  });
}
function cdp(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(method + " timeout"));
      }
    }, 30000);
  });
}
async function evaluate(expression) {
  const r = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
    );
  return r.result?.value;
}

const deadline = Date.now() + 45000;
let ok = false;
while (!ok && Date.now() < deadline) {
  try {
    await connect();
    ok = true;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ok) {
  console.log("NO PAGE TARGET — app did not open a window");
  console.log(logs.join("").slice(-3000));
  child.kill();
  process.exit(1);
}
const state = await evaluate(
  `(async () => {
    await new Promise(r => setTimeout(r, 12000));
    return {
      url: location.href,
      title: document.title,
      bodyLength: document.body?.innerText?.length ?? 0,
      body: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 800),
    };
  })()`,
).catch((e) => ({ evalError: String(e) }));
await cdp("Page.enable").catch(() => undefined);
try {
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(
    path.join(outDir, "newbundle-boot.png"),
    Buffer.from(data, "base64"),
  );
  console.log("captured newbundle-boot");
} catch (e) {
  console.log("screenshot failed:", String(e));
}
console.log(JSON.stringify(state, null, 1).slice(0, 1400));
const text = logs.join("");
console.log("=== console errors ===");
console.log(
  text
    .split("\n")
    .filter((l) => /error|Error|failed|Failed/.test(l))
    .slice(0, 20)
    .join("\n")
    .slice(0, 2500),
);
child.kill();
await new Promise((r) => setTimeout(r, 300));
await rm(profile, { recursive: true, force: true }).catch(() => undefined);
