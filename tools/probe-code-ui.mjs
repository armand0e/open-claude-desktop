import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import electron from "electron";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function targetsAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok)
    throw new Error(`Target list returned HTTP ${response.status}`);
  return response.json();
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
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text ??
          "Evaluation failed",
      );
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function captureRuntime(target) {
  const events = [];
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      events.push({
        kind: "exception",
        text: details?.exception?.description ?? details?.text,
        url: details?.url,
        line: details?.lineNumber,
      });
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const values = (message.params?.args ?? []).map(
        (argument) => argument.value ?? argument.description ?? argument.type,
      );
      const joined = values.join(" ");
      if (/error|failed|exception|epitaxy|session/i.test(joined))
        events.push({
          kind: "console",
          type: message.params?.type,
          text: joined,
        });
    }
  });
  socket.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
  return {
    events,
    close() {
      socket.close();
    },
  };
}

async function waitForView(port, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `Electron exited before the probe was ready (${child.exitCode})`,
      );
    try {
      const target = (await targetsAt(port)).find(
        (candidate) =>
          candidate.type === "page" &&
          candidate.url.startsWith("app://localhost"),
      );
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Chromium publishes the target list shortly after binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the local Claude view");
}

const port = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-code-probe-"));
const directRoute = process.argv.find((argument) => argument.startsWith("/"));
const clickNewSession = process.argv.includes("--new-session");
const startSession = process.argv.includes("--start-session");
const clickCustomize = process.argv.includes("--click-customize");
const clickArtifacts = process.argv.includes("--click-artifacts");
const stderr = [];
const child = spawn(electron, [".", `--remote-debugging-port=${port}`], {
  cwd: process.cwd(),
  windowsHide: false,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    CLAUDE_LOCAL_USER_DATA_DIR: profile,
    CLAUDE_LOCAL_SKIP_UI_SNAPSHOT: "1",
    CLAUDE_TRACE_CODE_IPC: "1",
  },
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => stderr.push(chunk));

try {
  let target = await waitForView(port, child);
  const runtime = await captureRuntime(target);
  if (directRoute) {
    await evaluate(
      target,
      `location.assign(${JSON.stringify(new URL(directRoute, "app://localhost").toString())})`,
    ).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    target = await waitForView(port, child);
  }
  let startedSessionId = null;
  if (startSession) {
    const started = await evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 20000;
        while (!window["claude.web"]?.LocalSessions && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        return window["claude.web"].LocalSessions.start({
          cwd: ${JSON.stringify(process.cwd())},
          message: "Inspect this workspace and briefly describe it.",
          permissionMode: "bypassPermissions"
        });
      })()`,
    );
    startedSessionId = started?.sessionId ?? null;
    if (startedSessionId) {
      await evaluate(
        target,
        `location.assign(${JSON.stringify("app://localhost/epitaxy/")} + encodeURIComponent(${JSON.stringify(startedSessionId)}))`,
      ).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      target = await waitForView(port, child);
    }
  }
  const result = await evaluate(
    target,
    `(async () => {
      const deadline = Date.now() + 20000;
      while ((!window["claude.web"] || (document.body?.innerText?.length || 0) < 20) && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      await new Promise(resolve => setTimeout(resolve, 2000));
      const before = { url: location.href, text: document.body?.innerText?.slice(0, 2500) || "" };
      const localArtifactsHost = document.querySelector("#local-code-artifacts");
      before.localArtifacts = localArtifactsHost ? {
        hidden: localArtifactsHost.hidden,
        bounds: localArtifactsHost.getBoundingClientRect().toJSON(),
        text: localArtifactsHost.shadowRoot?.textContent?.replace(/\s+/g, " ").trim().slice(0, 3000) || ""
      } : null;
      const localCustomizationHost = document.querySelector("#local-code-customization");
      before.localCustomization = localCustomizationHost ? {
        hidden: localCustomizationHost.hidden,
        bounds: localCustomizationHost.getBoundingClientRect().toJSON(),
        text: localCustomizationHost.shadowRoot?.textContent?.replace(/\s+/g, " ").trim().slice(0, 3000) || "",
        inputs: [...localCustomizationHost.shadowRoot.querySelectorAll("input,select,textarea")].map(element => ({
          id: element.id,
          value: element.value
        }))
      } : null;
      const codeButton = [...document.querySelectorAll("button")].find(element =>
        element.getAttribute("aria-label") === "Code" || element.textContent?.trim() === "Code"
      );
      codeButton?.click();
      await new Promise(resolve => setTimeout(resolve, 10000));
      if (${JSON.stringify(clickCustomize)} || ${JSON.stringify(clickArtifacts)}) {
        const label = ${JSON.stringify(clickArtifacts ? "Artifacts" : "Customize")};
        const navigationButton = [...document.querySelectorAll("button")].find(element =>
          element.getAttribute("aria-label") === label || element.textContent?.includes(label)
        );
        navigationButton?.click();
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      if (${JSON.stringify(clickNewSession)}) {
        const newSessionButton = [...document.querySelectorAll("button")].find(element =>
          element.textContent?.includes("New session")
        );
        newSessionButton?.click();
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
      return {
        before,
        clicked: Boolean(codeButton),
        startedSessionId: ${JSON.stringify(startedSessionId)},
        codeButtonHtml: codeButton?.outerHTML?.slice(0, 5000) || null,
        codeNavigationHtml: codeButton?.parentElement?.parentElement?.outerHTML?.slice(0, 20000) || null,
        after: {
          url: location.href,
          title: document.title,
          text: document.body?.innerText?.slice(0, 8000) || "",
          inputs: [...document.querySelectorAll("input")].filter(visible).map(element => ({
            type: element.type,
            placeholder: element.placeholder,
            ariaLabel: element.getAttribute("aria-label")
          })),
          textareas: [...document.querySelectorAll("textarea")].filter(visible).map(element => ({
            placeholder: element.placeholder,
            ariaLabel: element.getAttribute("aria-label")
          })),
          contentEditables: [...document.querySelectorAll('[contenteditable="true"]')].filter(visible).map(element => ({
            text: element.textContent?.slice(0, 100),
            dataPlaceholder: element.getAttribute("data-placeholder"),
            ariaLabel: element.getAttribute("aria-label")
          })),
          buttons: [...document.querySelectorAll("button")].filter(visible).map(element => ({
            text: element.textContent?.trim().slice(0, 100),
            ariaLabel: element.getAttribute("aria-label"),
            title: element.getAttribute("title")
          })).filter(item => item.text || item.ariaLabel || item.title),
          links: [...document.querySelectorAll("a[href]")].filter(visible).map(element => ({
            text: element.textContent?.trim().slice(0, 100),
            href: element.getAttribute("href")
          })).filter(item => item.text),
          localSessionsMethods: Object.keys(window["claude.web"]?.LocalSessions || {}),
          claudeCodeMethods: Object.keys(window["claude.web"]?.ClaudeCode || {})
        }
      };
    })()`,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({ runtime: runtime.events.slice(-30) }, null, 2)}\n`,
  );
  runtime.close();
  const trace = stderr.filter((chunk) => chunk.includes("[code-ipc]"));
  process.stderr.write(trace.join(""));
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
