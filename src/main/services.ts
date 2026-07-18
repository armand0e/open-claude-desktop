import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  globalShortcut,
  IpcMainInvokeEvent,
  Menu,
  nativeTheme,
  net,
  Notification,
  shell,
  WebContentsView,
} from "electron";
import { PRELOAD_CHANNELS } from "../generated/ipc-contract";
import { LOCAL_APP_NAME } from "../shared/app-identity";
import {
  ParsedChannel,
  serviceKey,
  storeNameFromMethod,
} from "../shared/channels";
import { originOf, TRUSTED_REMOTE_ORIGINS } from "../shared/security";
import { StateStore } from "./state";
import { FileAccessPolicy } from "./file-access";
import type { LocalCodeSessionManager } from "./local-code";
import type { LocalBackend } from "./local-backend";
import type { LocalFilePreview } from "./local-file-preview";
import type { LocalPluginManager } from "./local-plugins";
import type { LocalScheduledTasks } from "./local-scheduled-tasks";
import type { LocalLaunchPreview } from "./local-launch-preview";

const execFileAsync = promisify(execFile);

export interface ServiceContext {
  readonly state: StateStore;
  readonly codeSessions: LocalCodeSessionManager;
  readonly localBackend?: LocalBackend | null;
  readonly plugins?: LocalPluginManager;
  readonly scheduledTasks?: LocalScheduledTasks;
  readonly filePreview: LocalFilePreview;
  readonly launchPreview: LocalLaunchPreview;
  mainWindow(): BrowserWindow | null;
  mainView(): WebContentsView | null;
  broadcast(channel: string, ...args: unknown[]): void;
  targetUrl(): string;
  showMainWindow(): void;
}

const channelsByServiceMethod = new Map<string, string>();
for (const entry of PRELOAD_CHANNELS) {
  const parsed = parseEncoded(entry.channel);
  if (parsed)
    channelsByServiceMethod.set(
      `${serviceKey(parsed)}.${parsed.method}`,
      entry.channel,
    );
}

function parseEncoded(channel: string): ParsedChannel | null {
  const match = channel.match(
    /^\$eipc_(message|event)\$_([^_]+)_\$_(.+?)_\$_([^_]+)_\$_(.+)$/,
  );
  if (!match) return null;
  return {
    channel,
    kind: match[1] as ParsedChannel["kind"],
    generatorId: match[2],
    namespace: match[3],
    service: match[4],
    method: match[5],
  };
}

function eventChannel(service: string, method: string): string | undefined {
  return channelsByServiceMethod.get(`${service}.${method}`);
}

export function featureMatrix(): Record<
  string,
  { status: string; reason?: string; unsupportedCode?: string }
> {
  const supported = { status: "supported" };
  const unavailable = { status: "unavailable" };
  return {
    artifactsPane: supported,
    nativeQuickEntry: process.platform === "darwin" ? supported : unavailable,
    quickEntryDictation:
      process.platform === "darwin" ? supported : unavailable,
    quickEntryGlobalShortcut: supported,
    customQuickEntryDictationShortcut: supported,
    plushRaccoon: unavailable,
    quietPenguin: unavailable,
    chillingSlothFeat: supported,
    chillingSlothSshShell: unavailable,
    chillingSlothEnterprise: supported,
    chillingSlothLocal: supported,
    chillingSlothPool: unavailable,
    yukonSilver: unavailable,
    yukonSilverGems: unavailable,
    yukonSilverGemsCache: unavailable,
    wakeScheduler: supported,
    desktopTopBar: supported,
    ccdPlugins: supported,
    computerUse: unavailable,
    coworkWatchRecord: unavailable,
    coworkKappa: unavailable,
    coworkArtifacts: unavailable,
    framebufferPreview: supported,
    iosSimulator: unavailable,
    androidEmulator: unavailable,
    iosSimulatorH264: unavailable,
    grandPrix: unavailable,
    tearOffHalo: {
      status: "unsupported",
      reason: "Tear-off halo overlay is not implemented in the reconstruction",
      unsupportedCode: "unimplemented",
    },
    coworkArtifactPopout: unavailable,
    claudeDesignWindow: unavailable,
    coworkRemoteSessionSpaces: unavailable,
    spaceMemoryBridge: unavailable,
    grandPrixRequest: unavailable,
    coworkBranchSession: unavailable,
    coworkScheduledTaskProjects: unavailable,
    bootstrapConfig: supported,
    chatIn3p: supported,
    builtinMcpPresets: supported,
    surfaceTogglesPreview: supported,
    chatTab: supported,
    chatCodeExecution: supported,
    epitaxyMcpApps: unavailable,
    launch: supported,
  };
}

function focusedWindow(
  context: ServiceContext,
  event?: IpcMainInvokeEvent,
): BrowserWindow | null {
  return (
    (event ? BrowserWindow.fromWebContents(event.sender) : null) ??
    BrowserWindow.getFocusedWindow() ??
    context.mainWindow()
  );
}

