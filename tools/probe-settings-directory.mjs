import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
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
  const targets = await response.json();
  return targets.find(
    (target) =>
      target.type === "page" &&
      target.url.startsWith("app://localhost") &&
      !target.url.startsWith("app://localhost/blank"),
  );
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
        result.exceptionDetails.exception?.description ?? "Evaluation failed",
      );
    return result.result?.value;
  } finally {
    socket.close();
  }
}

async function eventually(port, operation, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const target = await targetAt(port);
      if (target?.webSocketDebuggerUrl) return await operation(target);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError ?? new Error("Timed out waiting for the settings UI");
}

const profile = await mkdtemp(path.join(os.tmpdir(), "claude-settings-dir-"));
const port = await unusedPort();
const output = [];
const packagedExecutable = process.env.OPEN_CLAUDE_TEST_EXECUTABLE
  ? path.resolve(process.env.OPEN_CLAUDE_TEST_EXECUTABLE)
  : null;
const child = spawn(
  packagedExecutable ?? electron,
  [...(packagedExecutable ? [] : ["."]), `--remote-debugging-port=${port}`],
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

let result;
try {
  result = await eventually(port, (target) =>
    evaluate(
      target,
      `(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const directoryFetches = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const response = await originalFetch(...args);
          const target = String(args[0]?.url || args[0] || '');
          if (
            target.includes('/skills/list-skills') ||
            (target.includes('/mcp-registry/') &&
              !directoryFetches.some(entry => entry.target.includes('/mcp-registry/')))
          ) {
            let body = '';
            try { body = (await response.clone().text()).slice(0, 1200); } catch {}
            directoryFetches.push({ target, status: response.status, body });
          }
          return response;
        };
        const connectorChunkText = await (
          await originalFetch('/assets/v1/shared-4-aQIEM2lk.js')
        ).text();
        const connectorPatchDiagnostics = {
          localEndpoint: connectorChunkText.includes(
            'new URL("/mcp-registry/v0/servers",location.origin)',
          ),
          queryEnabled: connectorChunkText.includes('var hd=!0,yd='),
          localRegistryPreferred: connectorChunkText.includes('d=!1,u=ie("mcp_server_spec_directory")'),
        };
        const visible = element => {
          if (!(element instanceof Element)) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' &&
            style.visibility !== 'hidden' && !element.closest('[aria-hidden="true"],[inert]');
        };
        const text = element => (element?.textContent || '')
          .replace(/\\s+/g, ' ').trim();
        const settingsDialog = () => [...document.querySelectorAll('[role="dialog"]')]
          .find(dialog => visible(dialog) && dialog.querySelector('nav[aria-label="Settings"]'));
        const openSettings = async () => {
          if (!settingsDialog()) {
            const deadline = Date.now() + 25000;
            while (!document.querySelector('[data-testid="local-settings-sidebar-button"]') && Date.now() < deadline)
              await wait(100);
            document.querySelector('[data-testid="local-settings-sidebar-button"]')?.click();
          }
          const deadline = Date.now() + 10000;
          while (!settingsDialog() && Date.now() < deadline) await wait(100);
          if (!settingsDialog()) throw new Error('Settings dialog did not open');
        };
        const section = async label => {
          await openSettings();
          const deadline = Date.now() + 10000;
          let button;
          while (!button && Date.now() < deadline) {
            const dialog = settingsDialog();
            button = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
              .filter(visible).find(candidate =>
                (candidate.querySelector('.truncate')?.textContent?.trim() || text(candidate)) === label);
            if (!button) await wait(100);
          }
          if (!button) {
            const dialog = settingsDialog();
            const labels = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
              .filter(visible).map(candidate => ({ plain: text(candidate), raw: candidate.textContent }));
            throw new Error('Missing Settings section: ' + label + ' in ' + JSON.stringify(labels));
          }
          button.click();
          await wait(900);
        };
        const contentButton = (label) => {
          const dialog = settingsDialog();
          return [...(dialog?.querySelectorAll('button') || [])]
            .filter(visible).find(candidate => text(candidate) === label);
        };
        const snapshot = label => {
          const dialog = settingsDialog();
          const directoryNav = [...document.querySelectorAll('nav[aria-label="Directory sections"]')]
            .find(visible);
          const directoryRoot = directoryNav?.parentElement?.parentElement;
          const memoryHost = document.querySelector('#local-claude-workbench');
          return {
            label,
            url: location.href,
            settingsText: text(dialog).slice(0, 2200),
            settingsHeadings: [...(dialog?.querySelectorAll('h1,h2,h3') || [])]
              .filter(visible).map(text).filter(Boolean),
            settingsButtons: [...(dialog?.querySelectorAll('button') || [])]
              .filter(visible).map(button => ({ text: text(button), aria: button.getAttribute('aria-label') }))
              .filter(button => button.text || button.aria),
            visibleDialogs: [...document.querySelectorAll('[role="dialog"]')]
              .filter(visible).map(candidate => text(candidate).slice(0, 600)),
            customDirectoryPresent: Boolean(
              document.querySelector('#local-directory, #local-connectors-settings')
            ),
            connectorPatchDiagnostics,
            directoryFetches: [...directoryFetches],
            nativeDirectory: directoryRoot ? {
              text: text(directoryRoot).slice(0, 2000),
              sections: [...directoryNav.querySelectorAll('button')]
                .filter(visible).map(text),
              searchPlaceholder: directoryRoot
                .querySelector('input[aria-label="Search directory"]')
                ?.getAttribute('placeholder'),
              cardTitles: [...directoryRoot.querySelectorAll('[class*="group/card"]')]
                .map(card => card.querySelector('[title]')?.getAttribute('title') || text(card).slice(0, 120))
                .filter(Boolean).slice(0, 100),
            } : null,
            memory: memoryHost && !memoryHost.hidden ? {
              headings: [...memoryHost.shadowRoot.querySelectorAll('h1,h2,h3')].filter(visible).map(text),
              buttons: [...memoryHost.shadowRoot.querySelectorAll('button')].filter(visible).map(button => ({ text: text(button), aria: button.getAttribute('aria-label') })),
            } : null,
          };
        };
        const closeDirectory = async () => {
          const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible);
          for (const dialog of dialogs.reverse()) {
            if (dialog === settingsDialog()) continue;
            const close = [...dialog.querySelectorAll('button')]
              .find(button => visible(button) && /close/i.test(button.getAttribute('aria-label') || ''));
            close?.click();
          }
          await wait(350);
        };

        await openSettings();
        const snapshots = [];

        for (const [name, buttonLabel] of [
          ['Skills', 'Browse'],
          ['Connectors', 'Browse connectors'],
          ['Plugins', 'Browse plugins'],
        ]) {
          await section(name);
          if (name === 'Connectors') {
            const directBrowse = contentButton(buttonLabel);
            if (directBrowse) directBrowse.click();
            else {
              const add = [...settingsDialog().querySelectorAll('button')]
                .filter(visible).find(button =>
                  button.getAttribute('aria-label') === 'Add connector' || text(button) === 'Add');
              add?.click();
              await wait(250);
              const browseLabel = [...document.querySelectorAll('body *')]
                .filter(candidate => visible(candidate) && text(candidate) === buttonLabel)
                .sort((left, right) => left.children.length - right.children.length)[0];
              const browse = browseLabel?.closest(
                'button,[role="menuitem"],[role="option"],[role="menuitemradio"]',
              ) || browseLabel;
              browse?.click();
            }
          } else {
            contentButton(buttonLabel)?.click();
          }
          await wait(1200);
          snapshots.push(snapshot(name.toLowerCase() + '-directory'));
          await closeDirectory();
        }

        await section('Memory');
        await wait(900);
        snapshots.push(snapshot('memory'));
        return snapshots;
      })()`,
    ),
  );
  const snapshots = Object.fromEntries(
    result.map((entry) => [entry.label, entry]),
  );
  for (const label of [
    "skills-directory",
    "connectors-directory",
    "plugins-directory",
  ]) {
    const directory = snapshots[label]?.nativeDirectory;
    assert(directory, `${label} did not open the native Directory`);
    assert(
      directory.sections.length === 3 &&
        directory.sections.includes("Skills") &&
        directory.sections.includes("Connectors") &&
        directory.sections.includes("Plugins"),
      `${label} did not expose all three Directory tabs`,
    );
    assert(
      snapshots[label].customDirectoryPresent === false,
      `${label} used the removed custom Directory renderer`,
    );
  }
  assert(
    snapshots["plugins-directory"].nativeDirectory.cardTitles.length > 10,
    "The plugin Directory did not render its bundled public catalog",
  );
  assert(
    snapshots["skills-directory"].nativeDirectory.cardTitles.length === 0 &&
      snapshots["skills-directory"].directoryFetches
        .filter((request) => request.target.includes("/skills/list-skills"))
        .every((request) => request.body === '{"skills":[]}'),
    "The cloud Skills Directory duplicated local standalone skills",
  );
  assert(
    Object.values(
      snapshots["connectors-directory"].connectorPatchDiagnostics,
    ).every(Boolean),
    "The Connectors Directory release patches were not all served",
  );
  assert(
    snapshots["connectors-directory"].nativeDirectory.cardTitles.includes(
      "Gmail",
    ),
    "The Connectors Directory is empty",
  );
  assert(
    snapshots.memory.settingsHeadings.join("|") === "Settings" &&
      snapshots.memory.memory?.headings.length === 0 &&
      snapshots.memory.memory?.buttons.some(
        (button) => button.text === "Refresh memory",
      ),
    "Memory still has duplicate modal chrome or is missing Refresh memory",
  );
  process.stdout.write(
    `${JSON.stringify(
      Object.fromEntries(
        result
          .filter((entry) => entry.nativeDirectory)
          .map((entry) => [
            entry.label,
            {
              sections: entry.nativeDirectory.sections,
              searchPlaceholder: entry.nativeDirectory.searchPlaceholder,
              cards: entry.nativeDirectory.cardTitles.length,
              firstCards: entry.nativeDirectory.cardTitles.slice(0, 5),
              customDirectoryPresent: entry.customDirectoryPresent,
            },
          ]),
      ),
      null,
      2,
    )}\n`,
  );
  process.stdout.write("PROBE OK: settings-directory\n");
} catch (error) {
  process.stderr.write(
    `${JSON.stringify(
      {
        error: String(error),
        snapshots: result,
        electronOutput: output.join(""),
      },
      null,
      2,
    )}\n`,
  );
  throw error;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
