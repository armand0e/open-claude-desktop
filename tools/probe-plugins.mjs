// Probe: the LocalPlugins bridge round-trips against the local manager —
// upload a plugin zip through the page bridge, list it, and check the
// enabled plugin's skill reaches both Chat and Code system prompts.
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

function buildZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const uint16 = (value) => new Uint8Array([value & 255, value >> 8]);
  const uint32 = (value) =>
    new Uint8Array([
      value & 255,
      (value >> 8) & 255,
      (value >> 16) & 255,
      (value >>> 24) & 255,
    ]);
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const localOffset = offset;
    for (const part of [
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
      data,
    ]) {
      chunks.push(part);
      offset += part.length;
    }
    central.push(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    );
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const part of central) {
    chunks.push(part);
    centralSize += part.length;
  }
  chunks.push(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralSize),
    uint32(centralStart),
    uint16(0),
  );
  return Buffer.concat(chunks);
}

const pluginZipBase64 = buildZip([
  [
    ".claude-plugin/plugin.json",
    JSON.stringify({
      name: "probe-plugin",
      description: "Probe",
      version: "1.0.0",
    }),
  ],
  [
    "skills/prober/SKILL.md",
    "---\nname: prober\ndescription: Probes locally\n---\n\nProbe instructions body.",
  ],
]).toString("base64");

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
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write(
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Done." } }] })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
const providerPort = provider.address().port;
const debuggerPort = await unusedPort();
const profile = await mkdtemp(path.join(os.tmpdir(), "claude-plugins-"));
const workspace = await mkdtemp(
  path.join(os.tmpdir(), "claude-plugins-code-workspace-"),
);
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
  const bridge = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const deadline = Date.now() + 25000;
      while (!document.querySelector('[contenteditable="true"]') && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 200));
      const plugins = window["claude.web"]?.LocalPlugins;
      if (!plugins?.getPlugins) return { failed: "no-bridge" };
      const before = await plugins.getPlugins();
      const uploaded = await plugins.uploadPlugin("probe.zip", ${JSON.stringify(pluginZipBase64)});
      const after = await plugins.getPlugins();
      const skillFiles = await plugins.listSkillFiles("probe-plugin@local", "prober");
      const disabledPlugin = await plugins.setPluginEnabled("probe-plugin@local", false);
      const afterPluginDisable = await plugins.getPlugins();
      const enabledPlugin = await plugins.setPluginEnabled("probe-plugin@local", true);
      const skills = window["claude.web"]?.LocalAgentModeSessions;
      if (!skills?.saveLocalSkill) return { failed: "no-native-skills-bridge" };
      const savedSkill = await skills.saveLocalSkill(
        "probe-skill",
        "Probe skill",
        "---\\nname: probe-skill\\ndescription: Probe skill\\n---\\n\\nProbe skill body.",
        true
      );
      const enabledSkills = await skills.listLocalSkills();
      const disabledSkill = await skills.setLocalSkillEnabled("probe-skill", false);
      const afterSkillDisable = await skills.listLocalSkills();
      const enabledSkill = await skills.setLocalSkillEnabled("probe-skill", true);
      return {
        before, uploaded, after, skillFiles, disabledPlugin, afterPluginDisable,
        enabledPlugin, savedSkill, enabledSkills, disabledSkill,
        afterSkillDisable, enabledSkill
      };
    })()`,
  );
  console.log(
    "bridge:",
    JSON.stringify({
      uploaded: bridge.uploaded,
      installedIds: bridge.after?.map((plugin) => plugin.id),
      pluginDisabled: bridge.afterPluginDisable?.find(
        (plugin) => plugin.id === "probe-plugin@local",
      )?.enabled,
      skillSaved: bridge.savedSkill?.ok,
      skillDisabled: bridge.afterSkillDisable?.find(
        (skill) => skill.name === "probe-skill",
      )?.enabled,
    }),
  );
  assert(!bridge.failed, bridge.failed);
  assert(bridge.uploaded?.success === true, "uploadPlugin failed");
  assert(
    bridge.after?.some((plugin) => plugin.id === "probe-plugin@local"),
    "Installed plugin missing from getPlugins",
  );
  assert(bridge.skillFiles?.success === true, "listSkillFiles failed");
  assert(
    bridge.disabledPlugin?.success === true,
    "setPluginEnabled(false) failed",
  );
  assert(
    bridge.afterPluginDisable?.some(
      (plugin) =>
        plugin.id === "probe-plugin@local" && plugin.enabled === false,
    ),
    "Disabled plugin state was not persisted",
  );
  assert(
    bridge.enabledPlugin?.success === true,
    "setPluginEnabled(true) failed",
  );
  assert(bridge.savedSkill?.ok === true, "saveLocalSkill failed");
  assert(
    bridge.enabledSkills?.some(
      (skill) => skill.name === "probe-skill" && skill.enabled === true,
    ),
    "Saved skill missing from native Skills inventory",
  );
  assert(
    bridge.disabledSkill?.ok === true,
    "setLocalSkillEnabled(false) failed",
  );
  assert(
    bridge.afterSkillDisable?.some(
      (skill) => skill.name === "probe-skill" && skill.enabled === false,
    ),
    "Disabled skill state was not persisted",
  );
  assert(bridge.enabledSkill?.ok === true, "setLocalSkillEnabled(true) failed");

  const settingsInventory = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => {
        if (!(element instanceof Element)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" &&
          style.visibility !== "hidden" && !element.closest('[aria-hidden="true"],[inert]');
      };
      const text = element => (element?.textContent || "").replace(/\\s+/g, " ").trim();
      const settingsDialog = () => [...document.querySelectorAll('[role="dialog"]')]
        .find(dialog => visible(dialog) && dialog.querySelector('nav[aria-label="Settings"]'));
      if (!settingsDialog()) {
        const deadline = Date.now() + 20000;
        while (!document.querySelector('[data-testid="local-settings-sidebar-button"]') && Date.now() < deadline)
          await wait(100);
        document.querySelector('[data-testid="local-settings-sidebar-button"]')?.click();
      }
      let deadline = Date.now() + 10000;
      while (!settingsDialog() && Date.now() < deadline) await wait(100);
      const openSection = async label => {
        let button;
        deadline = Date.now() + 10000;
        while (!button && Date.now() < deadline) {
          button = [...settingsDialog().querySelectorAll('nav[aria-label="Settings"] button')]
            .filter(visible).find(candidate =>
              (candidate.querySelector('.truncate')?.textContent?.trim() || text(candidate)) === label);
          if (!button) await wait(100);
        }
        if (!button) throw new Error("Missing Settings section: " + label);
        button.click();
        await wait(900);
        deadline = Date.now() + 10000;
        while (!text(settingsDialog()).toLowerCase().includes(label === "Plugins" ? "probe plugin" : "probe-skill") && Date.now() < deadline)
          await wait(150);
        return {
          text: text(settingsDialog()).slice(0, 5000),
          buttons: [...settingsDialog().querySelectorAll('button')].filter(visible).map(button => ({
            text: text(button),
            aria: button.getAttribute("aria-label"),
            pressed: button.getAttribute("aria-pressed")
          })).filter(button => button.text || button.aria),
          switches: [...settingsDialog().querySelectorAll('[role="switch"]')].filter(visible).map(control => ({
            aria: control.getAttribute("aria-label"),
            checked: control.getAttribute("aria-checked"),
            text: text(control.closest("div"))
          }))
        };
      };
      const openItem = async label => {
        const leaf = [...settingsDialog().querySelectorAll('*')]
          .filter(candidate => visible(candidate) && text(candidate).toLowerCase() === label.toLowerCase())
          .sort((left, right) => left.children.length - right.children.length)[0];
        const clickable = leaf?.closest('button,a,[role="button"],[role="row"],tr,[tabindex]') || leaf;
        clickable?.click();
        await wait(1000);
        return {
          text: text(settingsDialog()).slice(0, 5000),
          buttons: [...settingsDialog().querySelectorAll('button')].filter(visible).map(button => ({
            text: text(button), aria: button.getAttribute("aria-label")
          })).filter(button => button.text || button.aria),
          switches: [...settingsDialog().querySelectorAll('[role="switch"]')].filter(visible).map(control => ({
            aria: control.getAttribute("aria-label"), checked: control.getAttribute("aria-checked"),
            text: text(control.closest("div"))
          }))
        };
      };
      const plugins = await openSection("Plugins");
      const pluginDetails = await openItem("Probe plugin");
      let pluginSwitch = [...settingsDialog().querySelectorAll('[role="switch"]')]
        .find(control => visible(control) && control.getAttribute("aria-label") === "Enable plugin");
      pluginSwitch?.click();
      await wait(500);
      const pluginAfterUiDisable = await window["claude.web"].LocalPlugins.getPlugins();
      pluginSwitch = [...settingsDialog().querySelectorAll('[role="switch"]')]
        .find(control => visible(control) && control.getAttribute("aria-label") === "Enable plugin");
      pluginSwitch?.click();
      await wait(500);
      const pluginAfterUiEnable = await window["claude.web"].LocalPlugins.getPlugins();
      const pluginMenuButton = [...settingsDialog().querySelectorAll('button')]
        .find(button => visible(button) && button.getAttribute("aria-label") === "More options for Probe plugin");
      pluginMenuButton?.click();
      await wait(250);
      const pluginMenu = [...document.querySelectorAll('[role="menuitem"], [role="option"]')]
        .filter(visible).map(text).filter(Boolean);
      const skills = await openSection("Skills");
      const skillDetails = await openItem("probe-skill");
      let skillSwitch = [...settingsDialog().querySelectorAll('[role="switch"]')]
        .find(control => visible(control) && control.getAttribute("aria-label") === "Enable skill");
      skillSwitch?.click();
      await wait(500);
      const skillsAfterUiDisable = await window["claude.web"].LocalAgentModeSessions.listLocalSkills();
      skillSwitch = [...settingsDialog().querySelectorAll('[role="switch"]')]
        .find(control => visible(control) && control.getAttribute("aria-label") === "Enable skill");
      skillSwitch?.click();
      await wait(500);
      const skillsAfterUiEnable = await window["claude.web"].LocalAgentModeSessions.listLocalSkills();
      const skillMenuButton = [...settingsDialog().querySelectorAll('button')]
        .find(button => visible(button) && button.getAttribute("aria-label") === "More options for probe-skill");
      skillMenuButton?.click();
      await wait(250);
      const skillMenu = [...document.querySelectorAll('[role="menuitem"], [role="option"]')]
        .filter(visible).map(text).filter(Boolean);
      return {
        plugins, pluginDetails, pluginAfterUiDisable, pluginAfterUiEnable,
        pluginMenu, skills, skillDetails, skillsAfterUiDisable,
        skillsAfterUiEnable, skillMenu
      };
    })()`,
  );
  console.log(
    "settings inventory:",
    JSON.stringify({
      pluginVisible: settingsInventory.plugins?.text
        ?.toLowerCase()
        .includes("probe plugin"),
      pluginMenu: settingsInventory.pluginMenu,
      pluginStates: [
        settingsInventory.pluginAfterUiDisable?.find(
          (plugin) => plugin.id === "probe-plugin@local",
        )?.enabled,
        settingsInventory.pluginAfterUiEnable?.find(
          (plugin) => plugin.id === "probe-plugin@local",
        )?.enabled,
      ],
      skillVisible: settingsInventory.skills?.text?.includes("probe-skill"),
      skillMenu: settingsInventory.skillMenu,
      skillStates: [
        settingsInventory.skillsAfterUiDisable?.find(
          (skill) => skill.name === "probe-skill",
        )?.enabled,
        settingsInventory.skillsAfterUiEnable?.find(
          (skill) => skill.name === "probe-skill",
        )?.enabled,
      ],
    }),
  );
  assert(
    settingsInventory.plugins?.text?.toLowerCase().includes("probe plugin"),
    "Installed plugin missing from the Settings Plugins screen",
  );
  assert(
    settingsInventory.skills?.text?.includes("probe-skill"),
    "Standalone skill missing from the Settings Skills screen",
  );
  assert(
    settingsInventory.pluginAfterUiDisable?.some(
      (plugin) =>
        plugin.id === "probe-plugin@local" && plugin.enabled === false,
    ) &&
      settingsInventory.pluginAfterUiEnable?.some(
        (plugin) =>
          plugin.id === "probe-plugin@local" && plugin.enabled === true,
      ),
    "Settings plugin toggle did not persist both states",
  );
  assert(
    settingsInventory.skillsAfterUiDisable?.some(
      (skill) => skill.name === "probe-skill" && skill.enabled === false,
    ) &&
      settingsInventory.skillsAfterUiEnable?.some(
        (skill) => skill.name === "probe-skill" && skill.enabled === true,
      ),
    "Settings skill toggle did not persist both states",
  );

  // The enabled plugin skill must reach the chat system prompt.
  const prompted = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const editor = document.querySelector('[contenteditable="true"][aria-label="Write your prompt to Claude"]');
      editor.focus();
      document.execCommand("insertText", false, "hello there");
      await new Promise(resolve => setTimeout(resolve, 400));
      [...document.querySelectorAll("button")].find(b =>
        /send message/i.test(b.getAttribute("aria-label") || "") && !b.disabled)?.click();
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if ((document.body?.innerText || "").includes("Done.")) return { done: true };
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      return { done: false };
    })()`,
  );
  assert(prompted.done, "Chat completion did not finish");
  const systemPrompt = requests
    .at(-1)
    ?.messages?.find((message) => message.role === "system")?.content;
  assert(
    typeof systemPrompt === "string" &&
      systemPrompt.includes("probe-plugin:prober"),
    "Plugin skill missing from the chat system prompt skill list",
  );

  const code = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const sessions = window["claude.web"]?.LocalSessions;
      if (!sessions?.start) return { failed: "no-code-bridge" };
      const started = await sessions.start({
        cwd: ${JSON.stringify(workspace)},
        message: "Use the installed plugin in Code",
        permissionMode: "bypassPermissions"
      });
      if (!started?.sessionId) return { failed: "no-code-session" };
      const deadline = Date.now() + 20000;
      let transcript = [];
      while (Date.now() < deadline) {
        transcript = await sessions.getTranscript(started.sessionId);
        if (transcript.some(message => message.type === "result")) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return {
        sessionId: started.sessionId,
        completed: transcript.some(message => message.type === "result")
      };
    })()`,
  );
  assert(!code.failed, code.failed);
  assert(code.completed, "Code completion did not finish");
  const codeSystemPrompt = requests
    .at(-1)
    ?.messages?.filter((message) => message.role === "system")
    .map((message) => String(message.content))
    .join("\n");
  assert(
    typeof codeSystemPrompt === "string" &&
      codeSystemPrompt.includes("probe-plugin:prober"),
    "Plugin skill missing from the Code system prompt skill list",
  );

  const removed = await evaluateEventually(
    debuggerPort,
    `(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const visible = element => {
        if (!(element instanceof Element)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" &&
          style.visibility !== "hidden" && !element.closest('[aria-hidden="true"],[inert]');
      };
      const text = element => (element?.textContent || "").replace(/\\s+/g, " ").trim();
      const settingsDialog = () => [...document.querySelectorAll('[role="dialog"]')]
        .find(dialog => visible(dialog) && dialog.querySelector('nav[aria-label="Settings"]'));
      const menuItems = () => [...document.querySelectorAll('[role="menuitem"], [role="option"]')]
        .filter(visible);
      const ensureSettings = async () => {
        if (!settingsDialog()) {
          const buttonDeadline = Date.now() + 10000;
          while (!document.querySelector('[data-testid="local-settings-sidebar-button"]') && Date.now() < buttonDeadline)
            await wait(100);
          document.querySelector('[data-testid="local-settings-sidebar-button"]')?.click();
        }
        const dialogDeadline = Date.now() + 10000;
        while (!settingsDialog() && Date.now() < dialogDeadline) await wait(100);
        if (!settingsDialog()) throw new Error("Settings did not reopen for uninstall verification");
        return settingsDialog();
      };
      const openSection = async label => {
        const dialog = await ensureSettings();
        const button = [...dialog.querySelectorAll('nav[aria-label="Settings"] button')]
          .filter(visible).find(candidate =>
            (candidate.querySelector('.truncate')?.textContent?.trim() || text(candidate)) === label);
        if (!button) throw new Error("Missing Settings section: " + label);
        button.click();
        await wait(700);
        return settingsDialog();
      };
      const openItem = async label => {
        const dialog = settingsDialog();
        const deadline = Date.now() + 10000;
        let leaf;
        while (!leaf && Date.now() < deadline) {
          leaf = [...dialog.querySelectorAll('*')]
            .filter(candidate => visible(candidate) && text(candidate).toLowerCase() === label.toLowerCase())
            .sort((left, right) => left.children.length - right.children.length)[0];
          if (!leaf) await wait(100);
        }
        if (!leaf) throw new Error("Missing Settings item: " + label);
        (leaf.closest('button,a,[role="button"],[role="row"],tr,[tabindex]') || leaf).click();
        await wait(700);
        return settingsDialog();
      };
      const clickDestructiveMenuItem = async pattern => {
        const item = menuItems().find(candidate => pattern.test(text(candidate)));
        if (!item) return false;
        item.click();
        await wait(350);
        const confirmation = [...document.querySelectorAll('button')]
          .filter(visible)
          .find(button => pattern.test(text(button)) && !button.closest('nav[aria-label="Settings"]'));
        confirmation?.click();
        await wait(700);
        return true;
      };
      let dialog = await openSection("Skills");
      dialog = await openItem("probe-skill");
      const skillMenuButton = [...dialog.querySelectorAll('button')]
        .find(button => visible(button) && button.getAttribute("aria-label") === "More options for probe-skill");
      skillMenuButton?.click();
      await wait(250);
      const skillDeleteClicked = await clickDestructiveMenuItem(/uninstall|delete|remove/i);
      const skillsAfterDelete = await window["claude.web"].LocalAgentModeSessions.listLocalSkills();

      dialog = await openSection("Plugins");
      dialog = await openItem("Probe plugin");
      const pluginMenuButton = [...dialog.querySelectorAll('button')]
        .find(button => visible(button) && button.getAttribute("aria-label") === "More options for Probe plugin");
      pluginMenuButton?.click();
      await wait(250);
      const pluginUninstallClicked = await clickDestructiveMenuItem(/uninstall|delete|remove/i);
      const pluginsAfterUninstall = await window["claude.web"].LocalPlugins.getPlugins();
      return {
        skillDeleteClicked,
        skillsAfterDelete,
        pluginUninstallClicked,
        pluginsAfterUninstall
      };
    })()`,
  );
  assert(
    settingsInventory.pluginMenu?.some((item) => /uninstall/i.test(item)),
    "Settings plugin menu has no Uninstall action",
  );
  assert(
    settingsInventory.skillMenu?.some((item) =>
      /uninstall|delete|remove/i.test(item),
    ),
    "Settings skill menu has no Uninstall action",
  );
  assert(
    removed.skillDeleteClicked === true &&
      !removed.skillsAfterDelete?.some((skill) => skill.name === "probe-skill"),
    "Settings skill Delete action did not remove the skill",
  );
  assert(
    removed.pluginUninstallClicked === true &&
      !removed.pluginsAfterUninstall?.some(
        (plugin) => plugin.id === "probe-plugin@local",
      ),
    "Settings plugin Uninstall action did not remove the plugin",
  );

  console.log(
    "PROBE PASS: plugin and skill Settings inventory/toggle/uninstall lifecycle works and plugin skills reach Chat and Code",
  );
} catch (error) {
  console.error("PROBE FAIL:", error.message);
  console.error(output.join("").slice(-3000));
  process.exitCode = 1;
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await Promise.all(
    [profile, workspace].map((directory) =>
      rm(directory, { recursive: true, force: true }).catch(() => undefined),
    ),
  );
  provider.close();
}