async function pickPaths(
  context: ServiceContext,
  event: IpcMainInvokeEvent | undefined,
  directories: boolean,
  multiple: boolean,
  title?: string,
): Promise<string[] | null> {
  const properties: Array<
    "openFile" | "openDirectory" | "multiSelections" | "createDirectory"
  > = [directories ? "openDirectory" : "openFile"];
  if (directories) properties.push("createDirectory");
  if (multiple) properties.push("multiSelections");
  const owner = focusedWindow(context, event);
  const result = owner
    ? await dialog.showOpenDialog(owner, { properties, title })
    : await dialog.showOpenDialog({ properties, title });
  return result.canceled || result.filePaths.length === 0
    ? null
    : result.filePaths;
}

function safeDownloadName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = path.basename(input).trim();
  if (!name || name === "." || name === ".." || name.includes("\0"))
    return null;
  return name;
}

async function downloadToDownloads(
  filename: unknown,
  source: unknown,
): Promise<string | null> {
  const name = safeDownloadName(filename);
  if (!name || typeof source !== "string") return null;
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  const origin = originOf(url.toString());
  if (
    !origin ||
    (!TRUSTED_REMOTE_ORIGINS.has(origin) && origin !== "app://localhost")
  )
    return null;
  const response = await net.fetch(url.toString());
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const directory = app.getPath("downloads");
  await mkdir(directory, { recursive: true });
  const extension = path.extname(name);
  const stem = path.basename(name, extension);
  let destination = path.join(directory, name);
  let suffix = 1;
  while (
    await stat(destination).then(
      () => true,
      () => false,
    )
  ) {
    destination = path.join(directory, `${stem}_${suffix++}${extension}`);
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()), {
    flag: "wx",
  });
  return destination;
}

async function formatFileContent(
  filePath: string,
): Promise<Record<string, unknown>> {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("Not a regular file");
  if (info.size > 50 * 1024 * 1024)
    throw new Error("File exceeds the 50 MiB limit");
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const textExtensions = new Set([
    ".c",
    ".cpp",
    ".css",
    ".csv",
    ".go",
    ".h",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".py",
    ".rs",
    ".sh",
    ".sql",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
  ]);
  return textExtensions.has(extension)
    ? {
        type: "text",
        content: buffer.toString("utf8"),
        filename: path.basename(filePath),
      }
    : {
        type: "base64",
        content: buffer.toString("base64"),
        filename: path.basename(filePath),
      };
}

function defaultStoreValue(
  context: ServiceContext,
  parsed: ParsedChannel,
): unknown {
  const storeName = storeNameFromMethod(parsed.method);
  if (!storeName) return null;
  return context.state.get("stores")[storeName] ?? null;
}

function genericDefault(parsed: ParsedChannel): unknown {
  const { method, service } = parsed;
  if (
    /^(list|getAll|getAgents|getDetectedProjects|getPlugins|getExtensions|getInstalled|getAvailable|getRunningLocalSessions|getTrusted|getSupportedCommands|getSSHConfigs|getLocalBranches|getGitCommits|getPrCommits|getCheckRunAnnotations|getWatcherHistory|getConfiguredServices|getPreviewTabs|getPreviewAllowedOrigins|getConnectedFiles|getOpenDocuments|scanDevices)/.test(
      method,
    )
  ) {
    return [];
  }
  if (/^(is|has|check|can|should)/.test(method)) return false;
  if (
    /^(delete|remove|set|update|write|save|archive|unarchive|stop|interrupt|cancel|clear|report|notify|mark|revoke|respond|replace|disconnect|detach|close|hide|show|focus|resize|navigate|open|request|submit|sync|warm|prepare|patch|apply|add)/.test(
      method,
    )
  ) {
    return undefined;
  }
  if (service === "LocalSessions" || service === "LocalAgentModeSessions")
    return null;
  return null;
}

export class ServiceDispatcher {
  private readonly fileAccess = new FileAccessPolicy();

  constructor(private readonly context: ServiceContext) {}

  handleChromeAction(action: unknown, event?: IpcMainInvokeEvent): unknown {
    if (action === "menu") return this.popupMainMenu(event);
    if (action === "back") return this.browserNavigation("goBack", event);
    if (action === "forward") return this.browserNavigation("goForward", event);
    if (action === "sidebar") {
      const channel = eventChannel("claude.web.MenuEvents", "toggleSidebar");
      if (channel) this.context.broadcast(channel);
      return Boolean(channel);
    }
    if (action === "search") {
      const contents = this.context.mainView()?.webContents;
      if (!contents || contents.isDestroyed()) return false;
      contents.send("cmdK");
      return true;
    }
    return false;
  }

