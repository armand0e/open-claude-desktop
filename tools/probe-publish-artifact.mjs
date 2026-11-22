// Probe: the artifact publish popover — what happens on "publish" click
// (feedback? popover closes?), whether a published state / Unpublish
// affordance ever appears, and whether the state survives reopening the
// popover and reloading the app.
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
        `${result.exceptionDetails.exception?.description ?? "CDP eval failed"} @line ${result.exceptionDetails.lineNumber}:${result.exceptionDetails.columnNumber} | ${expression.split("\n")[result.exceptionDetails.lineNumber]?.slice(0, 160) ?? ""}`,
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

const provider = createHttpServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: "smoke-model" }] }));
    return;
  }
  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    let body = "";
    for await (const chunk of request) body += chunk;
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_publish_probe",
                  function: {
                    name: "artifacts",
                    arguments: JSON.stringify({
                      command: "create",
                      id: "publish-probe",
                      title: "Publish Probe Page",
                      type: "text/html",
                      content:
                        "<!doctype html><html><body><h1>Publish probe</h1></body></html>",
                    }),
                  },
                },
              ],
            },
          },
        ],
      })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-publish-"));
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
child.stderr.on("data", (chunk) => {
  output.push(chunk);
  if (chunk.includes("Public artifact relay")) process.stderr.write(chunk);
});

const popoverAudit = `(() => {
  const visible = el => el.getClientRects().length > 0;
  const popover = [...document.querySelectorAll('[role="dialog"],[data-radix-popper-content-wrapper],[role="menu"]')]
    .filter(visible).at(-1) ?? null;
  const scope = popover ?? document.body;
  return {
    popoverOpen: Boolean(popover),
    popoverText: (scope.innerText || "").slice(0, 900),
    buttons: [...scope.querySelectorAll("button")].filter(visible)
      .map(b => (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 60))
      .filter(Boolean),
    hasUnpublish: /unpublish/i.test(scope.innerText || ""),
    requests: window.__publishRequests ?? [],
    consoleErrors: window.__consoleErrors ?? [],
  };
})()`;

