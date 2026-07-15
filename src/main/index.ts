import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  protocol,
  session,
  shell,
  WebContents,
  WebContentsView,
} from "electron";
import { PRELOAD_CHANNELS } from "../generated/ipc-contract";
import { parseChannel, serviceKey } from "../shared/channels";
import {
  isTrustedRendererUrl,
  originOf,
  TRUSTED_REMOTE_ORIGINS,
} from "../shared/security";
import { assertTrustedIpcSender, registerGeneratedIpc } from "./ipc";
import { installLocalUiProtocol, registerAppScheme } from "./local-ui";
import { LocalBackend } from "./local-backend";
import { LocalCodeSessionManager } from "./local-code";
import { featureMatrix, ServiceContext, ServiceDispatcher } from "./services";
import { StateStore } from "./state";

registerAppScheme();

app.name = "Claude";
app.setAppUserModelId("com.anthropic.Claude.desktop.reconstructed");
if (process.env.CLAUDE_USER_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.CLAUDE_USER_DATA_DIR));

let mainWindow: BrowserWindow | null = null;
let mainView: WebContentsView | null = null;
let state: StateStore;
let disposeIpc: (() => void) | null = null;
let codeSessions: LocalCodeSessionManager | null = null;
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

function localUiRoot(): string | null {
  const explicit = process.env.CLAUDE_ION_DIST;
  const candidates = [
    explicit,
    path.join(app.getAppPath(), "reference", "claude-1.21459.0", "ion-dist"),
    path.join(
      process.env.ProgramData ?? "C:\\ProgramData",
      process.env.USERNAME ?? "",
      "AnthropicClaude",
      "app-1.21459.0",
      "resources",
      "ion-dist",
    ),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return (
    candidates.find((candidate) =>
      existsSync(path.join(candidate, "index.html")),
    ) ?? null
  );
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
      backgroundThrottling: true,
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

  view.webContents.on(
    "did-start-navigation",
    (_event, url, sameDocument, isMainFrame) => {
      if (!isMainFrame) return;
      if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
        console.error(
          `[local-navigation] ${sameDocument ? "same-document" : "document"} ${url}`,
        );
      const channel = eventChannel(
        "claude.web.BrowserNavigation",
        "navigationState_$store$_update",
      );
      if (channel) {
        broadcast(channel, {
          canGoBack: view.webContents.navigationHistory.canGoBack(),
          canGoForward: view.webContents.navigationHistory.canGoForward(),
        });
      }
    },
  );
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
  const trusted = (webContents: WebContents | null, requestingUrl: string) => {
    if (!webContents) return false;
    const topUrl = webContents.getURL();
    return (
      isTrustedRendererUrl(requestingUrl, false) &&
      isTrustedRendererUrl(topUrl, false)
    );
  };
  session.defaultSession.setPermissionRequestHandler(
    (contents, _permission, callback, details) => {
      callback(trusted(contents, details.requestingUrl));
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, _permission, requestingOrigin, details) =>
      trusted(contents, requestingOrigin || details.requestingUrl || ""),
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
    const deepLink = argv.find((value) => value.startsWith("claude://"));
    if (deepLink) dispatchDeepLink(deepLink);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatchDeepLink(url);
    showMainWindow();
  });

  app
    .whenReady()
    .then(async () => {
      state = new StateStore(app.getPath("userData"));
      let localBackend: LocalBackend | null = null;
      const ionRoot = localUiRoot();
      const useLocalUi =
        process.env.CLAUDE_DESKTOP_LOCAL_UI === "1" ||
        (process.env.CLAUDE_DESKTOP_LOCAL_UI !== "0" &&
          !process.env.CLAUDE_DESKTOP_URL);
      if (useLocalUi) {
        if (!ionRoot)
          throw new Error(
            "Local UI mode is enabled but no ion-dist directory was found. Set CLAUDE_ION_DIST or install the observed Claude Desktop build.",
          );
        localBackend = await LocalBackend.create(app.getPath("userData"));
        await installLocalUiProtocol(ionRoot, localBackend);
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
      );
      const context: ServiceContext = {
        state,
        codeSessions,
        mainWindow: () => mainWindow,
        mainView: () => mainView,
        broadcast,
        targetUrl: () => targetUrl,
        showMainWindow,
      };
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
      console.error("Claude reconstruction failed to launch", error);
      app.exit(1);
    });
}

app.on("before-quit", () => {
  codeSessions?.dispose();
  codeSessions = null;
  disposeIpc?.();
  disposeIpc = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