  invoke(
    parsed: ParsedChannel,
    args: unknown[],
    event?: IpcMainInvokeEvent,
  ): unknown | Promise<unknown> {
    const key = serviceKey(parsed);
    if (
      key === "claude.web.Launch" &&
      storeNameFromMethod(parsed.method) === "activeServers"
    )
      return this.context.launchPreview.servers;
    if (
      key === "claude.web.BrowserNavigation" &&
      storeNameFromMethod(parsed.method) === "navigationState"
    )
      return this.browserNavigation(parsed.method, event);
    if (storeNameFromMethod(parsed.method))
      return defaultStoreValue(this.context, parsed);

    switch (key) {
      case "claude.settings.AppConfig":
        return this.appConfig(parsed.method, args);
      case "claude.settings.AppFeatures":
        return featureMatrix();
      case "claude.settings.AppPreferences":
        return this.preferences(parsed.method, args);
      case "claude.settings.Startup":
        return this.startup(parsed.method, args);
      case "claude.settings.GlobalShortcut":
        return this.shortcuts(parsed.method, args);
      case "claude.settings.FilePickers":
        return pickPaths(
          this.context,
          event,
          parsed.method === "getDirectoryPath",
          Boolean(args[0]),
        );
      case "claude.settings.DesktopInfo":
        return this.desktopInfo(parsed.method);
      case "claude.settings.MCP":
        return this.mcp(parsed.method, args);
      case "claude.settings.Extensions":
        return this.extensions(parsed.method, args, event);
      case "claude.hybrid.DesktopIntl":
        return this.intl(parsed.method, args);
      case "claude.internal.ui.AboutWindow":
        return this.about(parsed.method);
      case "claude.internal.ui.MainWindowTitleBar":
        return this.titleBar(parsed.method, event);
      case "claude.web.WindowControl":
        return this.windowControl(parsed.method, args, event);
      case "claude.web.WindowState":
        return this.windowState(parsed.method, event);
      case "claude.web.BrowserNavigation":
        return this.browserNavigation(parsed.method, event);
      case "claude.web.Navigation":
        return this.navigation(args);
      case "claude.web.Auth":
        return this.openAuth(args[0]);
      case "claude.web.AutoUpdater":
        return this.updater(parsed.method);
      case "claude.web.DesktopNotifications":
        return this.notifications(parsed.method, args);
      case "claude.web.FileSystem":
        return this.fileSystem(parsed.method, args, event);
      case "claude.web.LocalSessionEnvironment":
        return this.localSessionEnvironment(parsed.method, args);
      case "claude.web.ClaudeCode":
        return this.claudeCode(parsed.method, args);
      case "claude.web.LocalSessions":
      case "claude.web.LocalAgentModeSessions":
        return this.localSessions(parsed.method, args, event);
      case "claude.web.CoworkFilePreview":
        return this.filePreview(parsed.method, args);
      case "claude.web.CoworkArtifacts":
        return this.coworkArtifacts(parsed.method, args);
      case "claude.web.Launch":
        return this.launch(parsed.method, args);
      case "claude.web.LocalPlugins":
        return (
          this.context.plugins?.invoke(parsed.method, args) ??
          genericDefault(parsed)
        );
      case "claude.web.CoworkScheduledTasks":
        return (
          this.context.scheduledTasks?.invoke(parsed.method, args) ??
          genericDefault(parsed)
        );
      case "claude.web.PluginBridgeMcp":
        return parsed.method === "listServers"
          ? this.listMcpServers()
          : undefined;
      case "electron_window.WindowManager":
        return this.windowManager(parsed.method, args);
      default:
        return genericDefault(parsed);
    }
  }

  private appConfig(
    method: string,
    args: unknown[],
  ): unknown | Promise<unknown> {
    if (method === "getAppConfig") return this.context.state.get("appConfig");
    return this.context.state
      .update((draft) => {
        if (
          method === "setAppFeature" &&
          typeof args[0] === "string" &&
          typeof args[1] === "boolean"
        ) {
          draft.appConfig.features[args[0]] = args[1];
        } else if (
          method === "setIsUsingBuiltInNodeForMcp" &&
          typeof args[0] === "boolean"
        ) {
          draft.appConfig.isUsingBuiltInNodeForMcp = args[0];
        } else if (
          method === "setIsDxtAutoUpdatesEnabled" &&
          typeof args[0] === "boolean"
        ) {
          draft.appConfig.isDxtAutoUpdatesEnabled = args[0];
        }
      })
      .then(() => undefined);
  }

  private preferences(
    method: string,
    args: unknown[],
  ): unknown | Promise<unknown> {
    if (method === "getPreferences")
      return this.context.state.get("appConfig").preferences;
    if (method !== "setPreference" || typeof args[0] !== "string")
      return undefined;
    return this.context.state
      .update((draft) => {
        draft.appConfig.preferences[args[0] as string] = args[1];
      })
      .then((state) => {
        const channel = eventChannel(
          "claude.settings.AppPreferences",
          "preferencesChanged",
        );
        if (channel)
          this.context.broadcast(channel, state.appConfig.preferences);
      });
  }

  private startup(method: string, args: unknown[]): unknown | Promise<unknown> {
    if (method === "isMenuBarEnabled")
      return this.context.state.get("menuBarEnabled");
    if (method === "setMenuBarEnabled") {
      return this.context.state
        .update((draft) => {
          draft.menuBarEnabled = Boolean(args[0]);
        })
        .then(() => undefined);
    }
    if (method === "isStartupOnLoginEnabled") {
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin || settings.executableWillLaunchAtLogin;
    }
    if (method === "setStartupOnLoginEnabled") {
      app.setLoginItemSettings({
        openAtLogin: Boolean(args[0]),
        name: LOCAL_APP_NAME,
      });
    }
    return undefined;
  }

