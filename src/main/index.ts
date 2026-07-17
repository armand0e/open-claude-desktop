import { existsSync, mkdirSync } from "node:fs";
import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
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
import { installLocalUiProtocol, registerAppScheme } from "./local-ui";
import { LocalBackend } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";
import { LocalFilePreview } from "./local-file-preview";
import { LocalLaunchPreview } from "./local-launch-preview";
import { LocalWebTools } from "./local-web-tools";
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
let localWebTools: LocalWebTools | null = null;
let localFilePreview: LocalFilePreview | null = null;
let localLaunchPreview: LocalLaunchPreview | null = null;
let targetUrl = "https://claude.ai";

function preloadPath(name: "preload-main-view" | "preload-shell"): string {
  return path.join(app.getAppPath(), "dist-electron", `${name}.cjs`);
}

function rendererPath(): string {
  return path.join(app.getAppPath(), "dist", "index.html");
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
            additionalArguments: [`--desktop-app-version=${app.getVersion()}`],
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
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    backgroundColor: "#f5f4ef",
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
        `--desktop-app-version=${app.getVersion()}`,
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
        `--desktop-app-version=${app.getVersion()}`,
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
  // The retained client distinguishes its native Code surface from the web
  // Code product by the official desktop user-agent token. Without this it
  // redirects /code and /epitaxy into cloud-only enrollment pages.
  view.webContents.setUserAgent(
    `${view.webContents.getUserAgent()} Claude/${app.getVersion()}`,
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
      const channel = eventChannel(
        "claude.internal.ui.MainWindowTitleBar",
        "showLoadError",
      );
      if (channel)
        broadcast(channel, { errorCode, errorDescription, url: validatedUrl });
    },
  );
  view.webContents.on("did-finish-load", () => {
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
  ipcMain.handle("list-mcp-servers", (event) => {
    assertTrustedIpcSender(event);
    return dispatcher.listMcpServers();
  });
  ipcMain.handle("connect-to-mcp-server", (event, server) => {
    assertTrustedIpcSender(event);
    return {
      connected: false,
      server,
    };
  });
  ipcMain.handle("request-open-mcp-settings", (event) => {
    assertTrustedIpcSender(event);
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
    if (!content || content.length > 2_000_000) return null;
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
    try {
      // The capture stays fully local: only data/blob/about URLs may load.
      capture.webContents.session.webRequest.onBeforeRequest(
        (details, callback) => {
          callback({ cancel: !/^(data|blob|about):/i.test(details.url) });
        },
      );
      await capture.loadURL(
        `data:text/html;charset=utf-8;base64,${Buffer.from(html, "utf8").toString("base64")}`,
      );
      // Let scripts and layout settle before compositing.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const image = await capture.webContents.capturePage();
      if (image.isEmpty()) return null;
      const dataUrl = image.toDataURL();
      // The publish flow rejects payloads above 10 MiB.
      return dataUrl.length > 10_000_000 ? null : dataUrl;
    } catch {
      return null;
    } finally {
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
}

function dispatchDeepLink(url: string): void {
  const channel = eventChannel("claude.web.DeepLink", "handleDeepLink");
  if (channel) broadcast(channel, url);
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
      state = new StateStore(app.getPath("userData"));
      localWebTools = new LocalWebTools(
        app.getPath("userData"),
        app.getAppPath(),
      );
      let localBackend: LocalBackend | null = null;
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
        localBackend = await LocalBackend.create(
          app.getPath("userData"),
          localWebTools,
          safeStorage.isEncryptionAvailable()
            ? {
                seal: (value) =>
                  safeStorage.encryptString(value).toString("base64"),
                open: (value) =>
                  safeStorage.decryptString(Buffer.from(value, "base64")),
              }
            : undefined,
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
      );
      if (useLocalUi && ionRoot && localBackend) {
        await installLocalUiProtocol(ionRoot, localBackend, codeSessions);
        // Earlier releases served app:// assets without Cache-Control while
        // keeping stable version-hashed URLs, so an upgraded install could
        // revive stale renderer chunks from the profile HTTP cache. Assets
        // are served no-store now; purge whatever an old build left behind.
        await session.defaultSession.clearCache().catch(() => undefined);
      }
      const context: ServiceContext = {
        state,
        codeSessions,
        localBackend,
        filePreview: localFilePreview,
        launchPreview: localLaunchPreview,
        mainWindow: () => mainWindow,
        mainView: () => mainView,
        broadcast,
        targetUrl: () => targetUrl,
        showMainWindow,
      };
      codeSessions.setWorkflowsEnabled(
        () => state.get("appConfig").preferences.enableWorkflows === true,
      );
      if (localBackend) {
        const sessions = codeSessions;
        localBackend.setSkillSource({
          list: async () => {
            const skills = (await sessions.invoke(
              "listLocalSkills",
              [],
            )) as Array<Record<string, unknown>>;
            return skills
              .filter((skill) => skill.enabled !== false)
              .map((skill) => ({
                name: String(skill.name ?? ""),
                description: String(skill.description ?? ""),
              }))
              .filter((skill) => skill.name);
          },
          read: async (name: string) => {
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
        });
      }
      const dispatcher = new ServiceDispatcher(context);
      disposeIpc = registerGeneratedIpc(dispatcher);
      installSpecialIpc(dispatcher);
      installPermissionPolicy();
      Menu.setApplicationMenu(null);
      createMainWindow();

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

app.on("before-quit", () => {
  localLaunchPreview?.dispose();
  localLaunchPreview = null;
  localFilePreview?.dispose();
  localFilePreview = null;
  codeSessions?.dispose();
  codeSessions = null;
  localWebTools?.dispose();
  localWebTools = null;
  disposeIpc?.();
  disposeIpc = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
