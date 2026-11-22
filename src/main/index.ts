import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  protocol,
  safeStorage,
  session,
  shell,
  WebContents,
  WebContentsView,
} from "electron";
import { PRELOAD_CHANNELS } from "../generated/ipc-contract";
import {
  isLocalDeepLink,
  LOCAL_APP_NAME,
  LOCAL_APP_USER_MODEL_ID,
  LOCAL_PROFILE_ENV,
  localProfilePaths,
} from "../shared/app-identity";
import { parseChannel, serviceKey } from "../shared/channels";
import { RETAINED_DESKTOP_VERSION } from "../shared/desktop-version";
import {
  isTrustedRendererUrl,
  originOf,
  TRUSTED_REMOTE_ORIGINS,
} from "../shared/security";
import {
  assertLocalIpcSender,
  assertTrustedIpcSender,
  registerGeneratedIpc,
} from "./ipc";
import {
  disposeLocalDictation,
  installLocalUiProtocol,
  registerAppScheme,
} from "./local-ui";
import { LocalBackend, type LocalSecretCodec } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";
import { LocalFilePreview } from "./local-file-preview";
import { LocalLaunchPreview } from "./local-launch-preview";
import { LocalMcpManager } from "./local-mcp";
import { LocalMcpOAuthManager } from "./local-mcp-oauth";
import { LocalMcpPortBridge } from "./local-mcp-bridge";
import { LocalBrowserUse } from "./local-browser";
import { LocalComputerUse } from "./local-computer";
import { LocalPluginManager } from "./local-plugins";
import { LocalScheduledTasks } from "./local-scheduled-tasks";
import { LocalTrayController } from "./local-tray";
import { LocalSandbox } from "./local-sandbox";
import { LocalArtifactTunnel } from "./local-tunnel";
import { LocalWebTools } from "./local-web-tools";
import { diagnosticError, LocalDiagnostics } from "./local-diagnostics";
import { featureMatrix, ServiceContext, ServiceDispatcher } from "./services";
import { StateStore } from "./state";

registerAppScheme();

// Electron derives its Chromium profile, single-instance lock, taskbar group,
// logs, and several caches from application identity. Set all of them before
// readiness so this app cannot attach to or write into Anthropic's profile.
app.name = LOCAL_APP_NAME;
app.setAppUserModelId(LOCAL_APP_USER_MODEL_ID);
// Chromium freezes rAF and CSS-transition completion in occluded or
// backgrounded frames — including the artifact sandbox iframe, whose stuck
// expand transition leaves a 0x0 pane when the window is covered.
// backgroundThrottling:false only covers the main view's own frame, so
// disable occlusion throttling process-wide.
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-background-timer-throttling");
const profilePaths = localProfilePaths(
  app.getPath("appData"),
  process.env[LOCAL_PROFILE_ENV] ??
    // Retain the development/test override used before the v0.0.1 rename.
    process.env.CLAUDE_LOCAL_USER_DATA_DIR,
  { packaged: app.isPackaged, temporaryRoot: app.getPath("temp") },
);
for (const directory of Object.values(profilePaths))
  mkdirSync(directory, { recursive: true });
app.setPath("userData", profilePaths.userData);
app.setPath("sessionData", profilePaths.sessionData);
app.setPath("cache", profilePaths.cache);
app.setPath("crashDumps", profilePaths.crashDumps);
app.setAppLogsPath(profilePaths.logs);
if (process.env.CLAUDE_TRACE_APP_IDENTITY === "1")
  console.error(
    `[local-app-identity] ${JSON.stringify({
      name: app.name,
      appUserModelId: LOCAL_APP_USER_MODEL_ID,
      ...profilePaths,
    })}`,
  );

let mainWindow: BrowserWindow | null = null;
let mainView: WebContentsView | null = null;
let state: StateStore;
let disposeIpc: (() => void) | null = null;
let codeSessions: LocalCodeSessionManager | null = null;
let localBackend: LocalBackend | null = null;
let localWebTools: LocalWebTools | null = null;
let localFilePreview: LocalFilePreview | null = null;
let localLaunchPreview: LocalLaunchPreview | null = null;
let localMcpManager: LocalMcpManager | null = null;
let localMcpOAuth: LocalMcpOAuthManager | null = null;
let localMcpPortBridge: LocalMcpPortBridge | null = null;
let localSandbox: LocalSandbox | null = null;
let localBrowserUse: LocalBrowserUse | null = null;
let localComputerUse: LocalComputerUse | null = null;
let localScheduledTasks: LocalScheduledTasks | null = null;
let localArtifactTunnel: LocalArtifactTunnel | null = null;
let localTray: LocalTrayController | null = null;
let diagnostics: LocalDiagnostics | null = null;
let targetUrl = "https://claude.ai";
const pendingOAuthDeepLinks: string[] = [];
let oauthRuntimeReady = false;

process.on("uncaughtException", (error, origin) => {
  diagnostics?.record(
    "main-process",
    "uncaught-exception",
    { origin, error: diagnosticError(error) },
    "error",
  );
});
process.on("unhandledRejection", (reason) => {
  diagnostics?.record(
    "main-process",
    "unhandled-rejection",
    { error: diagnosticError(reason) },
    "error",
  );
});

function preloadPath(name: "preload-main-view" | "preload-shell"): string {
  return path.join(app.getAppPath(), "dist-electron", `${name}.cjs`);
}

function rendererPath(): string {
  return path.join(app.getAppPath(), "dist", "index.html");
}

