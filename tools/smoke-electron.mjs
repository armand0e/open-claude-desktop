import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import electron from "electron";

const mode = process.argv[2] === "local" ? "local" : "hosted";
// The local shell advertises the retained desktop version (spoofed so the
// renderer's desktop-semver gates pass), not the package version.
const retainedDesktopVersion = (
  await readFile("src/shared/desktop-version.ts", "utf8")
).match(/RETAINED_DESKTOP_VERSION\s*=\s*"([^"]+)"/)?.[1];

async function unusedPort() {
  const server = createServer();
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

async function waitForTargets(port, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Electron exited before smoke was ready (${child.exitCode})`,
      );
    try {
      const targets = await targetsAt(port);
      const shell = targets.find(
        (target) =>
          target.type === "page" && target.url.includes("/dist/index.html"),
      );
      const view = targets.find(
        (target) =>
          target.type === "page" &&
          (mode === "local"
            ? target.url.startsWith("app://localhost")
            : target.url.includes("claude.ai")),
      );
      if (shell?.webSocketDebuggerUrl && view?.webSocketDebuggerUrl)
        return { shell, view };
    } catch {
      // DevTools starts after the Electron browser process binds its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${mode} Electron targets`);
}

async function evaluate(target, expression) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    const id = 1;
    const result = await new Promise((resolve, reject) => {
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(
        JSON.stringify({
          id,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "CDP evaluation failed",
      );
    }
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function evaluateEventually(port, selectTarget, expression) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = (await targetsAt(port)).find(selectTarget);
      if (target?.webSocketDebuggerUrl)
        return await evaluate(target, expression);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw (
    lastError ??
    new Error("Timed out waiting for a stable renderer execution context")
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const port = await unusedPort();
const profile = await mkdtemp(
  path.join(os.tmpdir(), `claude-reconstruction-${mode}-`),
);
const stderr = [];
const childEnvironment = {
  ...process.env,
  CLAUDE_LOCAL_USER_DATA_DIR: profile,
  CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
};
if (mode === "local") delete childEnvironment.CLAUDE_DESKTOP_LOCAL_UI;
else childEnvironment.CLAUDE_DESKTOP_LOCAL_UI = "0";
const child = spawn(electron, [".", `--remote-debugging-port=${port}`], {
  cwd: process.cwd(),
  windowsHide: false,
  stdio: ["ignore", "pipe", "pipe"],
  env: childEnvironment,
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

try {
  await waitForTargets(port, child);
  const shellResult = await evaluateEventually(
    port,
    (target) =>
      target.type === "page" && target.url.includes("/dist/index.html"),
    `(async () => {
    const deadline = Date.now() + 15000;
    while ((!window["claude.settings"] || !window["claude.internal.ui"]) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return {
    url: location.href,
    appVersion: window.process?.version,
    settings: Object.keys(window["claude.settings"] || {}).length,
    hybrid: Object.keys(window["claude.hybrid"] || {}).length,
    internalUi: Object.keys(window["claude.internal.ui"] || {}).length
    };
  })()`,
  );
  const viewResult = await evaluateEventually(
    port,
    (target) =>
      target.type === "page" &&
      (mode === "local"
        ? target.url.startsWith("app://localhost")
        : target.url.includes("claude.ai")),
    `(async () => {
    const deadline = Date.now() + 20000;
    while ((
      !window["claude.web"] ||
      !window["claude.settings"]?.AppFeatures ||
      (document.body?.innerText?.length || 0) <= 20 ||
      false
    ) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    ${
      mode === "local"
        ? `await new Promise(resolve => setTimeout(resolve, 5000));
    const chatButton = [...document.querySelectorAll("button")].find(element => element.getAttribute("aria-label") === "Chat");
    chatButton?.click();
    const chatDeadline = Date.now() + 10000;
    while (location.pathname !== "/new" && Date.now() < chatDeadline) await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => setTimeout(resolve, 2000));`
        : ""
    }
    return {
    url: location.href,
    title: document.title,
    bodyLength: document.body?.innerText?.length || 0,
    bodyText: document.body?.innerText?.slice(0, 2000) || "",
    textareas: [...document.querySelectorAll("textarea")].map(element => ({
      placeholder: element.getAttribute("placeholder"),
      ariaLabel: element.getAttribute("aria-label")
    })),
    contentEditables: [...document.querySelectorAll('[contenteditable="true"]')].map(element => ({
      text: element.textContent?.slice(0, 100),
      ariaLabel: element.getAttribute("aria-label"),
      dataPlaceholder: element.getAttribute("data-placeholder")
    })),
    navigationLinks: [...document.querySelectorAll("a[href]")]
      .map(element => ({ href: element.getAttribute("href"), text: element.textContent?.trim().slice(0, 80) }))
      .filter(link => link.text),
    buttons: [...document.querySelectorAll("button")]
      .map(element => ({ text: element.textContent?.trim().slice(0, 80), ariaLabel: element.getAttribute("aria-label") }))
      .filter(button => button.text || button.ariaLabel),
    web: Object.keys(window["claude.web"] || {}).length,
    settings: Object.keys(window["claude.settings"] || {}).length,
    hybrid: Object.keys(window["claude.hybrid"] || {}).length,
    electronWindow: Object.keys(window.electron_window || {}).length,
    fileSystemMethods: Object.keys(window["claude.web"]?.FileSystem || {}).length,
    featureCount: Object.keys(await window["claude.settings"].AppFeatures.getSupportedFeatures()).length
    ,localClaude: Boolean(window.localClaude)
    ,localWorkbench: Boolean(document.querySelector("#local-claude-workbench")?.shadowRoot?.querySelector('[aria-label="Model settings"]'))
    ,diagnosticReportVisible: document.body?.innerText?.includes("Diagnostic Report") || false
    ,visibleLocalAccountElement: (() => {
      const element = [...document.querySelectorAll("button")].find(button =>
        button.textContent?.includes("Local User") &&
        button.getClientRects().length > 0 &&
        getComputedStyle(button).visibility !== "hidden"
      );
      return element?.parentElement?.outerHTML?.slice(0, 4000) || null;
    })()
    };
  })()`,
  );

  assert(
    shellResult.url.includes("/dist/index.html"),
    "Shell did not load the exact local renderer",
  );
  assert(
    shellResult.appVersion === retainedDesktopVersion,
    `Unexpected desktop version ${shellResult.appVersion}`,
  );
  assert(
    shellResult.settings === 15 &&
      shellResult.hybrid === 1 &&
      shellResult.internalUi === 3,
    "Shell contract counts differ",
  );
  // The retained reference exposes 44 web services. Open-Claude intentionally
  // removes the ten Cowork/VM services at the preload boundary, leaving 34.
  assert(
    viewResult.web === 34 &&
      viewResult.settings === 15 &&
      viewResult.hybrid === 1 &&
      viewResult.electronWindow === 1,
    `View contract counts differ: ${JSON.stringify({
      web: viewResult.web,
      settings: viewResult.settings,
      hybrid: viewResult.hybrid,
      electronWindow: viewResult.electronWindow,
    })}`,
  );
  assert(
    viewResult.fileSystemMethods === 18,
    "FileSystem contract is incomplete",
  );
  assert(
    viewResult.featureCount === 33,
    `Feature matrix is incomplete: expected 33, received ${viewResult.featureCount}`,
  );
  if (mode === "local") {
    assert(
      viewResult.url.startsWith("app://localhost/"),
      "Local SPA origin differs",
    );
    assert(
      viewResult.title === "Claude" && viewResult.bodyLength > 20,
      "Local SPA did not render",
    );
    assert(
      viewResult.localClaude && viewResult.localWorkbench,
      "Local provider controls did not load",
    );
    assert(
      !viewResult.diagnosticReportVisible,
      "Local UI is blocked by the diagnostic report modal",
    );
    assert(
      viewResult.visibleLocalAccountElement === null,
      "Local UI still exposes the hosted account menu",
    );
  } else {
    assert(
      viewResult.url.includes("claude.ai"),
      "Hosted view did not reach claude.ai",
    );
    assert(viewResult.bodyLength > 20, "Hosted SPA did not render");
  }
  const errors = stderr.join("");
  assert(
    !errors.includes("failed recovered validation"),
    "Hosted client hit a recovered IPC argument validation failure",
  );
  process.stdout.write(
    `${JSON.stringify({ mode, shell: shellResult, view: viewResult }, null, 2)}\n`,
  );
  if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
    process.stderr.write(stderr.join(""));
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