try {
  const opened = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 30000;
      let editor;
      while (Date.now() < deadline) {
        editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
        if (editor && location.pathname === "/new") break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!editor) throw new Error("Composer did not render");
      window.__publishRequests = [];
      window.__consoleErrors = [];
      const originalError = console.error.bind(console);
      console.error = (...args) => {
        window.__consoleErrors.push(args.map(String).join(" ").slice(0, 240));
        originalError(...args);
      };
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (!/[/]api[/]|[/]public[/]/.test(url)) return original(input, init);
        const entry = { call: (init?.method || "GET") + " " + url.slice(0, 140), status: "pending", body: null };
        window.__publishRequests.push(entry);
        return original(input, init).then(async response => {
          entry.status = response.status;
          if (/publish|artifact/i.test(url))
            try { entry.body = (await response.clone().text()).slice(0, 200); } catch {}
          return response;
        }, error => { entry.status = "error:" + error; throw error; });
      };
      // Only keep traffic from the menu interaction onward.
      setTimeout(() => { window.__publishBaseline = window.__publishRequests.length; }, 100);
      editor.focus();
      document.execCommand("insertText", false, "make a publish probe page");
      await new Promise(resolve => setTimeout(resolve, 400));
      [...document.querySelectorAll("button")].find(b =>
        /send message/i.test(b.getAttribute("aria-label") || "") && !b.disabled)?.click();
      // Wait for the artifact card, open the pane.
      while (Date.now() < deadline) {
        const card = document.querySelector('button[aria-label="View Publish Probe Page"]');
        if (card) { card.click(); break; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
      // Inventory every control near the artifact pane header, including
      // unlabeled icon buttons, then open "More options for artifact".
      const allButtons = [...document.querySelectorAll("button")].filter(b => b.getClientRects().length > 0);
      const inventory = allButtons.map(b => ({
        label: (b.getAttribute("aria-label") || "").trim(),
        text: (b.textContent || "").trim().slice(0, 40),
        title: (b.getAttribute("title") || "").trim(),
        testid: b.getAttribute("data-testid") || "",
      })).filter(entry => entry.label || entry.text || entry.title || entry.testid);
      const moreOptions = allButtons.find(b =>
        b.getAttribute("aria-label") === "More options for artifact");
      let menuItems = null;
      window.__publishMenuMark = window.__publishRequests.length;
      if (moreOptions) {
        moreOptions.click();
        await new Promise(resolve => setTimeout(resolve, 900));
        menuItems = [...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="option"]')]
          .filter(el => el.getClientRects().length > 0)
          .map(el => (el.textContent || "").trim().slice(0, 60));
      }
      const audit = ${popoverAudit};
      audit.requests = audit.requests.slice(window.__publishMenuMark);
      return { inventory: inventory.length, menuItems, ...audit };
    })()`,
    90_000,
  );
  console.log("popover before publish:", JSON.stringify(opened, null, 2));
  if (opened.failed) throw new Error(opened.failed);

  const afterClick = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const visible = el => el.getClientRects().length > 0;
      const menuItem = [...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"]')]
        .filter(visible)
        .find(el => /publish|share/i.test(el.textContent || ""));
      if (!menuItem) return { failed: "no-publish-menu-item", ...${popoverAudit} };
      const itemLabel = (menuItem.textContent || "").trim();
      menuItem.click();
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Click the primary action inside the publish surface.
      const dialog = [...document.querySelectorAll('[role="dialog"],[data-radix-popper-content-wrapper]')]
        .filter(visible).at(-1);
      const scope = dialog ?? document.body;
      const action = [...scope.querySelectorAll("button")].filter(visible)
        .find(b => /create|copy link|publish/i.test(b.textContent || ""));
      if (!action) return { itemLabel, failed: "no-action-button" };
      const actionLabel = (action.textContent || "").trim();
      action.click();
      // Public sharing is acknowledged only after the relay has served the
      // exact artifact back to us. The external relay commonly takes longer
      // than three seconds to allocate, so observe the terminal UI/network
      // state instead of misclassifying an in-flight publish as a failure.
      const deadline = Date.now() + 65000;
      while (Date.now() < deadline) {
        const audit = ${popoverAudit};
        const publishRequest = audit.requests.find(entry =>
          /publish_artifact/.test(entry.call));
        if (audit.hasUnpublish ||
            (publishRequest && publishRequest.status !== "pending")) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return { itemLabel, actionLabel, after: ${popoverAudit} };
    })()`,
  );
  console.log("after publish click:", JSON.stringify(afterClick, null, 2));
  assert(!afterClick.failed, `Publish flow failed: ${afterClick.failed}`);
  assert(
    /published/i.test(afterClick.after.popoverText),
    "Modal did not flip to the published state after publishing",
  );
  assert(
    afterClick.after.hasUnpublish,
    "No Unpublish affordance after publishing",
  );

  // Hydration: reload the app, reopen the modal — the published state must
  // come back from persisted data, not client memory.
  const reloaded = await evaluateEventually(
    debuggerPort,
    `(async () => {
      if (!window.__publishProbeReloaded) {
        window.__publishProbeReloaded = true;
        location.reload();
        return null;
      }
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        const card = document.querySelector('button[aria-label="View Publish Probe Page"]');
        if (card) { card.click(); break; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
      const visible = el => el.getClientRects().length > 0;
      const moreOptions = [...document.querySelectorAll("button")].filter(visible)
        .find(b => b.getAttribute("aria-label") === "More options for artifact");
      if (!moreOptions) return { failed: "no-more-options-after-reload" };
      moreOptions.click();
      await new Promise(resolve => setTimeout(resolve, 800));
      const menuItem = [...document.querySelectorAll('[role="menuitem"]')].filter(visible)
        .find(el => /publish|share/i.test(el.textContent || ""));
      if (!menuItem) return { failed: "no-publish-menu-item-after-reload" };
      menuItem.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      return ${popoverAudit};
    })()`,
    60_000,
  );
  const persisted =
    reloaded ??
    (await evaluateEventually(
      debuggerPort,
      `(async () => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const card = document.querySelector('button[aria-label="View Publish Probe Page"]');
          if (card) { card.click(); break; }
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await new Promise(resolve => setTimeout(resolve, 2500));
        const visible = el => el.getClientRects().length > 0;
        const moreOptions = [...document.querySelectorAll("button")].filter(visible)
          .find(b => b.getAttribute("aria-label") === "More options for artifact");
        if (!moreOptions) return { failed: "no-more-options-after-reload" };
        moreOptions.click();
        await new Promise(resolve => setTimeout(resolve, 800));
        const menuItem = [...document.querySelectorAll('[role="menuitem"]')].filter(visible)
          .find(el => /publish|share/i.test(el.textContent || ""));
        if (!menuItem) return { failed: "no-publish-menu-item-after-reload" };
        menuItem.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return ${popoverAudit};
      })()`,
      60_000,
    ));
  console.log("after reload:", JSON.stringify(persisted, null, 2));
  assert(!persisted.failed, `Reload flow failed: ${persisted.failed}`);
  assert(
    /published/i.test(persisted.popoverText) && persisted.hasUnpublish,
    "Published state did not survive an app reload",
  );

  // Unpublish flips the modal back.
  const unpublished = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const visible = el => el.getClientRects().length > 0;
      const unpublishButton = [...document.querySelectorAll("button")].filter(visible)
        .find(b => /unpublish/i.test(b.textContent || ""));
      if (!unpublishButton) return { failed: "no-unpublish-button" };
      unpublishButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      return ${popoverAudit};
    })()`,
  );
  console.log("after unpublish:", JSON.stringify(unpublished, null, 2));
  assert(!unpublished.failed, `Unpublish failed: ${unpublished.failed}`);
  assert(
    !unpublished.hasUnpublish,
    "Unpublish affordance persisted after unpublishing",
  );

  console.log(
    "PROBE PASS: publish flips to published state, survives reload, and unpublishes",
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
