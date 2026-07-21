// Proves the Scheduled surface works end to end from a genuinely empty local
// profile: the native empty state and templates settle, an IPC-created task
// appears without a reload, the Code sidebar pins Scheduled, the detail page
// renders, and deleting the task round-trips into the scheduler store.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import electron from "electron";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return typeof address === "object" && address ? address.port : 0;
}

async function targetAt(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Target list returned ${response.status}`);
  const targets = await response.json();
  return targets.find(
    (target) =>
      target.type === "page" &&
      target.url.startsWith("app://localhost") &&
      !target.url.startsWith("app://localhost/blank"),
  );
}

let commandId = 0;
async function cdp(target, method, params = {}) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CDP connection timed out")),
      15_000,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      (event) => {
        clearTimeout(timer);
        reject(event.error ?? new Error("CDP connection failed"));
      },
      { once: true },
    );
  });
  const id = ++commandId;
  try {
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.removeEventListener("message", listener);
        reject(new Error(`${method} timed out`));
      }, 20_000);
      const listener = (event) => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        clearTimeout(timer);
        socket.removeEventListener("message", listener);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      };
      socket.addEventListener("message", listener);
      socket.send(JSON.stringify({ id, method, params }));
    });
  } finally {
    socket.close();
  }
}

async function evaluate(target, expression) {
  const result = await cdp(target, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Evaluation failed",
    );
  return result.result?.value;
}

async function eventually(port, operation, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await targetAt(port);
      if (target?.webSocketDebuggerUrl) return await operation(target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error("Timed out waiting for renderer");
}

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-sched-probe-"));
const tasksFile = path.join(profile, "local-scheduled-tasks.json");
await writeFile(
  tasksFile,
  `${JSON.stringify(
    {
      version: 1,
      tasks: [],
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const debuggerPort = await unusedPort();
const output = [];
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const child = spawn(
  packagedExecutable ?? electron,
  [
    ...(packagedExecutable ? [] : ["."]),
    `--remote-debugging-port=${debuggerPort}`,
  ],
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
    },
  },
);
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => output.push(chunk));

try {
  const emptyState = await eventually(debuggerPort, async (target) => {
    const state = await evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        history.pushState(history.state, "", "/epitaxy/scheduled");
        window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
        const settleDeadline = Date.now() + 15000;
        let text = "";
        while (Date.now() < settleDeadline) {
          text = document.body.innerText.replace(/[\\uE000-\\uF8FF]/gu, "");
          if (
            /Failed to load scheduled tasks\./.test(text) ||
            (/No scheduled tasks yet\./.test(text) &&
              document.querySelectorAll("[data-local-scheduled-preset]").length === 6)
          )
            break;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        const service = window["claude.web"]?.CCDScheduledTasks;
        const directList = await Promise.race([
          service?.getAllScheduledTasks?.()
            .then(value => ({ status: "resolved", value }))
            .catch(error => ({ status: "rejected", error: String(error) })),
          new Promise(resolve => setTimeout(() => resolve({ status: "timed-out" }), 2000)),
        ]);
        return {
          url: location.pathname,
          text: text.slice(-2200),
          customOverridePresent: Boolean(document.getElementById("local-code-routines")),
          hasEmptyState: /No scheduled tasks yet\./.test(text),
          hasTemplates:
            document.querySelectorAll("[data-local-scheduled-preset]").length === 6,
          hasReferenceSearch: Boolean(
            document.querySelector('input[aria-label="Search scheduled tasks"]'),
          ),
          hasReferenceSort: text.includes("Sort by Next run"),
          presetColumns: getComputedStyle(
            document.querySelector(".local-scheduled-grid"),
          ).gridTemplateColumns,
          statusText: [...document.querySelectorAll('[role="status"]')]
            .filter(el => el.getClientRects().length > 0)
            .map(el => (el.textContent || "").trim()),
          directList,
        };
      })()`,
    );
    if (!state.hasEmptyState)
      throw new Error(
        `Empty Scheduled page did not settle: ${JSON.stringify(state)}`,
      );
    return state;
  });
  assert(
    !emptyState.customOverridePresent,
    "The legacy custom routines page replaced the native UI",
  );
  assert(
    emptyState.hasTemplates,
    "The native empty state did not expose local presets",
  );
  assert(
    emptyState.hasReferenceSearch &&
      emptyState.hasReferenceSort &&
      emptyState.presetColumns.split(" ").length === 2,
    `The Scheduled page did not match the reference layout: ${JSON.stringify(emptyState)}`,
  );
  if (process.env.OPEN_CLAUDE_CAPTURE_SCHEDULED) {
    const screenshotTarget = await targetAt(debuggerPort);
    const screenshot = await cdp(screenshotTarget, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      path.resolve(process.env.OPEN_CLAUDE_CAPTURE_SCHEDULED),
      Buffer.from(screenshot.data, "base64"),
    );
  }

  const created = await eventually(debuggerPort, async (target) => {
    const result = await evaluate(
      target,
      `(async () => {
        const service = window["claude.web"]?.CCDScheduledTasks;
        if (!service?.getAllScheduledTasks) return { missingService: true };
        const deadline = Date.now() + 10000;
        let preset = null;
        while (!preset && Date.now() < deadline) {
          preset = document.querySelector('[data-local-scheduled-preset="briefing"]');
          if (!preset) await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (!preset)
          return { missingPreset: true, text: document.body.innerText.slice(-1600) };
        preset.click();
        while (location.pathname !== "/epitaxy/scheduled/briefing" && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 150));
        const list = await service.getAllScheduledTasks();
        const task = list.find(item => item.id === "briefing");
        return { task, list, url: location.pathname };
      })()`,
    );
    if (result.missingService || result.missingPreset || !result.task)
      throw new Error(
        `Scheduled preset creation failed: ${JSON.stringify(result)}`,
      );
    if (result.url !== "/epitaxy/scheduled/briefing")
      throw new Error(
        `Scheduled preset did not open its detail page: ${result.url}`,
      );
    return result;
  });

  // On the Code surface the Scheduled tab must be pinned to the rail (the
  // native default pins it after the newly created enabled routine exists).
  const rail = await eventually(debuggerPort, async (target) => {
    const state = await evaluate(
      target,
      `(async () => {
        const deadline = Date.now() + 25000;
        while (!document.querySelector("#local-claude-workbench")?.shadowRoot && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        history.pushState(history.state, "", "/epitaxy");
        window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
        const railDeadline = Date.now() + 15000;
        let tab = null;
        while (!tab && Date.now() < railDeadline) {
          tab = [...document.querySelectorAll("nav a, nav button, aside a, aside button")].find(el =>
            el.getClientRects().length > 0 &&
            (el.textContent || "").replace(/[\\uE000-\\uF8FF]/gu, "").trim() === "Scheduled");
          if (!tab) await new Promise(resolve => setTimeout(resolve, 200));
        }
        const labels = [...document.querySelectorAll("nav a, nav button, aside a, aside button")]
          .filter(el => el.getClientRects().length > 0)
          .map(el => (el.getAttribute("aria-label") || el.textContent || "")
            .replace(/[\\uE000-\\uF8FF]/gu, "").replace(/\\s+/g, " ").trim())
          .filter(Boolean);
        if (!tab) return { labels, missing: true };
        tab.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { labels, url: location.pathname };
      })()`,
    );
    if (state.missing)
      throw new Error(
        `Scheduled tab is not pinned on the Code sidebar: ${JSON.stringify(state.labels)}`,
      );
    return state;
  });
  assert(
    rail.url === "/epitaxy/scheduled",
    `Scheduled tab did not navigate to the routines page: ${rail.url}`,
  );

  // The routines page lists the seeded task; its detail page renders with
  // the native controls, and Delete round-trips into the local store.
  const detail = await eventually(debuggerPort, async (target) => {
    const state = await evaluate(
      target,
      `(async () => {
        if (document.getElementById("local-code-routines"))
          return { customOverridePresent: true };
        const row = [...document.querySelectorAll("button")].find(el =>
          el.getClientRects().length > 0 && /daily briefing/i.test(el.textContent || ""));
        if (!row) return { pageText: document.body.innerText.slice(-1500), noRow: true };
        row.click();
        const deadline = Date.now() + 10000;
        while (!/\\/epitaxy\\/scheduled\\//.test(location.pathname) && Date.now() < deadline)
          await new Promise(resolve => setTimeout(resolve, 100));
        await new Promise(resolve => setTimeout(resolve, 800));
        const controls = [...document.querySelectorAll("main button, [role=main] button, button")]
          .filter(el => el.getClientRects().length > 0)
          .map(el => (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim());
        return {
          url: location.pathname,
          text: document.body.innerText.replace(/[\\uE000-\\uF8FF]/gu, "").slice(-1800),
          hasRunNow: controls.includes("Run now"),
          hasDelete: controls.includes("Delete"),
        };
      })()`,
    );
    if (state.customOverridePresent)
      throw new Error("The legacy custom routines page replaced the native UI");
    if (state.noRow)
      throw new Error(`Seeded routine is not listed: ${state.pageText}`);
    return state;
  });
  assert(
    detail.url === "/epitaxy/scheduled/briefing",
    `Routine detail did not open: ${detail.url}`,
  );
  assert(
    detail.hasRunNow && detail.hasDelete,
    `Routine detail is missing controls: ${detail.text}`,
  );
  assert(
    detail.text.includes("8:00 AM"),
    `Cron schedule is not rendered: ${detail.text}`,
  );

  const setDetailToggle = async (expectedBefore, expectedAfter) =>
    eventually(debuggerPort, async (target) => {
      const state = await evaluate(
        target,
        `(async () => {
          const visible = element => element instanceof Element &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden";
          const service = window["claude.web"]?.CCDScheduledTasks;
          const enabled = async () => (await service.getAllScheduledTasks())
            .find(item => item.id === "briefing")?.enabled;
          const before = await enabled();
          const control = [...document.querySelectorAll(
            '[role="switch"], input[type="checkbox"], button[aria-checked]',
          )].find(visible);
          if (!control) return {
            failed: "Status toggle not found",
            before,
            controls: [...document.querySelectorAll('button,input')]
              .filter(visible)
              .map(element => ({
                text: (element.textContent || '').replace(/\\s+/g, ' ').trim(),
                aria: element.getAttribute('aria-label'),
                role: element.getAttribute('role'),
                checked: element.getAttribute('aria-checked'),
              })),
          };
          control.click();
          const deadline = Date.now() + 10000;
          let after = before;
          while (after === before && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
            after = await enabled();
          }
          return { before, after };
        })()`,
      );
      if (
        state.failed ||
        state.before !== expectedBefore ||
        state.after !== expectedAfter
      )
        throw new Error(
          `Status toggle did not change: ${JSON.stringify(state)}`,
        );
      return state;
    });

  const disabled = await setDetailToggle(true, false);
  const pausedPersisted = await eventually(debuggerPort, async () => {
    const parsed = JSON.parse(await readFile(tasksFile, "utf8"));
    const task = (parsed.tasks ?? []).find((entry) => entry.id === "briefing");
    if (task?.status !== "paused")
      throw new Error(`Disabled task persisted as ${task?.status}`);
    return task.status;
  });

  const reenabled = await setDetailToggle(false, true);
  const activePersisted = await eventually(debuggerPort, async () => {
    const parsed = JSON.parse(await readFile(tasksFile, "utf8"));
    const task = (parsed.tasks ?? []).find((entry) => entry.id === "briefing");
    if (task?.status !== "active")
      throw new Error(`Re-enabled task persisted as ${task?.status}`);
    return task.status;
  });

  const deleteTarget = await targetAt(debuggerPort);
  const afterDelete = await evaluate(
    deleteTarget,
    `(async () => {
      const controlName = el =>
        (el.getAttribute("aria-label") || el.textContent || "")
          .replace(/[\\uE000-\\uF8FF]/gu, "").replace(/\\s+/g, " ").trim();
      const del = [...document.querySelectorAll("button")].find(el =>
        el.getClientRects().length > 0 && controlName(el) === "Delete");
      if (!del) return { failed: "Delete control not found", body: document.body.innerText.slice(-1200) };
      del.click();
      await new Promise(resolve => setTimeout(resolve, 900));
      // A confirmation dialog, when present, is confirmed by its own
      // delete-ish button.
      const dialog = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
        .find(el => el.getClientRects().length > 0);
      let dialogText = null;
      if (dialog) {
        dialogText = dialog.innerText.replace(/\\s+/g, " ").slice(0, 400);
        const confirm = [...dialog.querySelectorAll("button")].find(el =>
          /delete|confirm|remove/i.test((el.textContent || "").trim()));
        confirm?.click();
      }
      const deadline = Date.now() + 10000;
      while (/\\/epitaxy\\/scheduled\\/.+/.test(location.pathname) && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 150));
      return {
        url: location.pathname,
        dialogText,
        stillListed: /daily briefing/i.test(document.body.innerText),
      };
    })()`,
  );
  assert(
    !afterDelete.failed,
    `Delete flow failed: ${JSON.stringify(afterDelete)}`,
  );
  assert(
    !/\/epitaxy\/scheduled\/.+/.test(afterDelete.url),
    `Routine detail did not close after delete: ${JSON.stringify(afterDelete)}`,
  );

  // The deletion must have reached the local scheduler store.
  const persisted = await eventually(
    debuggerPort,
    async () => {
      const parsed = JSON.parse(await readFile(tasksFile, "utf8"));
      const task = (parsed.tasks ?? []).find((t) => t.id === "briefing");
      if (task && task.status !== "deleted")
        throw new Error(`Task still ${task.status} in the local store`);
      return { status: task?.status ?? "removed" };
    },
    15_000,
  );

  console.log(
    JSON.stringify(
      {
        emptyState: {
          url: emptyState.url,
          hasTemplates: emptyState.hasTemplates,
          hasReferenceSearch: emptyState.hasReferenceSearch,
          hasReferenceSort: emptyState.hasReferenceSort,
          presetColumns: emptyState.presetColumns,
        },
        createdTask: created.task?.id,
        railLabels: rail.labels,
        detailUrl: detail.url,
        statusToggle: {
          disabled,
          pausedPersisted,
          reenabled,
          activePersisted,
        },
        deleteDialog: afterDelete.dialogText,
        afterDelete: persisted,
      },
      null,
      2,
    ),
  );
  console.log("PROBE OK: scheduled-sidebar");
} catch (error) {
  console.error(error);
  console.error(output.join("").slice(-4_000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
