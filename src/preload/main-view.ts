import { contextBridge, ipcRenderer, webFrame, webUtils } from "electron";
import {
  exposeContract,
  exposeSanitizedProcess,
  argumentJson,
} from "./expose-contract";
import { installLocalWorkbench, localClaudeApi } from "./local-workbench";

contextBridge.exposeInMainWorld("desktopReconstructionReady", {
  phase: "preload-start",
});
const LOCAL_SESSION_EXTENSION_METHODS = [
  "deleteLocalSkill",
  "getAllArtifacts",
  "getLocalSkillFiles",
  "listLocalSkills",
  "saveLocalSkill",
  "setLocalSkillEnabled",
] as const;
const namespaces = exposeContract("mainView.js", (contract) => {
  const web = (contract["claude.web"] ??= {});
  const localSessions = (web.LocalSessions ??= {}) as Record<string, unknown>;
  for (const method of LOCAL_SESSION_EXTENSION_METHODS) {
    localSessions[method] = (...args: unknown[]) =>
      ipcRenderer.invoke("open-claude-local-sessions", method, ...args);
  }
});
const appVersion =
  process.argv
    .find((value) => value.startsWith("--desktop-app-version="))
    ?.slice(22) ?? "0.1.0";
exposeSanitizedProcess(appVersion);