// The Open-Claude window icon. electron-builder sets the .exe icon, but the
// running window (and any dev/unpacked run) needs it set explicitly or it
// falls back to the default Electron icon. Bundled to resources/icon.png in
// packaged builds; the source asset is used in development.
function appIconPath(): string | undefined {
  const candidates = [
    process.platform === "win32" && process.resourcesPath
      ? path.join(process.resourcesPath, "icon.ico")
      : null,
    process.resourcesPath ? path.join(process.resourcesPath, "icon.png") : null,
    process.platform === "win32"
      ? path.join(app.getAppPath(), ".package-assets", "icon.ico")
      : null,
    path.join(app.getAppPath(), ".package-assets", "icon.png"),
    process.platform === "win32"
      ? path.join(process.cwd(), ".package-assets", "icon.ico")
      : null,
    path.join(process.cwd(), ".package-assets", "icon.png"),
  ];
  return candidates.find(
    (candidate): candidate is string => !!candidate && existsSync(candidate),
  );
}

function isShellNavigation(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).href === pathToFileURL(rendererPath()).href;
  } catch {
    return false;
  }
}

function isUiRoot(candidate: string | undefined): candidate is string {
  return Boolean(candidate && existsSync(path.join(candidate, "index.html")));
}

function compareVersions(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

async function installedClaudeVersions(installRoot: string): Promise<string[]> {
  try {
    return (await readdir(installRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^app-\d/.test(entry.name))
      .map((entry) => entry.name.slice(4))
      .sort(compareVersions);
  } catch {
    return [];
  }
}

async function localUiRoot(): Promise<string | null> {
  const explicit = process.env.CLAUDE_ION_DIST;
  if (isUiRoot(explicit)) return explicit;
  const packagedSnapshot = path.join(process.resourcesPath, "ion-dist");
  if (isUiRoot(packagedSnapshot)) return packagedSnapshot;
  // Packaging stages the retained renderer in the repository before invoking
  // electron-builder. Reuse that exact snapshot for development and probes so
  // an unrelated Claude Desktop auto-update cannot silently change the UI
  // contract under a running Open-Claude worktree.
  const stagedSnapshot = path.join(
    app.getAppPath(),
    ".package-assets",
    "ion-dist",
  );
  if (!app.isPackaged && isUiRoot(stagedSnapshot)) return stagedSnapshot;
  const preferredVersion =
    process.env.CLAUDE_DESKTOP_VERSION ?? app.getVersion();
  const repositorySnapshot = path.join(
    app.getAppPath(),
    "reference",
    `claude-${preferredVersion}`,
    "ion-dist",
  );
  if (isUiRoot(repositorySnapshot)) return repositorySnapshot;

  const privateSnapshot = path.join(
    profilePaths.userData,
    "UI Assets",
    `claude-${preferredVersion}`,
    "ion-dist",
  );
  if (isUiRoot(privateSnapshot)) return privateSnapshot;

  // Release builds are self-contained. Never make an installed Open-Claude
  // instance depend on or read UI files from Anthropic's installed app.
  if (app.isPackaged) return null;

  const installRoot = path.join(
    process.env.ProgramData ?? "C:\\ProgramData",
    process.env.USERNAME ?? "",
    "AnthropicClaude",
  );
  const installedVersions = await installedClaudeVersions(installRoot);
  const installedVersion = installedVersions.includes(preferredVersion)
    ? preferredVersion
    : installedVersions.at(-1);
  if (!installedVersion) return null;
  const installedSource = path.join(
    installRoot,
    `app-${installedVersion}`,
    "resources",
    "ion-dist",
  );
  if (!isUiRoot(installedSource)) return null;
  if (process.env.CLAUDE_LOCAL_SKIP_UI_SNAPSHOT === "1") return installedSource;

  const versionedPrivateSnapshot = path.join(
    profilePaths.userData,
    "UI Assets",
    `claude-${installedVersion}`,
    "ion-dist",
  );
  if (isUiRoot(versionedPrivateSnapshot)) return versionedPrivateSnapshot;

  // Take a private, immutable-at-runtime snapshot. The installed application
  // is only read once and is never served from or modified during later runs.
  const temporary = `${versionedPrivateSnapshot}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(versionedPrivateSnapshot), { recursive: true });
  try {
    await cp(installedSource, temporary, { recursive: true });
    await rename(temporary, versionedPrivateSnapshot);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
  return versionedPrivateSnapshot;
}

function eventChannel(service: string, method: string): string | undefined {
  return PRELOAD_CHANNELS.find((contract) => {
    const parsed = parseChannel(contract.channel);
    return parsed && serviceKey(parsed) === service && parsed.method === method;
  })?.channel;
}

function sendTo(
  contents: WebContents | undefined | null,
  channel: string,
  ...args: unknown[]
): void {
  if (!contents || contents.isDestroyed()) return;
  contents.send(channel, ...args);
}

function broadcast(channel: string, ...args: unknown[]): void {
  sendTo(mainView?.webContents, channel, ...args);
  for (const window of BrowserWindow.getAllWindows())
    sendTo(window.webContents, channel, ...args);
}

function isInternalNavigation(rawUrl: string): boolean {
  try {
    const origin = originOf(rawUrl);
    return Boolean(
      origin &&
      (TRUSTED_REMOTE_ORIGINS.has(origin) || origin === "app://localhost"),
    );
  } catch {
    return false;
  }
}

function openExternal(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!["https:", "http:", "mailto:", "tel:", "sms:"].includes(url.protocol))
      return false;
    void shell.openExternal(url.toString());
    return true;
  } catch {
    return false;
  }
}

function installNavigationPolicy(contents: WebContents): void {
  contents.on("will-navigate", (event, url) => {
    if (!isInternalNavigation(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  contents.on("will-redirect", (event, url) => {
    if (!isInternalNavigation(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isInternalNavigation(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          backgroundColor: "#f5f4ef",
          webPreferences: {
            preload: preloadPath("preload-main-view"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            additionalArguments: [
              `--desktop-app-version=${RETAINED_DESKTOP_VERSION}`,
            ],
          },
        },
      };
    }
    openExternal(url);
    return { action: "deny" };
  });
}

function updateViewBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !mainView) return;
  const bounds = mainWindow.getContentBounds();
  mainView.setBounds({
    x: 0,
    y: 0,
    width: bounds.width,
    height: bounds.height,
  });
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady() && !shutdownComplete) createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const iconPath = appIconPath();
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: "#f5f4ef",
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#55524d",
      height: 38,
    },
    webPreferences: {
      preload: preloadPath("preload-shell"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      additionalArguments: [
        `--desktop-app-version=${RETAINED_DESKTOP_VERSION}`,
        "--desktop-enterprise-config={}",
      ],
    },
  });

  const view = new WebContentsView({
    webPreferences: {
      preload: preloadPath("preload-main-view"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Keep the retained UI's frame clock running while the window is
      // hidden or fully occluded. base-ui dialogs (Settings, publish,
      // connectors) finish closing only after their exit transition ends;
      // with throttling on, a covered window freezes requestAnimationFrame
      // and those dialogs deadlock open.
      backgroundThrottling: false,
      additionalArguments: [
        `--desktop-app-version=${RETAINED_DESKTOP_VERSION}`,
        `--desktop-features=${JSON.stringify(featureMatrix())}`,
        "--desktop-enterprise-config={}",
        `--desktop-telemetry-config=${JSON.stringify({
          deploymentMode: "1p",
          appVersion: app.getVersion(),
          cookielessOrigin: targetUrl.startsWith("app:"),
        })}`,
        ...(process.env.CLAUDE_TRACE_LOCAL_API === "1"
          ? ["--desktop-trace-local-api"]
          : []),
        ...(targetUrl.startsWith("app:") ? ["--desktop-local-backend"] : []),
      ],
    },
  });
  mainWindow = window;
  mainView = view;
  diagnostics?.record(
    "renderer",
    "webcontents.created",
    {
      id: view.webContents.id,
      targetUrl,
    },
    "info",
  );
  // The retained client distinguishes its native Code surface from the web
  // Code product by the official desktop user-agent token. Without this it
  // redirects /code and /epitaxy into cloud-only enrollment pages. The token
  // must carry the retained shell's version, not ours: the renderer
  // semver-gates surfaces on it (the Desktop app settings group with the
  // Local MCP servers page needs >= 0.12.0, which "0.0.1" failed). The
  // default UA's own "Open-Claude/<version>" token must go: the renderer's
  // version regex is unanchored and case-insensitive, so it reads the
  // "Claude/0.0.1" inside it before ever reaching the real token.
  view.webContents.setUserAgent(
    `${view.webContents
      .getUserAgent()
      .replace(
        ` ${app.name}/${app.getVersion()}`,
        "",
      )} Claude/${RETAINED_DESKTOP_VERSION}`,
  );
  if (process.env.CLAUDE_TRACE_LOCAL_API === "1") {
    view.webContents.on(
      "console-message",
      (_event, level, message, lineNumber, sourceId) => {
        console.error(
          `[local-ui:${level}] ${message} (${sourceId}:${lineNumber})`,
        );
      },
    );
    try {
      view.webContents.debugger.attach("1.3");
      view.webContents.debugger.on("message", (_event, method, params) => {
        if (method === "Runtime.exceptionThrown")
          console.error(
            "[local-ui-exception]",
            JSON.stringify(params, null, 2),
          );
      });
      void view.webContents.debugger.sendCommand("Runtime.enable");
    } catch (error) {
      console.error("[local-ui-debugger]", error);
    }
  }
  view.webContents.on(
    "console-message",
    (_event, level, message, lineNumber, sourceId) => {
      diagnostics?.record(
        "renderer",
        "console",
        { level, message, lineNumber, sourceId },
        level >= 3 ? "error" : level >= 2 ? "warn" : "debug",
      );
    },
  );
  view.webContents.on("render-process-gone", (_event, details) => {
    diagnostics?.record("renderer", "process.gone", { ...details }, "error");
  });
  view.webContents.on("unresponsive", () => {
    diagnostics?.record("renderer", "unresponsive", {}, "warn");
  });
  view.webContents.on("responsive", () => {
    diagnostics?.record("renderer", "responsive", {}, "info");
  });
  window.contentView.addChildView(view);
  updateViewBounds();
  installNavigationPolicy(view.webContents);

  const broadcastNavigationState = () => {
    if (view.webContents.isDestroyed()) return;
    const channel = eventChannel(
      "claude.web.BrowserNavigation",
      "navigationState_$store$_update",
    );
    if (channel)
      broadcast(channel, {
        canGoBack: view.webContents.navigationHistory.canGoBack(),
        canGoForward: view.webContents.navigationHistory.canGoForward(),
      });
  };

  view.webContents.on(
    "did-start-navigation",
    (_event, url, sameDocument, isMainFrame) => {
      if (!isMainFrame) return;
      // The native Code preview is a child WebContentsView, not part of the
      // routed page. Release it (and its consumer lock) whenever the main app
      // changes route so it cannot cover Chat or block a later reopen.
      localFilePreview?.hide();
      diagnostics?.record("renderer", "navigation.begin", {
        url,
        sameDocument,
      });
      if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
        console.error(
          `[local-navigation] ${sameDocument ? "same-document" : "document"} ${url}`,
        );
      // Chromium updates its history entry after this event for same-document
      // router transitions, so report once now and once after the current turn.
      broadcastNavigationState();
      setTimeout(broadcastNavigationState, 0);
    },
  );
  view.webContents.on("did-navigate", broadcastNavigationState);
  view.webContents.on("did-navigate-in-page", broadcastNavigationState);
  view.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame || errorCode === -3) return;
      diagnostics?.record(
        "renderer",
        "navigation.failed",
        {
          errorCode,
          errorDescription,
          url: validatedUrl,
        },
        "error",
      );
      const channel = eventChannel(
        "claude.internal.ui.MainWindowTitleBar",
        "showLoadError",
      );
      if (channel)
        broadcast(channel, { errorCode, errorDescription, url: validatedUrl });
    },
  );
  view.webContents.on("did-finish-load", () => {
    diagnostics?.record(
      "renderer",
      "navigation.finished",
      {
        url: view.webContents.getURL(),
      },
      "info",
    );
    const channel = eventChannel(
      "claude.internal.ui.MainWindowTitleBar",
      "hideLoadError",
    );
    if (channel) broadcast(channel);
  });

  window.on("resize", updateViewBounds);
  window.on("maximize", updateViewBounds);
  window.on("unmaximize", updateViewBounds);
  window.on("enter-full-screen", () => {
    const channel = eventChannel("claude.web.WindowState", "fullscreenChanged");
    if (channel) broadcast(channel, true);
  });
  window.on("leave-full-screen", () => {
    const channel = eventChannel("claude.web.WindowState", "fullscreenChanged");
    if (channel) broadcast(channel, false);
  });
  window.on("show", () => {
    const channel = eventChannel("claude.web.WindowState", "visibilityChanged");
    if (channel) broadcast(channel, true);
  });
  window.on("hide", () => {
    const channel = eventChannel("claude.web.WindowState", "visibilityChanged");
    if (channel) broadcast(channel, false);
  });
  window.on("close", (event) => {
    if (shutdownComplete || !localTray?.enabled) return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => {
    mainWindow = null;
    mainView = null;
  });

  void window.loadFile(rendererPath());
  void view.webContents.loadURL(targetUrl);
  window.once("ready-to-show", () => window.show());
  return window;
}

function installPermissionPolicy(): void {
  const trustedLocal = (
    webContents: WebContents | null,
    requestingUrl: string,
  ) => {
    if (!webContents) return false;
    const topUrl = webContents.getURL();
    return (
      originOf(requestingUrl) === "app://localhost" &&
      originOf(topUrl) === "app://localhost"
    );
  };
  const allowed = (
    webContents: WebContents | null,
    permission: string,
    requestingUrl: string,
    details: Record<string, unknown>,
  ) => {
    if (!trustedLocal(webContents, requestingUrl)) return false;
    if (
      permission === "fullscreen" ||
      permission === "clipboard-read" ||
      permission === "clipboard-sanitized-write" ||
      permission === "notifications"
    )
      return true;
    if (permission !== "media") return false;
    const mediaTypes = Array.isArray(details.mediaTypes)
      ? details.mediaTypes
      : [];
    return (
      mediaTypes.length > 0 && mediaTypes.every((type) => type === "audio")
    );
  };
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      callback(
        allowed(
          contents,
          permission,
          details.requestingUrl,
          details as unknown as Record<string, unknown>,
        ),
      );
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, requestingOrigin, details) =>
      allowed(
        contents,
        permission,
        requestingOrigin || details.requestingUrl || "",
        details as unknown as Record<string, unknown>,
      ),
  );
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    if (
      details.resourceType === "mainFrame" &&
      !isInternalNavigation(details.url) &&
      !isShellNavigation(details.url)
    )
      callback({ cancel: true });
    else callback({ cancel: false });
  });
}

function installSpecialIpc(dispatcher: ServiceDispatcher): void {
  ipcMain.removeHandler("list-mcp-servers");
  ipcMain.removeHandler("connect-to-mcp-server");
  ipcMain.removeHandler("request-open-mcp-settings");
  ipcMain.removeHandler("local-pick-directory");
  ipcMain.removeHandler("local-artifact-screenshot");
  ipcMain.removeHandler("local-open-settings");
  ipcMain.removeHandler("local-chrome-action");
  ipcMain.removeHandler("local-code-artifact-details");
  ipcMain.removeHandler("open-claude-local-sessions");
  ipcMain.removeHandler("open-claude-connector-oauth");
  ipcMain.handle("list-mcp-servers", (event) => {
    assertLocalIpcSender(event);
    // The retained client expects an array of server names and connects to
    // each by name.
    return dispatcher.listMcpServers().map((server) => server.name);
  });
  ipcMain.handle("connect-to-mcp-server", (event, server) => {
    assertLocalIpcSender(event);
    if (typeof server !== "string")
      throw new Error("connect-to-mcp-server expects a server name");
    localMcpPortBridge?.connect(event.sender, server);
  });
  ipcMain.handle("request-open-mcp-settings", (event) => {
    assertLocalIpcSender(event);
    return undefined;
  });
  ipcMain.handle("local-pick-directory", async (event) => {
    assertLocalIpcSender(event);
    const options: Electron.OpenDialogOptions = {
      title: "Select a workspace folder",
      properties: ["openDirectory", "createDirectory"],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  ipcMain.handle("local-artifact-screenshot", async (event, payload) => {
    assertLocalIpcSender(event);
    // Rasterizes artifact content in a hidden offscreen window: the visible
    // pane may be occluded by the publish modal, and the local sandbox
    // renderer cannot screenshot itself.
    const content = typeof payload?.content === "string" ? payload.content : "";
    const type = typeof payload?.type === "string" ? payload.type : "";
    if (!content || Buffer.byteLength(content, "utf8") > 2_000_000) return null;
    if (type !== "text/html" && type !== "image/svg+xml") return null;
    const html =
      type === "image/svg+xml"
        ? `<!doctype html><style>html,body{margin:0;background:#fff}svg{max-width:100%;height:auto}</style>${content}`
        : content;
    const capture = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        offscreen: true,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        partition: `local-artifact-capture-${randomUUID()}`,
      },
    });
    let timer: NodeJS.Timeout | undefined;
    try {
      // The capture stays fully local: only data/blob/about URLs may load.
      const captureSession = capture.webContents.session;
      captureSession.setPermissionCheckHandler(() => false);
      captureSession.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false),
      );
      captureSession.on("will-download", (event) => event.preventDefault());
      captureSession.webRequest.onBeforeRequest((details, callback) => {
        callback({ cancel: !/^(data|blob|about):/i.test(details.url) });
      });
      capture.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      capture.webContents.on("will-attach-webview", (event) =>
        event.preventDefault(),
      );
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          if (!capture.isDestroyed()) capture.webContents.stop();
          reject(new Error("Artifact screenshot timed out"));
        }, 15_000);
        timer.unref?.();
      });
      const dataUrl = await Promise.race([
        (async () => {
          await capture.loadURL(
            `data:text/html;charset=utf-8;base64,${Buffer.from(html, "utf8").toString("base64")}`,
          );
          // Let scripts and layout settle before compositing.
          await new Promise((resolve) => setTimeout(resolve, 500));
          const image = await capture.webContents.capturePage();
          if (image.isEmpty()) return null;
          return image.toDataURL();
        })(),
        timeout,
      ]);
      if (!dataUrl) return null;
      // The publish flow rejects payloads above 10 MiB.
      return dataUrl.length > 10_000_000 ? null : dataUrl;
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      capture.destroy();
    }
  });
  ipcMain.handle("local-open-settings", (event) => {
    assertLocalIpcSender(event);
    const channel = eventChannel("claude.web.Navigation", "navigate");
    if (!channel) return false;
    broadcast(channel, "/settings/desktop");
    return true;
  });
  ipcMain.handle("local-chrome-action", (event, action) => {
    assertLocalIpcSender(event);
    return dispatcher.handleChromeAction(action, event);
  });
  ipcMain.handle("open-claude-launch-overlay", (event, open) => {
    assertLocalIpcSender(event);
    if (!localLaunchPreview)
      throw new Error("The local preview manager is unavailable");
    return localLaunchPreview.setNativePreviewOverlayOpen(open);
  });
  ipcMain.handle("local-code-artifact-details", async (event, id) => {
    assertLocalIpcSender(event);
    if (!codeSessions || typeof id !== "string") return null;
    const artifact = await codeSessions.invoke("readArtifactById", [id]);
    if (!artifact || typeof artifact !== "object") return null;
    const value = artifact as Record<string, unknown>;
    return typeof value.sessionId === "string" && typeof value.path === "string"
      ? {
          id,
          sessionId: value.sessionId,
          path: value.path,
          title: typeof value.title === "string" ? value.title : "Artifact",
        }
      : null;
  });
  const localSessionExtensions = new Set([
    "deleteLocalSkill",
    "getAllArtifacts",
    "getLocalSkillFiles",
    "listLocalSkills",
    "revealLocalSkill",
    "saveLocalSkill",
    "setLocalSkillEnabled",
  ]);
  ipcMain.handle(
    "open-claude-local-sessions",
    async (event, method, ...args) => {
      assertLocalIpcSender(event);
      if (typeof method !== "string" || !localSessionExtensions.has(method))
        throw new Error("Unsupported LocalSessions extension method");
      return dispatcher.invoke(
        {
          channel: "open-claude-local-sessions",
          kind: "message",
          generatorId: "open-claude",
          namespace: "claude.web",
          service: "LocalSessions",
          method,
        },
        args,
        event,
      );
    },
  );
  ipcMain.handle(
    "open-claude-connector-oauth",
    async (event, action, payload) => {
      assertLocalIpcSender(event);
      if (!localBackend || !localMcpOAuth)
        throw new Error("Local OAuth connectors are unavailable");
      if (action === "list-presets") return localMcpOAuth.presets();
      if (action === "status") {
        const uuid = typeof payload?.uuid === "string" ? payload.uuid : "";
        return uuid ? localMcpOAuth.stateFor(uuid) : null;
      }
      if (action === "open-setup" || action === "open-docs") {
        const preset =
          typeof payload?.preset === "string" ? payload.preset : "";
        const definition = localMcpOAuth
          .presets()
          .find((candidate) => candidate.id === preset);
        const target =
          action === "open-docs" ? definition?.docsUrl : definition?.setupUrl;
        if (typeof target !== "string")
          throw new Error("Unknown OAuth connector preset");
        await shell.openExternal(target);
        return true;
      }
      const uuid = typeof payload?.uuid === "string" ? payload.uuid : "";
      if (!uuid) throw new Error("Connector identifier is required");
      if (action === "cancel") {
        localMcpOAuth.cancel(uuid);
        return true;
      }
      if (action === "disconnect") {
        await localMcpOAuth.disconnect(uuid);
        localMcpManager?.remoteServersChanged();
        return true;
      }
      if (action === "start") {
        const connector = localBackend.remoteMcpServer(uuid);
        if (!connector) throw new Error("Connector not found");
        const result = await localMcpOAuth.start(connector, {
          preset: payload?.preset,
          clientId: payload?.clientId,
          clientSecret: payload?.clientSecret,
          access: payload?.access,
        });
        const authorizationUrl = result.authorizationUrl;
        if (typeof authorizationUrl !== "string")
          throw new Error("OAuth provider URL was not generated");
        await shell.openExternal(authorizationUrl);
        return {
          uuid,
          redirectUri: result.redirectUri,
          expiresAt: result.expiresAt,
        };
      }
      throw new Error("Unsupported OAuth connector action");
    },
  );
}