  private shortcuts(
    method: string,
    args: unknown[],
  ): unknown | Promise<unknown> {
    if (method === "getGlobalShortcut")
      return this.context.state.get("globalShortcut");
    if (method !== "setGlobalShortcut") return undefined;
    const accelerator = typeof args[0] === "string" ? args[0] : "";
    globalShortcut.unregisterAll();
    if (
      accelerator &&
      !globalShortcut.register(accelerator, () => this.context.showMainWindow())
    ) {
      throw new Error(`Shortcut could not be registered: ${accelerator}`);
    }
    return this.context.state
      .update((draft) => {
        draft.globalShortcut = accelerator;
      })
      .then(() => {
        const channel = eventChannel(
          "claude.settings.GlobalShortcut",
          "globalShortcutChange",
        );
        if (channel) this.context.broadcast(channel, accelerator);
      });
  }

  private desktopInfo(method: string): unknown {
    if (method === "showLogsInFileManager")
      return shell.openPath(app.getPath("logs"));
    return {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      hostname: os.hostname(),
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
  }

  private mcp(method: string, args: unknown[]): unknown | Promise<unknown> {
    if (method === "isLocalDevMcpEnabled") return true;
    if (method === "getMcpServersConfig")
      return this.context.state.get("appConfig").mcpServers;
    if (method === "getMcpServersConfigWithStatus") return null;
    if (
      method === "setMcpServerConfigs" &&
      args[0] &&
      typeof args[0] === "object"
    ) {
      return this.context.state
        .update((draft) => {
          draft.appConfig.mcpServers = args[0] as Record<string, unknown>;
        })
        .then((state) => {
          const channel = eventChannel(
            "claude.settings.MCP",
            "mcpConfigChange",
          );
          if (channel)
            this.context.broadcast(channel, state.appConfig.mcpServers);
        });
    }
    if (method === "revealConfig")
      return shell.showItemInFolder(this.context.state.filePath);
    if (method === "revealLogs") return shell.openPath(app.getPath("logs"));
    return undefined;
  }

  private extensions(
    method: string,
    args: unknown[],
    event?: IpcMainInvokeEvent,
  ): unknown | Promise<unknown> {
    if (
      [
        "isExtensionsEnabled",
        "isLocalExtensionInstallAllowed",
        "isDirectoryEnabled",
      ].includes(method)
    )
      return true;
    if (method === "isDesktopExtensionSignatureRequired") return false;
    if (method === "isDesktopExtensionDirectoryEnabled") return true;
    if (
      method === "getInstalledExtensionsWithState" ||
      method === "getExtensions" ||
      method === "getExtensionVersions"
    )
      return [];
    if (method === "getAvailableExtensionRuntimes") {
      return [
        {
          name: "Node.js",
          versions: [process.versions.node],
          builtInVersion: process.versions.node,
        },
        { name: "Python", versions: [], builtInVersion: null },
      ];
    }
    if (
      method === "getIsUpdateAvailable" ||
      method === "getExtension" ||
      method === "getExtensionVersion"
    )
      return null;
    if (method === "getExtensionSettings") return {};
    if (method === "getDirectoryUrl")
      return "https://claude.ai/settings/connectors";
    if (method === "showInstallDxtDialog")
      return pickPaths(this.context, event, false, false, "Install extension");
    if (
      method === "openExtensionsFolder" ||
      method === "openExtensionSettingsFolder"
    ) {
      const folder = path.join(
        app.getPath("userData"),
        method === "openExtensionsFolder" ? "extensions" : "extension-settings",
      );
      return mkdir(folder, { recursive: true }).then(() =>
        shell.openPath(folder),
      );
    }
    if (
      (method === "showExtensionInFolder" || method === "deleteExtension") &&
      typeof args[0] === "string"
    )
      return undefined;
    return null;
  }

  private intl(method: string, args: unknown[]): unknown | Promise<unknown> {
    if (method === "getInitialLocale")
      return { locale: this.context.state.get("locale"), messages: {} };
    if (method === "requestLocaleChange" && typeof args[0] === "string") {
      return this.context.state
        .update((draft) => {
          draft.locale = args[0] as string;
        })
        .then((state) => {
          const channel = eventChannel(
            "claude.hybrid.DesktopIntl",
            "localeChanged",
          );
          if (channel) this.context.broadcast(channel, state.locale, {});
        });
    }
    return undefined;
  }

  private about(method: string): unknown {
    if (method === "getAppName") return app.getName();
    if (method === "getBuildProps") {
      return {
        buildType: "prod",
        commitHash: "reconstructed",
        commitTimestamp: "",
        isNestBuild: false,
        appVersion: app.getVersion(),
      };
    }
    if (method === "getSupport") return "https://support.claude.com";
    if (method === "openHelp")
      return shell.openExternal("https://support.claude.com");
    return null;
  }

  private navigate(pathname: string): void {
    const channel = eventChannel("claude.web.Navigation", "navigate");
    if (channel) this.context.broadcast(channel, pathname);
  }

  private popupMainMenu(event?: IpcMainInvokeEvent): void {
    const window =
      focusedWindow(this.context, event) ?? this.context.mainWindow();
    if (!window || window.isDestroyed()) return;
    if (process.env.CLAUDE_TRACE_LOCAL_UI === "1")
      console.error("[local-ui] main menu popup");
    const contents = this.context.mainView()?.webContents;
    const menu = Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          {
            label: "New conversation",
            accelerator: "CmdOrCtrl+N",
            click: () => this.navigate("/new"),
          },
          {
            label: "Settings…",
            accelerator: "CmdOrCtrl+,",
            click: () => this.navigate("/settings/desktop"),
          },
          { type: "separator" },
          { label: "Close window", accelerator: "CmdOrCtrl+W", role: "close" },
          { label: "Exit", role: "quit" },
        ],
      },
      {
        label: "Edit",
        submenu: [
          { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
          { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", role: "redo" },
          { type: "separator" },
          { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
          { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
          { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
          {
            label: "Select all",
            accelerator: "CmdOrCtrl+A",
            role: "selectAll",
          },
        ],
      },
      {
        label: "View",
        submenu: [
          {
            label: "Toggle sidebar",
            accelerator: "CmdOrCtrl+B",
            click: () => {
              const channel = eventChannel(
                "claude.web.MenuEvents",
                "toggleSidebar",
              );
              if (channel) this.context.broadcast(channel);
            },
          },
          { type: "separator" },
          {
            label: "Reload",
            accelerator: "CmdOrCtrl+R",
            click: () => contents?.reload(),
          },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "Local model settings",
            click: () => this.navigate("/settings/desktop"),
          },
          { type: "separator" },
          {
            label: "About",
            click: () =>
              void dialog.showMessageBox(window, {
                type: "info",
                title: "About",
                message: LOCAL_APP_NAME,
                detail: `Version ${app.getVersion()}`,
              }),
          },
        ],
      },
    ]);
    menu.popup({ window });
  }

  private titleBar(method: string, event?: IpcMainInvokeEvent): unknown {
    if (method === "isClaudeCurrentlyHealthy")
      return !this.context.mainView()?.webContents.isCrashed();
    if (method === "requestReloadMainView")
      return this.context.mainView()?.webContents.reload();
    if (method === "requestMainMenuPopup") return this.popupMainMenu(event);
    return undefined;
  }

  private windowControl(
    method: string,
    args: unknown[],
    event?: IpcMainInvokeEvent,
  ): unknown {
    const window =
      focusedWindow(this.context, event) ?? this.context.mainWindow();
    if (!window || window.isDestroyed()) return undefined;
    if (method === "focus") return window.focus();
    if (method === "close") return window.close();
    if (
      method === "resize" &&
      Number.isFinite(args[0]) &&
      Number.isFinite(args[1])
    ) {
      const [width, height] = args as number[];
      const options =
        args[2] && typeof args[2] === "object"
          ? (args[2] as Record<string, unknown>)
          : {};
      return window.setSize(
        Math.max(320, Math.round(width)),
        Math.max(240, Math.round(height)),
        Boolean(options.animate),
      );
    }
    if (
      method === "setThemeMode" &&
      ["system", "light", "dark"].includes(String(args[0]))
    ) {
      nativeTheme.themeSource = args[0] as "system" | "light" | "dark";
    }
    if (method === "captureScreenshot")
      return window.webContents
        .capturePage()
        .then((image) => image.toDataURL());
    return undefined;
  }

  private windowState(method: string, event?: IpcMainInvokeEvent): unknown {
    const window =
      focusedWindow(this.context, event) ?? this.context.mainWindow();
    if (method === "getFullscreen") return window?.isFullScreen() ?? false;
    if (method === "getVisibility") return window?.isVisible() ?? true;
    if (method === "getZoomFactor") return event?.sender.getZoomFactor() ?? 1;
    return undefined;
  }

  private browserNavigation(
    method: string,
    event?: IpcMainInvokeEvent,
  ): unknown {
    const contents = this.context.mainView()?.webContents;
    if (!contents || contents.isDestroyed()) return null;
    if (method.startsWith("navigationState_$store$_"))
      return {
        canGoBack: contents.navigationHistory.canGoBack(),
        canGoForward: contents.navigationHistory.canGoForward(),
      };
    if (method === "goBack" && contents.navigationHistory.canGoBack())
      contents.navigationHistory.goBack();
    if (method === "goForward" && contents.navigationHistory.canGoForward())
      contents.navigationHistory.goForward();
    if (method === "requestMainMenuPopup") return this.popupMainMenu(event);
    return {
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      url: contents.getURL(),
    };
  }

  private navigation(args: unknown[]): unknown {
    if (typeof args[0] !== "string") return undefined;
    const target = new URL(args[0], this.context.targetUrl());
    const origin = originOf(target.toString());
    const allowed = Boolean(
      origin &&
      (TRUSTED_REMOTE_ORIGINS.has(origin) || origin === "app://localhost"),
    );
    if (!allowed) return undefined;
    return this.context.mainView()?.webContents.loadURL(target.toString());
  }

  private openAuth(input: unknown): unknown {
    if (typeof input !== "string") return undefined;
    const url = new URL(input);
    if (url.protocol !== "https:")
      throw new Error("Authentication URLs must use HTTPS");
    return shell.openExternal(url.toString());
  }

  private updater(method: string): unknown {
    if (method === "checkForUpdates") {
      if (app.isPackaged) void autoUpdater.checkForUpdates();
      return undefined;
    }
    if (method === "restartToUpdate" || method === "restartToUpdateWhenIdle") {
      if (!app.isPackaged) return false;
      autoUpdater.quitAndInstall();
      return true;
    }
    if (method === "cancelPendingRestart") return undefined;
    if (method === "getRunningLocalSessionCount") return 0;
    if (method === "getRunningLocalSessions") return [];
    return null;
  }

  private notifications(method: string, args: unknown[]): unknown {
    const supported = Notification.isSupported();
    if (
      method === "getAuthorizationStatus" ||
      method === "requestAuthorization"
    )
      return supported ? "granted" : "denied";
    if (method === "openNotificationSettings") {
      if (process.platform === "win32")
        void shell.openExternal("ms-settings:notifications");
      return undefined;
    }
    if (method === "showNotification" && supported) {
      const [title, body, tag, navigateTo, notificationType] = args;
      const notification = new Notification({
        title: typeof title === "string" ? title : LOCAL_APP_NAME,
        body: typeof body === "string" ? body : "",
      });
      notification.on("click", () => {
        this.context.showMainWindow();
        const channel = eventChannel(
          "claude.web.DesktopNotifications",
          "onNotificationClicked",
        );
        if (channel)
          this.context.broadcast(channel, {
            tag,
            navigateTo,
            notificationType,
          });
      });
      notification.show();
      return undefined;
    }
    return method === "showNotification" ? undefined : false;
  }

  private async fileSystem(
    method: string,
    args: unknown[],
    event?: IpcMainInvokeEvent,
  ): Promise<unknown> {
    if (method === "browseFiles") {
      const selected = await pickPaths(
        this.context,
        event,
        false,
        true,
        typeof args[0] === "string" ? args[0] : undefined,
      );
      if (selected)
        await Promise.all(
          selected.map((selectedPath) =>
            this.fileAccess.grantFile(selectedPath),
          ),
        );
      return selected;
    }
    if (method === "browseFolder") {
      const selected =
        (
          await pickPaths(
            this.context,
            event,
            true,
            false,
            typeof args[0] === "string" ? args[0] : undefined,
          )
        )?.[0] ?? null;
      if (selected) await this.fileAccess.grantRoot(selected);
      return selected;
    }
    if (method === "browseFolders") {
      const selected = await pickPaths(
        this.context,
        event,
        true,
        true,
        typeof args[0] === "string" ? args[0] : undefined,
      );
      if (selected)
        await Promise.all(
          selected.map((selectedPath) =>
            this.fileAccess.grantRoot(selectedPath),
          ),
        );
      return selected;
    }
    if (method === "getSystemPath" && typeof args[0] === "string") {
      const names = new Set([
        "downloads",
        "documents",
        "pictures",
        "music",
        "videos",
        "desktop",
        "home",
      ]);
      return names.has(args[0])
        ? app.getPath(args[0] as Parameters<typeof app.getPath>[0])
        : null;
    }
    if (method === "listDirectory" && typeof args[0] === "string") {
      try {
        const directory = await this.fileAccess.requireRoot(args[0]);
        const entries = await readdir(directory, { withFileTypes: true });
        return {
          directories: entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort(),
        };
      } catch {
        return {
          directories: [],
          error: "Couldn't open that folder. Check the path and try again.",
        };
      }
    }
    if (
      method === "writeFileDownload" ||
      method === "writeFileDownloadAndOpen"
    ) {
      const destination = await downloadToDownloads(args[0], args[1]);
      if (destination) await this.fileAccess.grantFile(destination);
      if (destination && method.endsWith("AndOpen"))
        await shell.openPath(destination);
      return destination;
    }
    if (method === "showInFolder" && typeof args[0] === "string") {
      return shell.showItemInFolder(await this.fileAccess.requireFile(args[0]));
    }
    if (method === "openLocalFile" && typeof args[1] === "string") {
      const candidate = await this.fileAccess.requireFile(args[1]);
      return args[2]
        ? shell.showItemInFolder(candidate)
        : shell.openPath(candidate);
    }
    if (method === "readLocalFile" && typeof args[1] === "string") {
      return formatFileContent(await this.fileAccess.requireFile(args[1]));
    }
    if (
      method === "writeLocalFile" &&
      typeof args[1] === "string" &&
      typeof args[2] === "string"
    ) {
      const destination = await this.fileAccess.requireFile(args[1], {
        write: true,
      });
      await writeFile(destination, args[2], "utf8");
      return true;
    }
    if (
      method === "savePastedFile" &&
      typeof args[0] === "string" &&
      typeof args[2] === "string"
    ) {
      const directory = path.join(app.getPath("userData"), "pasted-files");
      await mkdir(directory, { recursive: true });
      const destination = path.join(
        directory,
        `${crypto.randomUUID()}-${path.basename(args[2])}`,
      );
      await writeFile(destination, Buffer.from(args[0], "base64"), {
        flag: "wx",
      });
      await this.fileAccess.grantFile(destination);
      return { path: destination };
    }
    if (method === "listFilesInFolder" && typeof args[1] === "string") {
      const directory = await this.fileAccess.requireRoot(args[1]);
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      return entries.map((entry) => ({
        name: entry.name,
        path: path.join(directory, entry.name),
        isDirectory: entry.isDirectory(),
      }));
    }
    return null;
  }

  private localSessionEnvironment(
    method: string,
    args: unknown[],
  ): unknown | Promise<unknown> {
    if (method === "get")
      return this.context.state.get("localSessionEnvironment");
    if (method === "save") {
      return this.context.state
        .update((draft) => {
          draft.localSessionEnvironment = args[0] ?? null;
        })
        .then(() => ({ success: true }));
    }
    return null;
  }

  private async claudeCode(method: string, args: unknown[]): Promise<unknown> {
    if (method === "checkGitAvailable") {
      return execFileAsync("git", ["--version"], { windowsHide: true }).then(
        () => ({ available: true }),
        (error) => ({
          available: false,
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    // The local agent harness is bundled with the reconstruction, so the Code
    // surface is ready even when Anthropic's separately installed CLI is absent.
    if (method === "getStatus") return "ready";
    if (method === "prepare") return { success: true };
    if (method === "resolveLocalSettings") {
      const preferences = this.context.state.get("appConfig").preferences;
      return typeof preferences.enableWorkflows === "boolean"
        ? {
            enableWorkflows: {
              value: preferences.enableWorkflows,
              source: "user",
            },
          }
        : {};
    }
    if (method === "patchUserSettings" || method === "setEnableWorkflows") {
      const patch =
        method === "patchUserSettings" &&
        args[0] &&
        typeof args[0] === "object" &&
        !Array.isArray(args[0])
          ? (args[0] as Record<string, unknown>)
          : { enableWorkflows: args[0] };
      if (!("enableWorkflows" in patch)) return true;
      await this.context.state.update((draft) => {
        if (typeof patch.enableWorkflows === "boolean")
          draft.appConfig.preferences.enableWorkflows = patch.enableWorkflows;
        else delete draft.appConfig.preferences.enableWorkflows;
      });
      return true;
    }
    if (method === "getPeriodUsage") return null;
    return undefined;
  }

  private async localSessions(
    method: string,
    args: unknown[],
    event?: IpcMainInvokeEvent,
  ): Promise<unknown> {
    if (method === "openOutputsDir" && typeof args[0] === "string") {
      const session = (await this.context.codeSessions.invoke("getSession", [
        args[0],
      ])) as { cwd?: unknown } | null;
      if (typeof session?.cwd !== "string")
        throw new Error("Code session was not found");
      const error = await shell.openPath(path.resolve(session.cwd));
      if (error) throw new Error(error);
      return undefined;
    }
    if (method === "pickFileAtCwd" && typeof args[0] === "string") {
      const owner = focusedWindow(this.context, event);
      const options = {
        title: "Select a file",
        defaultPath: path.resolve(args[0]),
        properties: ["openFile"] as Array<"openFile">,
      };
      const result = owner
        ? await dialog.showOpenDialog(owner, options)
        : await dialog.showOpenDialog(options);
      return result.canceled ? null : (result.filePaths[0] ?? null);
    }
    if (method === "pickSessionFile" && typeof args[0] === "string") {
      const session = (await this.context.codeSessions.invoke("getSession", [
        args[0],
      ])) as { cwd?: unknown } | null;
      return this.localSessions(
        "pickFileAtCwd",
        [typeof session?.cwd === "string" ? session.cwd : app.getPath("home")],
        event,
      );
    }
    if (
      (method === "showSessionFileInFolder" ||
        method === "openSessionFileInDefaultApp") &&
      typeof args[0] === "string" &&
      typeof args[1] === "string"
    ) {
      const resolved = await this.context.codeSessions.invoke(
        "resolveSessionFile",
        [args[0], args[1]],
      );
      if (typeof resolved !== "string")
        return method === "showSessionFileInFolder"
          ? false
          : { ok: false, error: "File is outside the session workspace" };
      if (method === "showSessionFileInFolder") {
        shell.showItemInFolder(resolved);
        return true;
      }
      const error = await shell.openPath(resolved);
      return error ? { ok: false, error } : { ok: true };
    }
    if (method === "showSessionFilePreview")
      return this.context.filePreview.show(args[0], args[1], args[2], args[3]);
    return this.context.codeSessions.invoke(method, args);
  }

  private filePreview(method: string, args: unknown[]): unknown {
    if (method === "isEnabled" || method === "isEpitaxyPreviewEnabled")
      return true;
    if (method === "isOpenInDefaultAppEnabled" || method === "isVmReady")
      return true;
    if (method === "show")
      return this.context.filePreview.show(args[0], args[1], args[2], args[3]);
    if (method === "hide") return this.context.filePreview.hide(args[0]);
    if (method === "parkAndCapture")
      return this.context.filePreview.parkAndCapture(args[0], args[1]);
    return undefined;
  }

  private coworkArtifacts(
    method: string,
    args: unknown[],
  ): unknown | Promise<unknown> {
    if (method === "getAllArtifacts")
      return Promise.resolve(
        this.context.codeSessions.invoke("getAllArtifacts", []),
      ).then((codeArtifacts) => [
        ...(this.context.localBackend?.artifactSummaries() ?? []),
        ...(Array.isArray(codeArtifacts) ? codeArtifacts : []),
      ]);
    if (method === "deleteArtifact")
      return this.context.codeSessions.invoke("deleteArtifactById", [args[0]]);
    if (method === "getArtifactMetadata")
      return this.context.codeSessions.invoke("readArtifactById", [args[0]]);
    if (method === "getArtifactIndexHtmlPath")
      return this.context.codeSessions
        .invoke("readArtifactById", [args[0]])
        .then((artifact) =>
          artifact &&
          typeof artifact === "object" &&
          "path" in artifact &&
          typeof artifact.path === "string"
            ? artifact.path
            : "",
        );
    if (method === "isAutoPublishEnabled") return true;
    if (method === "isSharingEnabled") return false;
    if (method === "getArtifactThumbnail") return null;
    return genericDefault({
      channel: "",
      kind: "message",
      generatorId: "",
      namespace: "claude.web",
      service: "CoworkArtifacts",
      method,
    });
  }

  private launch(method: string, args: unknown[]): unknown | Promise<unknown> {
    const preview = this.context.launchPreview;
    switch (method) {
      case "isAvailable":
        return true;
      case "isJitlessForced":
        return false;
      case "startBrowserPreview":
        return preview.startBrowserPreview(args[0], args[1]);
      case "loadHtmlPreview":
        return preview.loadHtmlPreview(args[0], args[1], args[2]);
      case "loadHtmlPreviewContent":
        return preview.loadHtmlPreviewContent(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
        );
      case "showPreview":
        return preview.showPreview(args[0], args[1], args[2]);
      case "hidePreview":
        return preview.hidePreview(args[0], args[1]);
      case "focusPreview":
        return preview.focusPreview(args[0]);
      case "destroyPreview":
        return preview.destroyPreview(args[0]);
      case "getPreviewUrl":
        return preview.getPreviewUrl(args[0]);
      case "getPreviewNavState":
        return preview.getPreviewNavState(args[0]);
      case "navigatePreview":
        return preview.navigatePreview(args[0], args[1]);
      case "goBack":
        return preview.goBack(args[0]);
      case "goForward":
        return preview.goForward(args[0]);
      case "refreshPreview":
        return preview.refreshPreview(args[0]);
      case "capturePreviewScreenshot":
      case "capturePreviewScreenshotIfChanged":
        return preview.capturePreviewScreenshot(args[0]);
      case "setPreviewViewport":
        return preview.setPreviewViewport(args[0], args[1], args[2]);
      case "clearPreviewViewport":
        return preview.clearPreviewViewport(args[0]);
      case "setPreviewColorScheme":
        return preview.setPreviewColorScheme(args[0], args[1]);
      case "getPreviewTabs":
        return preview.getPreviewTabs(args[0]);
      case "openPreviewInBrowser":
        return preview.openPreviewInBrowser(args[0]);
      case "getLogs":
        return preview.getLogs(args[0]);
      case "getConfiguredServices":
        return preview.getConfiguredServices(args[0]);
      case "getAutoVerify":
        return preview.getAutoVerify(args[0]);
      case "setAutoVerify":
        return preview.setAutoVerify(args[0], args[1]);
      case "startFromConfig":
        return preview.startFromConfig(args[0], args[1], args[2]);
      case "pickHtmlFile":
        return preview.pickHtmlFile(args[0]);
      case "stopServer":
        return preview.stopServer(args[0]);
      case "openPreviewTab":
        return "default";
      case "setActivePreviewTab":
      case "closePreviewTab":
      case "closeAllPreviewTabs":
      case "clearPreviewAllowedOrigins":
        return true;
      case "toggleSelectionMode":
        return preview.toggleSelectionMode(args[0], args[1]);
      case "getPreviewAllowedOrigins":
        return [];
      case "addPreviewAllowedOrigin":
        return "allowed";
      case "removePreviewAllowedOrigin":
        return false;
      case "exportPreview":
      case "focusOrOpenPreviewTab":
      case "openExternalLinkInPreview":
        return null;
      case "loadClaudePagePreview":
        return preview.loadArtifactPreview(args[0], args[1], args[2]);
      case "sendClaudePageShareCommand":
      case "sendClaudePageDismissCommand":
        return false;
      default:
        return genericDefault({
          channel: "",
          kind: "message",
          generatorId: "",
          namespace: "claude.web",
          service: "Launch",
          method,
        });
    }
  }

  listMcpServers(): Array<{ name: string; config: unknown }> {
    return Object.entries(this.context.state.get("appConfig").mcpServers).map(
      ([name, config]) => ({ name, config }),
    );
  }

  private windowManager(method: string, args: unknown[]): unknown {
    if (method === "GetWindowState") {
      const window = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.id === Number(args[0]),
      );
      return window
        ? {
            id: window.id,
            bounds: window.getBounds(),
            visible: window.isVisible(),
            focused: window.isFocused(),
          }
        : null;
    }
    if (method === "WindowAction") {
      const window = BrowserWindow.getAllWindows().find(
        (candidate) => candidate.id === Number(args[0]),
      );
      const action = args[1];
      if (window && action === "focus") window.focus();
      if (window && action === "close") window.close();
    }
    return undefined;
  }
}