const bootFeatures = argumentJson("--desktop-features=");
const enterpriseConfig = argumentJson("--desktop-enterprise-config=");
const telemetryConfig = argumentJson("--desktop-telemetry-config=");
const localBackend = process.argv.includes("--desktop-local-backend");
if (process.argv.includes("--desktop-trace-local-api")) {
  window.addEventListener("error", (event) => {
    console.error(
      "[local-ui-window-error]",
      event.error?.stack ?? event.message,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    console.error(
      "[local-ui-unhandled-rejection]",
      reason instanceof Error ? reason.stack : String(reason),
    );
  });
}
if (bootFeatures !== undefined)
  contextBridge.exposeInMainWorld("desktopBootFeatures", bootFeatures);
if (enterpriseConfig !== undefined)
  contextBridge.exposeInMainWorld("desktopEnterpriseConfig", enterpriseConfig);
if (telemetryConfig !== undefined)
  contextBridge.exposeInMainWorld("desktopTelemetryConfig", telemetryConfig);
if (localBackend) {
  contextBridge.exposeInMainWorld("localClaude", localClaudeApi);
  const webNs = namespaces["claude.web"] as
    | {
        FileSystem?: {
          browseFolder?: (title: string, ...rest: unknown[]) => unknown;
        };
        CCDScheduledTasks?: {
          getAllScheduledTasks?: () => unknown;
          createScheduledTask?: (input: unknown) => unknown;
          updateScheduledTaskStatus?: (
            scheduledTaskId: string,
            status: string,
          ) => unknown;
        };
        LocalSessions?: {
          start?: (input: unknown) => unknown;
          listLocalSkills?: () => unknown;
          saveLocalSkill?: (
            name: string,
            description: string,
            content: string,
            overwrite: boolean,
          ) => unknown;
          setLocalSkillEnabled?: (name: string, enabled: boolean) => unknown;
        };
        LocalPlugins?: {
          getPlugins?: () => unknown;
          installCatalogPlugin?: (catalogId: string) => unknown;
        };
      }
    | undefined;
  const sessionService = webNs?.LocalSessions;
  const fileSystem = webNs?.FileSystem;
  const scheduledTasks = webNs?.CCDScheduledTasks;
  const localSessions = webNs?.LocalSessions;
  const localPlugins = webNs?.LocalPlugins;
  installLocalWorkbench({
    startLocalSession:
      typeof sessionService?.start === "function"
        ? (input) =>
            Promise.resolve(sessionService.start!(input)) as Promise<
              { sessionId?: string } | null | undefined
            >
        : undefined,
    pickFolder:
      typeof fileSystem?.browseFolder === "function"
        ? () =>
            // The channel's first argument (title) is a REQUIRED string —
            // calling with no args fails contract validation and the IPC
            // rejects silently, so the picker never opens.
            Promise.resolve(
              fileSystem.browseFolder!("Choose a working folder"),
            ) as Promise<string | null | undefined>
        : undefined,
    scheduledTasks:
      typeof scheduledTasks?.getAllScheduledTasks === "function" &&
      typeof scheduledTasks?.createScheduledTask === "function" &&
      typeof scheduledTasks?.updateScheduledTaskStatus === "function"
        ? {
            getAllScheduledTasks: () =>
              Promise.resolve(scheduledTasks.getAllScheduledTasks!()),
            createScheduledTask: (input) =>
              Promise.resolve(scheduledTasks.createScheduledTask!(input)),
            updateScheduledTaskStatus: (scheduledTaskId, status) =>
              Promise.resolve(
                scheduledTasks.updateScheduledTaskStatus!(
                  scheduledTaskId,
                  status,
                ),
              ),
          }
        : undefined,
    localSkills:
      typeof localSessions?.listLocalSkills === "function" &&
      typeof localSessions?.saveLocalSkill === "function" &&
      typeof localSessions?.setLocalSkillEnabled === "function"
        ? {
            listLocalSkills: () =>
              Promise.resolve(localSessions.listLocalSkills!()),
            saveLocalSkill: (name, description, content, overwrite) =>
              Promise.resolve(
                localSessions.saveLocalSkill!(
                  name,
                  description,
                  content,
                  overwrite,
                ),
              ),
            setLocalSkillEnabled: (name, enabled) =>
              Promise.resolve(
                localSessions.setLocalSkillEnabled!(name, enabled),
              ),
          }
        : undefined,
    localPlugins:
      typeof localPlugins?.getPlugins === "function" &&
      typeof localPlugins?.installCatalogPlugin === "function"
        ? {
            getPlugins: () => Promise.resolve(localPlugins.getPlugins!()),
            installCatalogPlugin: (catalogId) =>
              Promise.resolve(localPlugins.installCatalogPlugin!(catalogId)),
          }
        : undefined,
    connectorOAuth: {
      listPresets: () =>
        ipcRenderer.invoke("open-claude-connector-oauth", "list-presets"),
      start: (input) =>
        ipcRenderer.invoke("open-claude-connector-oauth", "start", input),
      openSetup: (preset) =>
        ipcRenderer.invoke("open-claude-connector-oauth", "open-setup", {
          preset,
        }),
      openDocs: (preset) =>
        ipcRenderer.invoke("open-claude-connector-oauth", "open-docs", {
          preset,
        }),
      cancel: (uuid) =>
        ipcRenderer.invoke("open-claude-connector-oauth", "cancel", { uuid }),
      disconnect: (uuid) =>
        ipcRenderer.invoke("open-claude-connector-oauth", "disconnect", {
          uuid,
        }),
    },
    listConfiguredMcpServers: () =>
      ipcRenderer.invoke("list-mcp-servers") as Promise<unknown>,
  });
}

const bindings = new Set(["cmdK", "googleAuthCode"]);
contextBridge.exposeInMainWorld("claudeAppBindings", {
  registerBinding(name: string, callback: (...args: unknown[]) => void) {
    if (!bindings.has(name))
      throw new Error(`Unsupported Claude App binding: ${name}`);
    ipcRenderer.on(name, callback);
  },
  unregisterBinding(name: string) {
    if (!bindings.has(name))
      throw new Error(`Unsupported Claude App binding: ${name}`);
    ipcRenderer.removeAllListeners(name);
  },
  listMcpServers: () => ipcRenderer.invoke("list-mcp-servers"),
  connectToMcpServer: (server: unknown) =>
    ipcRenderer.invoke("connect-to-mcp-server", server),
  openMcpSettings: (server: unknown) =>
    ipcRenderer.invoke("request-open-mcp-settings", server),
});

// The main process answers connect-to-mcp-server with a transferred
// MessagePort speaking raw JSON-RPC message objects; the page's MCP client
// picks it up from a window message, exactly like the official preload.
ipcRenderer.on("mcp-server-connected", (event, payload: unknown) => {
  const detail =
    payload && typeof payload === "object"
      ? (payload as { serverName?: unknown; uuid?: unknown })
      : {};
  window.postMessage(
    {
      type: "mcp-server-connected",
      serverName: detail.serverName,
      uuid: detail.uuid,
    },
    "*",
    event.ports,
  );
});

contextBridge.exposeInMainWorld("claudeAppSettings", {
  filePickers: {
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
  },
});

const webNamespace = namespaces["claude.web"] as
  Record<string, unknown> | undefined;
const hybridNamespace = namespaces["claude.hybrid"] as
  Record<string, unknown> | undefined;
if (webNamespace?.WindowControl)
  contextBridge.exposeInMainWorld(
    "electronWindowControl",
    webNamespace.WindowControl,
  );
if (hybridNamespace?.DesktopIntl)
  contextBridge.exposeInMainWorld("electronIntl", hybridNamespace.DesktopIntl);

webFrame.insertCSS(`
  * { text-rendering: optimizeLegibility; }
  ::-webkit-scrollbar { width: 12px; height: 12px; }
  ::-webkit-scrollbar-thumb { background: color-mix(in srgb, currentColor 28%, transparent); border-radius: 6px; border: 3px solid transparent; background-clip: content-box; }
`);