function dispatchDeepLink(url: string): void {
  let isOAuthCallback = false;
  try {
    const parsed = new URL(url);
    isOAuthCallback =
      parsed.protocol === "open-claude:" &&
      parsed.hostname === "oauth" &&
      parsed.pathname === "/slack";
  } catch {
    return;
  }
  if (isOAuthCallback && !localMcpOAuth && !oauthRuntimeReady) {
    if (pendingOAuthDeepLinks.length < 8) pendingOAuthDeepLinks.push(url);
    return;
  }
  void (async () => {
    if (isOAuthCallback && (await localMcpOAuth?.handleCallbackUrl(url))) {
      showMainWindow();
      return;
    }
    const channel = eventChannel("claude.web.DeepLink", "handleDeepLink");
    if (channel) broadcast(channel, url);
  })().catch((error) => console.error("Deep-link handling failed", error));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    showMainWindow();
    const deepLink = argv.find(isLocalDeepLink);
    if (deepLink) dispatchDeepLink(deepLink);
  });

  app.on("open-url", (event, url) => {
    if (!isLocalDeepLink(url)) return;
    event.preventDefault();
    dispatchDeepLink(url);
    showMainWindow();
  });

  app
    .whenReady()
    .then(async () => {
      diagnostics = new LocalDiagnostics(app.getPath("logs"));
      diagnostics.record(
        "app",
        "runtime.ready",
        {
          version: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
          packaged: app.isPackaged,
        },
        "info",
      );
      state = new StateStore(app.getPath("userData"));
      localWebTools = new LocalWebTools(
        app.getPath("userData"),
        app.getAppPath(),
      );
      localBackend = null;
      const ionRoot = await localUiRoot();
      const useLocalUi =
        process.env.CLAUDE_DESKTOP_LOCAL_UI === "1" ||
        (process.env.CLAUDE_DESKTOP_LOCAL_UI !== "0" &&
          !process.env.CLAUDE_DESKTOP_URL);
      if (useLocalUi) {
        if (!ionRoot)
          throw new Error(
            "Local UI mode is enabled but no ion-dist directory was found. Set CLAUDE_ION_DIST or install the observed Claude Desktop build.",
          );
        const localSecretCodec: LocalSecretCodec | undefined =
          safeStorage.isEncryptionAvailable()
            ? {
                seal: (value) =>
                  safeStorage.encryptString(value).toString("base64"),
                open: (value) =>
                  safeStorage.decryptString(Buffer.from(value, "base64")),
              }
            : undefined;
        localBackend = await LocalBackend.create(
          app.getPath("userData"),
          localWebTools,
          localSecretCodec,
          diagnostics,
        );
        localMcpOAuth = await LocalMcpOAuthManager.create(
          app.getPath("userData"),
          localSecretCodec,
          {
            onChanged: () => localMcpManager?.remoteServersChanged(),
          },
        );
        await localMcpOAuth.prune(
          localBackend.remoteMcpServers().map((server) => server.uuid),
        );
        targetUrl = "app://localhost/new?mode=chat&surface=chat";
      } else if (process.env.CLAUDE_DESKTOP_URL) {
        const candidate = new URL(process.env.CLAUDE_DESKTOP_URL);
        const allowed =
          TRUSTED_REMOTE_ORIGINS.has(candidate.origin) ||
          (process.env.CLAUDE_ALLOW_DEV_ORIGINS === "1" &&
            ["localhost", "127.0.0.1"].includes(candidate.hostname));
        if (!allowed)
          throw new Error(
            `Refusing untrusted CLAUDE_DESKTOP_URL origin: ${candidate.origin}`,
          );
        targetUrl = candidate.toString();
      }
      oauthRuntimeReady = true;
      for (const deepLink of pendingOAuthDeepLinks.splice(0))
        dispatchDeepLink(deepLink);

      codeSessions = await LocalCodeSessionManager.create(
        app.getPath("userData"),
        () => localBackend?.provider() ?? null,
        (codeEvent) => {
          const channel = eventChannel("claude.web.LocalSessions", "onEvent");
          if (channel) broadcast(channel, codeEvent);
        },
        (request) => {
          const channel = eventChannel(
            "claude.web.LocalSessions",
            "onToolPermissionRequest",
          );
          if (channel) broadcast(channel, request);
        },
        localWebTools,
        diagnostics,
      );
      localFilePreview = new LocalFilePreview(() => mainWindow, codeSessions);
      localLaunchPreview = new LocalLaunchPreview(
        () => mainWindow,
        codeSessions,
        (servers) => {
          void state.update((draft) => {
            draft.stores.activeServers = servers;
          });
          const channel = eventChannel(
            "claude.web.Launch",
            "activeServers_$store$_update",
          );
          if (channel) broadcast(channel, servers);
        },
        (serverId, context) => {
          const channel = eventChannel("claude.web.Launch", "elementSelected");
          if (channel) broadcast(channel, serverId, context);
        },
        (serverId, tabs, activeTabId) => {
          const channel = eventChannel(
            "claude.web.Launch",
            "onPreviewTabsChanged",
          );
          if (channel) broadcast(channel, serverId, tabs, activeTabId);
        },
        (serverId, url) => {
          const channel = eventChannel(
            "claude.web.Launch",
            "onPreviewUrlChanged",
          );
          if (channel) broadcast(channel, serverId, url);
        },
        (serverId, sessionId, tabId) => {
          const channel = eventChannel(
            "claude.web.Launch",
            "onPreviewRevealRequested",
          );
          if (channel) broadcast(channel, serverId, sessionId, tabId);
        },
        diagnostics,
      );
      codeSessions.setBrowserTools(localLaunchPreview);
      if (useLocalUi && ionRoot && localBackend) {
        localArtifactTunnel = new LocalArtifactTunnel(localBackend);
        await installLocalUiProtocol(
          ionRoot,
          localBackend,
          codeSessions,
          localArtifactTunnel,
          diagnostics,
          {
            rendererVersion: RETAINED_DESKTOP_VERSION,
            // Candidate mode is deliberately development-only. Installed
            // builds always keep the complete fail-closed release gate.
            patchMode:
              !app.isPackaged &&
              process.env.OPEN_CLAUDE_PATCH_MODE === "compatible"
                ? "compatible"
                : "strict",
          },
        );
        if (localBackend.publishedArtifacts().length > 0)
          void localArtifactTunnel.ensureStarted().then(async (publicUrl) => {
            if (!publicUrl) await localBackend?.revokePublishedArtifacts();
          });
        // Earlier releases served app:// assets without Cache-Control while
        // keeping stable version-hashed URLs, so an upgraded install could
        // revive stale renderer chunks from the profile HTTP cache. Assets
        // are served no-store now; purge whatever an old build left behind.
        await session.defaultSession.clearCache().catch(() => undefined);
      }
      const localPlugins = new LocalPluginManager(app.getPath("userData"));
      codeSessions.setPluginSource(localPlugins);
      localScheduledTasks = new LocalScheduledTasks(
        app.getPath("userData"),
        codeSessions,
        (taskEvent) => {
          const channel = eventChannel(
            "claude.web.CCDScheduledTasks",
            "onScheduledTaskEvent",
          );
          if (channel) broadcast(channel, taskEvent);
        },
      );
      const openRoutines = () => {
        showMainWindow();
        const channel = eventChannel("claude.web.Navigation", "navigate");
        if (channel) broadcast(channel, "/epitaxy/scheduled");
      };
      localTray = new LocalTrayController({
        iconPath: appIconPath(),
        openMainWindow: showMainWindow,
        openRoutines,
        quit: () => app.quit(),
      });
      const context: ServiceContext = {
        state,
        codeSessions,
        localBackend,
        plugins: localPlugins,
        scheduledTasks: localScheduledTasks,
        filePreview: localFilePreview,
        launchPreview: localLaunchPreview,
        mcpManager: () => localMcpManager,
        mainWindow: () => mainWindow,
        mainView: () => mainView,
        broadcast,
        targetUrl: () => targetUrl,
        showMainWindow,
        isMenuBarEnabled: () => localTray?.enabled ?? false,
        setMenuBarEnabled: (enabled) => {
          if (!localTray) throw new Error("The system tray is unavailable");
          if (!enabled && mainWindow && !mainWindow.isVisible())
            showMainWindow();
          localTray.setEnabled(enabled);
        },
      };
      codeSessions.setWorkflowsEnabled(
        () => state.get("appConfig").preferences.enableWorkflows === true,
      );
      codeSessions.setBrowserToolsEnabled(
        () => state.get("appConfig").preferences.launchEnabled !== false,
      );
      if (localBackend) {
        const sessions = codeSessions;
        localBackend.setSkillSource({
          list: async () => {
            const skills = (await sessions.invoke(
              "listLocalSkills",
              [],
            )) as Array<Record<string, unknown>>;
            // Enabled plugins contribute their skills alongside user skills.
            const pluginSkills = await localPlugins
              .enabledSkills()
              .catch(() => []);
            return [
              ...skills
                .filter((skill) => skill.enabled !== false)
                .map((skill) => ({
                  name: String(skill.name ?? ""),
                  description: String(skill.description ?? ""),
                })),
              ...pluginSkills.map((skill) => ({
                name: skill.name,
                description: skill.description,
              })),
            ].filter((skill) => skill.name);
          },
          read: async (name: string) => {
            const pluginSkill = (
              await localPlugins.enabledSkills().catch(() => [])
            ).find((skill) => skill.name === name);
            if (pluginSkill) return pluginSkill.content;
            const files = (await sessions.invoke("getLocalSkillFiles", [
              name,
            ])) as Array<Record<string, unknown>>;
            const manifest = files.find((file) => file.path === "SKILL.md");
            if (!manifest)
              throw new Error(`No skill named “${name}” is available`);
            const supportFiles = files.filter(
              (file) => file.path !== "SKILL.md",
            );
            // Chat has no file tools, so bundle support files inline — but
            // bounded, because some official skills ship megabytes of assets.
            let budget = 48_000;
            const sections: string[] = [
              String(manifest.content ?? "").slice(0, 64_000),
            ];
            const omitted: string[] = [];
            for (const file of supportFiles) {
              const content = String(file.content ?? "");
              const section = `<skill_file path=${JSON.stringify(String(file.path))}>\n${content}\n</skill_file>`;
              if (section.length > budget) {
                omitted.push(String(file.path));
                continue;
              }
              sections.push(section);
              budget -= section.length;
            }
            if (sections.length > 1)
              sections.splice(
                1,
                0,
                "\n\nThis skill also bundles support files (their contents follow):",
              );
            if (omitted.length > 0)
              sections.push(`\n(Omitted for length: ${omitted.join(", ")})`);
            return sections.join("\n");
          },
          files: async (name: string) => {
            const files = (await sessions.invoke("getLocalSkillFiles", [
              name,
            ])) as Array<Record<string, unknown>>;
            return files
              .map((file) => ({
                path: String(file.path ?? ""),
                content: String(file.content ?? ""),
              }))
              .filter((file) => file.path);
          },
        });
        // Docker-backed chat code execution ("wiggle"). The manager is
        // always constructed; the account-level enabled_wiggle setting and
        // Docker availability gate actual use.
        localSandbox = new LocalSandbox(app.getPath("userData"));
        await localBackend.setSandboxSource(localSandbox);
        if (localBackend.accountSettings().enabled_wiggle === true)
          localSandbox.startImageBuild();
        localBrowserUse = new LocalBrowserUse(app.getPath("userData"));
        localBackend.setBrowserSource(localBrowserUse);
        // Computer control asks the user once per conversation through a
        // native modal before the first action executes.
        localComputerUse = new LocalComputerUse(
          app.getPath("userData"),
          async () => {
            const window = mainWindow;
            if (!window || window.isDestroyed()) return false;
            window.show();
            const { response } = await dialog.showMessageBox(window, {
              type: "warning",
              buttons: ["Allow for this conversation", "Don't allow"],
              defaultId: 1,
              cancelId: 1,
              title: "Allow computer control?",
              message:
                "Claude is asking to control this computer for the current conversation.",
              detail:
                "It will be able to see your screen and send real mouse clicks and keystrokes until the conversation ends. You can stop it anytime with the Stop button.",
            });
            return response === 0;
          },
        );
        localBackend.setComputerSource(localComputerUse);
        // The user's configured MCP servers (Settings > Developer) become
        // chat tools through a local stdio JSON-RPC client.
        const backendForMcp = localBackend;
        localMcpManager = new LocalMcpManager(
          () => state.get("appConfig").mcpServers as Record<string, unknown>,
          () => backendForMcp.remoteMcpServers(),
          (uuid, forceRefresh) =>
            localMcpOAuth?.authorizationFor(uuid, forceRefresh) ??
            Promise.resolve(null),
          () => localPlugins.enabledMcpServers(),
        );
        // The Connectors surface's own MCP clients ride MessagePorts bridged
        // to stdio children, one per configured server.
        localMcpPortBridge = new LocalMcpPortBridge(
          () => state.get("appConfig").mcpServers as Record<string, unknown>,
        );
        localBackend.setMcpSource(localMcpManager);
        codeSessions.setMcpSource(localMcpManager);
        const mcpManagerForHooks = localMcpManager;
        localBackend.setRemoteMcpHooks({
          status: (name) => mcpManagerForHooks.statusFor(name),
          changed: () => mcpManagerForHooks.remoteServersChanged(),
          authentication: (uuid) => localMcpOAuth?.stateFor(uuid) ?? null,
          removed: (uuid) => localMcpOAuth?.disconnect(uuid),
        });
      }
      const dispatcher = new ServiceDispatcher(context);
      disposeIpc = registerGeneratedIpc(dispatcher, diagnostics);
      ipcMain.on("open-claude-diagnostic-renderer", (event, payload) => {
        try {
          assertLocalIpcSender(event);
          diagnostics?.record(
            "renderer",
            "window.exception",
            {
              sender: event.senderFrame?.url ?? event.sender.getURL(),
              payload,
            },
            "error",
          );
        } catch (error) {
          diagnostics?.record(
            "security",
            "renderer.diagnostic.blocked",
            { error: diagnosticError(error) },
            "warn",
          );
        }
      });
      installSpecialIpc(dispatcher);
      installPermissionPolicy();
      Menu.setApplicationMenu(null);
      createMainWindow();
      if (state.get("menuBarEnabled")) {
        try {
          localTray.setEnabled(true);
        } catch (error) {
          console.error("Could not restore the system tray setting", error);
          await state.update((draft) => {
            draft.menuBarEnabled = false;
          });
        }
      }
      if (!dispatcher.restoreGlobalShortcut())
        console.error(
          `Could not restore the configured global shortcut: ${state.get("globalShortcut")}`,
        );

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
        else showMainWindow();
      });
    })
    .catch((error) => {
      console.error(`${LOCAL_APP_NAME} failed to launch`, error);
      app.exit(1);
    });
}

