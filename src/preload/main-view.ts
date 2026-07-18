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
const namespaces = exposeContract("mainView.js");
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
  const sessionService = (
    namespaces["claude.web"] as
      | { LocalAgentModeSessions?: { start?: (input: unknown) => unknown } }
      | undefined
  )?.LocalAgentModeSessions;
  installLocalWorkbench({
    startCoworkSession:
      typeof sessionService?.start === "function"
        ? (input) =>
            Promise.resolve(
              sessionService.start!(input),
            ) as Promise<{ sessionId?: string } | null | undefined>
        : undefined,
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
