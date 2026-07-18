// Captures screenshots of the app's surfaces for visual comparison against
// reference-screenshots/. Writes PNGs to the directory given as argv[2].
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

const outDir = process.argv[2];
if (!outDir) throw new Error("usage: node tmp-visual-audit.mjs <outDir>");
await mkdir(outDir, { recursive: true });

const port = 9335;
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-visual-"));
await writeFile(
  path.join(profile, "local-scheduled-tasks.json"),
  JSON.stringify({
    version: 1,
    tasks: [
      {
        id: "seed-routine",
        name: "seed-routine",
        displayName: "Nightly digest",
        description: "Summarize overnight activity",
        prompt: "Summarize the repository",
        cronExpression: "0 3 * * *",
        cwd: os.tmpdir(),
        status: "active",
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        nextRunAt: null,
        runCount: 0,
      },
    ],
  }) + "\n",
  "utf8",
);
await writeFile(
  path.join(profile, "claude-local-desktop.json"),
  JSON.stringify({
    appConfig: {
      mcpServers: {
        "local-echo": { command: "node", args: ["--version"] },
      },
    },
  }) + "\n",
  "utf8",
);

const child = spawn(electron, [".", `--remote-debugging-port=${port}`], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    CLAUDE_DESKTOP_LOCAL_UI: "1",
  },
  stdio: "ignore",
  windowsHide: false,
});

async function pageTarget() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  return targets.find(
    (t) =>
      t.type === "page" &&
      t.url.startsWith("app://localhost") &&
      !t.url.startsWith("app://localhost/blank"),
  );
}

let ws = null;
let nextId = 1;
const pending = new Map();
async function connect() {
  const target = await pageTarget();
  if (!target) throw new Error("no page target");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
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
        reject(new Error(`${method} timed out`));
      }
    }, 30000);
  });
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text,
    );
  return result.result?.value;
}

async function shot(name) {
  const { data } = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(outDir, `${name}.png`), Buffer.from(data, "base64"));
  console.log(`captured ${name}`);
}

async function navigate(route, settle = 2500) {
  await evaluate(
    `(() => { history.pushState(history.state, "", ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); return true; })()`,
  );
  await new Promise((r) => setTimeout(r, settle));
}

const deadline = Date.now() + 40000;
let connected = false;
while (!connected && Date.now() < deadline) {
  try {
    await connect();
    connected = true;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!connected) throw new Error("Could not connect to app");

try {
  await evaluate(
    `(async () => {
      const deadline = Date.now() + 30000;
      while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
        await new Promise(r => setTimeout(r, 100));
      await new Promise(r => setTimeout(r, 2000));
      return true;
    })()`,
  );
  await cdp("Page.enable");

  // 1. Home (chat) surface.
  await shot("our-01-home");

  // 13. Composer plus menu on home.
  await evaluate(
    `(async () => {
      const plus = [...document.querySelectorAll("button")].find(el =>
        el.getClientRects().length > 0 &&
        /open attachments menu|attach|plus/i.test(el.getAttribute("aria-label") || "")) ||
        [...document.querySelectorAll('fieldset button, form button')].find(el =>
          el.getClientRects().length > 0 && (el.textContent || "").trim() === "");
      plus?.click();
      await new Promise(r => setTimeout(r, 900));
      return true;
    })()`,
  );
  await shot("our-13-composer-plus");
  await evaluate(
    `(() => { document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true; })()`,
  );
  await new Promise((r) => setTimeout(r, 600));

  // 2. Code dashboard.
  await navigate("/epitaxy", 3500);
  await shot("our-02-code-home");

  // 12. Code routines page.
  await navigate("/epitaxy/scheduled", 3000);
  await shot("our-12-code-scheduled");

  // 11. Home scheduled page (cowork variant route).
  await navigate("/scheduled", 3000);
  await shot("our-11-home-scheduled");

  // 15. Projects.
  await navigate("/projects", 3000);
  await shot("our-15-projects");

  // Settings dialog states. Open from the sidebar button.
  await navigate("/new", 2500);
  await evaluate(
    `(async () => {
      const button = document.querySelector('[data-testid="local-settings-sidebar-button"]');
      if (!button) throw new Error("settings button missing");
      button.click();
      await new Promise(r => setTimeout(r, 1500));
      return true;
    })()`,
  );
  await shot("our-03-settings-initial");

  const sections = [
    ["Connectors", "our-04-settings-connectors"],
    ["Memory", "our-09-settings-memory"],
    ["Extensions", "our-16-settings-extensions"],
    ["Developer", "our-17-settings-developer"],
    ["Claude Code", "our-18-settings-claude-code"],
  ];
  for (const [label, name] of sections) {
    const ok = await evaluate(
      `(async () => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')]
          .find(el => el.getBoundingClientRect().width > 0);
        if (!dialog) return false;
        const button = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
          .find(el => (el.querySelector('.truncate')?.textContent?.trim() || el.textContent?.trim()) === ${JSON.stringify(label)});
        if (!button) return false;
        button.click();
        await new Promise(r => setTimeout(r, 1600));
        return true;
      })()`,
    );
    if (ok) await shot(name);
    else console.log(`section ${label} not found`);
  }
} finally {
  child.kill();
  await new Promise((r) => setTimeout(r, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