let shutdownComplete = false;
let shutdownPromise: Promise<void> | null = null;

async function disposeRuntime(): Promise<void> {
  const disposalFailures: Array<{ component: string; error: unknown }> = [];
  const dispose = async (
    component: string,
    operation: Promise<unknown> | undefined,
  ): Promise<void> => {
    if (!operation) return;
    try {
      await operation;
    } catch (error) {
      disposalFailures.push({ component, error });
      console.error(`[shutdown] ${component} disposal failed`, error);
    }
  };
  localTray?.dispose();
  localTray = null;
  globalShortcut.unregisterAll();
  disposeIpc?.();
  disposeIpc = null;
  // Stop the scheduler first while its session starter is still alive; a
  // missed-run catch-up may already be between start() and its atomic write.
  await dispose("scheduled-tasks", localScheduledTasks?.dispose());
  localScheduledTasks = null;
  const backendDisposal = localBackend?.dispose() ?? Promise.resolve();
  const codeDisposal = codeSessions?.dispose() ?? Promise.resolve();
  // Wake transports and consent waits that are not directly owned by the
  // backend's AbortControllers before awaiting completion-stream teardown.
  localMcpManager?.disposeAll();
  localMcpOAuth?.dispose();
  localMcpPortBridge?.disposeAll();
  localComputerUse?.dispose();
  await Promise.all([
    dispose("local-backend", backendDisposal),
    dispose("local-code", codeDisposal),
  ]);
  localBackend = null;
  codeSessions = null;
  localArtifactTunnel?.dispose();
  localArtifactTunnel = null;
  await dispose("moonshine-dictation", disposeLocalDictation());
  localMcpManager = null;
  localMcpOAuth = null;
  localMcpPortBridge = null;
  await dispose("sandbox", localSandbox?.dispose());
  localSandbox = null;
  await dispose("browser-use", localBrowserUse?.dispose());
  localBrowserUse = null;
  localComputerUse = null;
  await dispose("launch-preview", localLaunchPreview?.dispose());
  localLaunchPreview = null;
  await dispose("file-preview", localFilePreview?.dispose());
  localFilePreview = null;
  await dispose("web-tools", localWebTools?.dispose());
  localWebTools = null;
  await dispose("state-store", state?.dispose());
  diagnostics?.record(
    "app",
    "runtime.disposed",
    {
      disposalFailures: disposalFailures.map(({ component }) => component),
    },
    "info",
  );
  await diagnostics?.flush();
  if (disposalFailures.length > 0)
    console.error(
      `[shutdown] completed with ${disposalFailures.length} disposal failure(s): ${disposalFailures
        .map(({ component }) => component)
        .join(", ")}`,
    );
}

app.on("before-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownPromise) return;
  shutdownPromise = disposeRuntime().finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !localTray?.enabled) app.quit();
});
