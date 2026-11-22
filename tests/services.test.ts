import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  openPath: vi.fn<(...args: unknown[]) => Promise<string>>(),
  register: vi.fn<(...args: unknown[]) => boolean>(),
  unregisterAll: vi.fn(),
  getPath: vi.fn<(name: string) => string>(),
  getVersion: vi.fn<() => string>(),
  findInPage: vi.fn<(...args: unknown[]) => number>(),
  stopFindInPage: vi.fn<(...args: unknown[]) => void>(),
  getLoginItemSettings: vi.fn<() => Record<string, boolean>>(),
  setLoginItemSettings: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: electron.getPath,
    getVersion: electron.getVersion,
    getLoginItemSettings: electron.getLoginItemSettings,
    setLoginItemSettings: electron.setLoginItemSettings,
  },
  autoUpdater: {},
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getFocusedWindow: vi.fn(),
  },
  dialog: {},
  globalShortcut: {
    register: electron.register,
    unregisterAll: electron.unregisterAll,
  },
  Menu: {},
  nativeTheme: {},
  net: {},
  Notification: class {},
  shell: {
    openPath: electron.openPath,
    showItemInFolder: vi.fn(),
  },
  WebContentsView: class {},
}));

import type { LocalCodeSessionManager } from "../src/main/local-code";
import { zipEntries } from "../src/main/local-extract";
import { ServiceDispatcher, type ServiceContext } from "../src/main/services";
import { StateStore } from "../src/main/state";
import type { ParsedChannel } from "../src/shared/channels";

const openOutputsDirChannel: ParsedChannel = {
  channel: "$eipc_message$_test_$_claude.web_$_LocalSessions_$_openOutputsDir",
  kind: "message",
  generatorId: "test",
  namespace: "claude.web",
  service: "LocalSessions",
  method: "openOutputsDir",
};

function dispatcherFor(invoke: LocalCodeSessionManager["invoke"]) {
  return new ServiceDispatcher({
    codeSessions: { invoke } as LocalCodeSessionManager,
  } as unknown as ServiceContext);
}

function claudeCodeChannel(method: string): ParsedChannel {
  return {
    channel: `$eipc_message$_test_$_claude.web_$_ClaudeCode_$_${method}`,
    kind: "message",
    generatorId: "test",
    namespace: "claude.web",
    service: "ClaudeCode",
    method,
  };
}

function dispatcherWithState(state: StateStore) {
  return new ServiceDispatcher({
    state,
    broadcast: vi.fn(),
    showMainWindow: vi.fn(),
  } as unknown as ServiceContext);
}

function channel(key: string, method: string): ParsedChannel {
  const separator = key.lastIndexOf(".");
  const namespace = key.slice(0, separator);
  const service = key.slice(separator + 1);
  return {
    channel: `$eipc_message$_test_$_${namespace}_$_${service}_$_${method}`,
    kind: "message",
    generatorId: "test",
    namespace,
    service,
    method,
  };
}

describe("ServiceDispatcher local Code integration", () => {
  it("does not resurrect removed Cowork preferences submitted by the retained renderer", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "removed-prefs-"));
    try {
      const state = new StateStore(directory);
      const dispatcher = dispatcherWithState(state);
      await dispatcher.invoke(
        channel("claude.settings.AppPreferences", "setPreference"),
        ["coworkScheduledTasksEnabled", true],
      );
      expect(
        state.get("appConfig").preferences.coworkScheduledTasksEnabled,
      ).toBeUndefined();
      await dispatcher.invoke(
        channel("claude.settings.AppPreferences", "setPreference"),
        ["sidebarMode", "expanded"],
      );
      expect(state.get("appConfig").preferences.sidebarMode).toBe("expanded");
      await state.dispose();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("hides unavailable extension and update workflows and rejects their mutations", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "truthful-capabilities-"),
    );
    try {
      const dispatcher = dispatcherWithState(new StateStore(directory));
      expect(
        dispatcher.invoke(
          channel("claude.settings.Extensions", "isExtensionsEnabled"),
          [],
        ),
      ).toBe(false);
      expect(
        dispatcher.invoke(
          channel(
            "claude.settings.Extensions",
            "isLocalExtensionInstallAllowed",
          ),
          [],
        ),
      ).toBe(false);
      expect(() =>
        dispatcher.invoke(
          channel("claude.settings.Extensions", "showInstallDxtDialog"),
          [],
        ),
      ).toThrow(/extensions are unavailable/i);
      expect(() =>
        dispatcher.invoke(
          channel("claude.web.AutoUpdater", "checkForUpdates"),
          [],
        ),
      ).toThrow(/no signed update feed/i);
      expect(
        dispatcher.invoke(
          channel("claude.web.AutoUpdater", "restartToUpdate"),
          [],
        ),
      ).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    electron.openPath.mockReset();
    electron.register.mockReset();
    electron.unregisterAll.mockReset();
    electron.getPath.mockReset();
    electron.getVersion.mockReset();
    electron.getLoginItemSettings.mockReset();
    electron.setLoginItemSettings.mockReset();
  });

  it("opens a Code session workspace for the native Open in Explorer action", async () => {
    electron.openPath.mockResolvedValueOnce("");
    const invoke = vi.fn().mockResolvedValue({
      cwd: path.join("C:\\", "workspace", "demo"),
    });

    await expect(
      dispatcherFor(invoke).invoke(openOutputsDirChannel, ["session-1"]),
    ).resolves.toBeUndefined();

    expect(invoke).toHaveBeenCalledWith("getSession", ["session-1"]);
    expect(electron.openPath).toHaveBeenCalledWith(
      path.resolve("C:\\", "workspace", "demo"),
    );
  });

  it("reports a missing session instead of silently ignoring Open in Explorer", async () => {
    const invoke = vi.fn().mockResolvedValue(null);

    await expect(
      dispatcherFor(invoke).invoke(openOutputsDirChannel, ["missing"]),
    ).rejects.toThrow("Code session was not found");
    expect(electron.openPath).not.toHaveBeenCalled();
  });

  it("persists the native Dynamic workflows setting", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "code-settings-"));
    try {
      const state = new StateStore(directory);
      const dispatcher = dispatcherWithState(state);
      const resolve = claudeCodeChannel("resolveLocalSettings");
      const patch = claudeCodeChannel("patchUserSettings");

      await expect(dispatcher.invoke(resolve, [])).resolves.toEqual({});
      await expect(
        dispatcher.invoke(patch, [{ enableWorkflows: false }]),
      ).resolves.toBe(true);
      await expect(dispatcher.invoke(resolve, [])).resolves.toEqual({
        enableWorkflows: { value: false, source: "user" },
      });

      const restored = dispatcherWithState(new StateStore(directory));
      await expect(restored.invoke(resolve, [])).resolves.toEqual({
        enableWorkflows: { value: false, source: "user" },
      });
      await expect(
        restored.invoke(patch, [{ enableWorkflows: undefined }]),
      ).resolves.toBe(true);
      await expect(restored.invoke(resolve, [])).resolves.toEqual({});
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores the previous shortcut when a replacement cannot register", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "shortcut-state-"));
    try {
      const state = new StateStore(directory);
      await state.update((draft) => {
        draft.globalShortcut = "Ctrl+Shift+O";
      });
      electron.register.mockReturnValueOnce(false).mockReturnValueOnce(true);
      await expect(
        dispatcherWithState(state).invoke(
          channel("claude.settings.GlobalShortcut", "setGlobalShortcut"),
          ["Ctrl+Shift+N"],
        ),
      ).rejects.toThrow("could not be registered");
      expect(state.get("globalShortcut")).toBe("Ctrl+Shift+O");
      expect(electron.register.mock.calls.map((call) => call[0])).toEqual([
        "Ctrl+Shift+N",
        "Ctrl+Shift+O",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes shortcut replacement with its persisted state", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "shortcut-concurrent-state-"),
    );
    try {
      const state = new StateStore(directory);
      await state.update((draft) => {
        draft.globalShortcut = "Ctrl+Shift+O";
      });
      const dispatcher = dispatcherWithState(state);
      const setShortcut = channel(
        "claude.settings.GlobalShortcut",
        "setGlobalShortcut",
      );
      electron.register
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const results = await Promise.allSettled([
        dispatcher.invoke(setShortcut, ["Ctrl+Shift+A"]),
        dispatcher.invoke(setShortcut, ["Ctrl+Shift+B"]),
      ]);
      expect(results.map((result) => result.status)).toEqual([
        "fulfilled",
        "rejected",
      ]);
      expect(state.get("globalShortcut")).toBe("Ctrl+Shift+A");
      expect(electron.register.mock.calls.map((call) => call[0])).toEqual([
        "Ctrl+Shift+A",
        "Ctrl+Shift+B",
        "Ctrl+Shift+A",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores the persisted global shortcut when the app starts", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "shortcut-restore-"),
    );
    try {
      const state = new StateStore(directory);
      await state.update((draft) => {
        draft.globalShortcut = "Ctrl+Shift+O";
      });
      const showMainWindow = vi.fn();
      const dispatcher = new ServiceDispatcher({
        state,
        showMainWindow,
      } as unknown as ServiceContext);
      electron.register.mockReturnValueOnce(true);

      expect(dispatcher.restoreGlobalShortcut()).toBe(true);
      expect(electron.unregisterAll).toHaveBeenCalledOnce();
      expect(electron.register).toHaveBeenCalledWith(
        "Ctrl+Shift+O",
        expect.any(Function),
      );
      const registeredCallback = electron.register.mock
        .calls[0]?.[1] as () => void;
      registeredCallback();
      expect(showMainWindow).toHaveBeenCalledOnce();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reports no active shortcut when startup registration is rejected", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "shortcut-rejected-"),
    );
    try {
      const state = new StateStore(directory);
      await state.update((draft) => {
        draft.globalShortcut = "Ctrl+Shift+O";
      });
      const dispatcher = dispatcherWithState(state);
      electron.register.mockReturnValueOnce(false);

      expect(dispatcher.restoreGlobalShortcut()).toBe(false);
      await expect(
        dispatcher.invoke(
          channel("claude.settings.GlobalShortcut", "getGlobalShortcut"),
          [],
        ),
      ).resolves.toBe("");
      expect(state.get("globalShortcut")).toBe("Ctrl+Shift+O");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("applies the system tray toggle and persists only an active tray", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "tray-state-"));
    try {
      const state = new StateStore(directory);
      let enabled = false;
      const setMenuBarEnabled = vi.fn((value: boolean) => {
        enabled = value;
      });
      const dispatcher = new ServiceDispatcher({
        state,
        broadcast: vi.fn(),
        showMainWindow: vi.fn(),
        isMenuBarEnabled: () => enabled,
        setMenuBarEnabled,
      } as unknown as ServiceContext);
      const startup = (method: string) =>
        channel("claude.settings.Startup", method);

      await expect(
        dispatcher.invoke(startup("setMenuBarEnabled"), [true]),
      ).resolves.toBeUndefined();
      expect(dispatcher.invoke(startup("isMenuBarEnabled"), [])).toBe(true);
      expect(setMenuBarEnabled).toHaveBeenCalledWith(true);
      expect(state.get("menuBarEnabled")).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not persist the tray setting when the operating-system tray fails", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "tray-failure-"));
    try {
      const state = new StateStore(directory);
      const dispatcher = new ServiceDispatcher({
        state,
        isMenuBarEnabled: () => false,
        setMenuBarEnabled: () => {
          throw new Error("tray unavailable");
        },
      } as unknown as ServiceContext);

      expect(() =>
        dispatcher.invoke(
          channel("claude.settings.Startup", "setMenuBarEnabled"),
          [true],
        ),
      ).toThrow("tray unavailable");
      expect(state.get("menuBarEnabled")).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reads and writes the operating-system startup setting", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "startup-setting-"));
    const state = new StateStore(directory);
    try {
      electron.getLoginItemSettings.mockReturnValueOnce({
        openAtLogin: false,
        executableWillLaunchAtLogin: true,
      });
      const dispatcher = dispatcherWithState(state);
      expect(
        dispatcher.invoke(
          channel("claude.settings.Startup", "isStartupOnLoginEnabled"),
          [],
        ),
      ).toBe(true);
      expect(
        dispatcher.invoke(
          channel("claude.settings.Startup", "setStartupOnLoginEnabled"),
          [true],
        ),
      ).toBeUndefined();
      expect(electron.setLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
        name: "Open-Claude",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("sanitizes persisted MCP server configs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-state-"));
    try {
      const state = new StateStore(directory);
      await dispatcherWithState(state).invoke(
        channel("claude.settings.MCP", "setMcpServerConfigs"),
        [
          {
            good: {
              command: " node ",
              args: ["server.js", 4],
              env: { TOKEN: "value", BAD: 12 },
              status: "running",
              error: "stale",
            },
            broken: { status: "running" },
            ...JSON.parse(
              '{"__proto__":{"command":"attacker"},"constructor":{"command":"attacker"}}',
            ),
          },
        ],
      );
      expect(state.get("appConfig").mcpServers).toEqual({
        good: {
          command: "node",
          args: ["server.js"],
          env: { TOKEN: "value" },
        },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("backs native find-in-page with the active application view", () => {
    electron.findInPage.mockReturnValueOnce(42);
    const dispatcher = new ServiceDispatcher({
      mainView: () => ({
        webContents: {
          isDestroyed: () => false,
          findInPage: electron.findInPage,
          stopFindInPage: electron.stopFindInPage,
        },
      }),
    } as unknown as ServiceContext);

    expect(
      dispatcher.invoke(
        channel("claude.internal.findInPage.FindInPage", "findInPage"),
        ["needle", { forward: false, findNext: true, matchCase: true }],
      ),
    ).toBe(42);
    expect(electron.findInPage).toHaveBeenCalledWith("needle", {
      forward: false,
      findNext: true,
      matchCase: true,
    });
    dispatcher.invoke(
      channel("claude.internal.findInPage.FindInPage", "endFindSession"),
      [],
    );
    expect(electron.stopFindInPage).toHaveBeenCalledWith("clearSelection");
  });

  it("fails closed for unsupported mutations but accepts renderer-only signals", () => {
    const dispatcher = new ServiceDispatcher({} as ServiceContext);
    expect(() =>
      dispatcher.invoke(channel("claude.settings.CcdCli", "installCcdCli"), []),
    ).toThrow("unavailable in local mode");
    expect(
      dispatcher.invoke(
        channel("claude.web.CustomPlugins", "listInstalledPlugins"),
        [],
      ),
    ).toEqual([]);
    expect(
      dispatcher.invoke(
        channel("claude.web.CustomPlugins", "syncLocalOrgPlugins"),
        [],
      ),
    ).toBeUndefined();
    expect(
      dispatcher.invoke(channel("claude.web.Resources", "setFocusedCwd"), [
        "C:\\workspace",
      ]),
    ).toBeUndefined();
    expect(() =>
      dispatcher.invoke(channel("claude.web.FutureSurface", "listItems"), []),
    ).toThrow("has no declared local compatibility policy");
  });

  it("forwards the native Plugins service to the local plugin manager", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue([
        { id: "demo@marketplace", name: "demo", isInstalled: false },
      ]);
    const dispatcher = new ServiceDispatcher({
      plugins: { invoke },
    } as unknown as ServiceContext);

    await expect(
      dispatcher.invoke(
        channel("claude.web.CustomPlugins", "listAvailablePlugins"),
        [[], undefined],
      ),
    ).resolves.toEqual([
      { id: "demo@marketplace", name: "demo", isInstalled: false },
    ]);
    expect(invoke).toHaveBeenCalledWith("listAvailablePlugins", [
      [],
      undefined,
    ]);
  });

  it("rejects every obsolete Cowork service instead of returning defaults", () => {
    const dispatcher = new ServiceDispatcher({} as ServiceContext);
    for (const key of [
      "claude.web.CoworkUserFiles",
      "claude.web.CoworkScheduledTasks",
      "claude.web.CoworkArtifacts",
      "claude.web.ClaudeVM",
      "claude.web.AgentModeFeedback",
      "claude.coworkArtifact.CoworkArtifactBridge",
    ]) {
      expect(() => dispatcher.invoke(channel(key, "getAll"), [])).toThrow(
        "Cowork has been removed",
      );
    }
  });

  it("routes native local-skill compatibility calls to LocalSessions", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const dispatcher = new ServiceDispatcher({
      codeSessions: { invoke },
    } as unknown as ServiceContext);
    await expect(
      dispatcher.invoke(
        channel("claude.web.LocalAgentModeSessions", "setLocalSkillEnabled"),
        ["proof-skill", false],
      ),
    ).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("setLocalSkillEnabled", [
      "proof-skill",
      false,
    ]);
  });

  it("implements the retained managed policy, simulator, and window contracts", () => {
    const showMainWindow = vi.fn();
    const dispatcher = new ServiceDispatcher({
      showMainWindow,
    } as unknown as ServiceContext);
    for (const method of [
      "managedRendererConfig_$store$_getState",
      "managedRendererConfig_$store$_getStateSync",
      "managedRendererConfig_$store$_update",
    ]) {
      expect(
        dispatcher.invoke(channel("claude.web.ManagedConfig", method), []),
      ).toEqual({
        disableEssentialTelemetry: true,
        disableNonessentialTelemetry: true,
        disableMobileSimulatorTools: true,
      });
    }
    expect(
      dispatcher.invoke(
        channel("claude.simulator.Simulator", "checkSetup"),
        [],
      ),
    ).toEqual({ xcode: false });
    expect(
      dispatcher.invoke(
        channel("claude.simulator.Simulator", "checkAndroidSetup"),
        [],
      ),
    ).toEqual({ studioInstalled: false });
    expect(
      dispatcher.invoke(
        channel("claude.simulator.Simulator", "openAndroidStudio"),
        [],
      ),
    ).toBe(false);
    expect(
      dispatcher.invoke(channel("claude.web.WindowControl", "show"), []),
    ).toBeUndefined();
    expect(showMainWindow).toHaveBeenCalledOnce();
  });

  it("persists the new forge visibility set and delegates custom-provider usage", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "delta-state-"));
    try {
      const state = new StateStore(directory);
      const usage = {
        windowDays: 7,
        generatedAtMs: 123,
        turns: 1,
        errorTurns: 0,
        surfaces: {},
        models: [],
        tools: [],
        daily: [],
      };
      const invoke = vi.fn().mockResolvedValue(usage);
      const dispatcher = new ServiceDispatcher({
        state,
        codeSessions: { invoke },
      } as unknown as ServiceContext);

      await expect(
        dispatcher.invoke(
          channel("claude.web.ForgeState", "setForgeStateVisibleKeys"),
          [["github:owner/repo#1", "github:owner/repo#1", "x".repeat(300)]],
        ),
      ).resolves.toBeUndefined();
      expect(state.get("stores").forgeStateVisibleKeys).toEqual([
        "github:owner/repo#1",
      ]);
      expect(
        dispatcher.invoke(
          channel("claude.web.ForgeState", "getForgeStateSnapshot"),
          [],
        ),
      ).toEqual([]);
      await expect(
        dispatcher.invoke(
          channel("claude.settings.Custom3pUsage", "getSummary"),
          [7],
        ),
      ).resolves.toEqual(usage);
      expect(invoke).toHaveBeenCalledWith("getCustom3pUsageSummary", [7]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("creates a bounded native-shaped logs handoff ZIP", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "handoff-bundle-"));
    const logs = path.join(directory, "logs");
    const temporary = path.join(directory, "temp");
    try {
      await mkdir(logs, { recursive: true });
      await writeFile(path.join(logs, "main.log"), "backend ready\n", "utf8");
      electron.getPath.mockImplementation((name) =>
        name === "logs" ? logs : temporary,
      );
      electron.getVersion.mockReturnValue("0.2.1-test");
      const invoke = vi.fn(async (method: string) =>
        method === "getSession"
          ? { sessionId: "proof-session", title: "Proof" }
          : [{ type: "user", message: { content: "hello" } }],
      );
      const dispatcher = new ServiceDispatcher({
        codeSessions: { invoke },
      } as unknown as ServiceContext);
      const handoff = channel(
        "claude.web.LocalSessions",
        "createLogsHandoffBundle",
      );

      await expect(
        dispatcher.invoke(handoff, ["https://example.com/thread"]),
      ).resolves.toEqual(
        expect.objectContaining({
          success: false,
          errorCode: "invalid_thread_url",
        }),
      );
      const result = (await dispatcher.invoke(handoff, [
        "https://claude.ai/task/proof",
        "proof-session",
      ])) as { success: boolean; zipPath: string };
      expect(result.success).toBe(true);
      const entries = zipEntries(await readFile(result.zipPath));
      expect([...entries.keys()].sort()).toEqual([
        "logs/main.log",
        "manifest.json",
        "session.json",
      ]);
      expect(
        Buffer.from(entries.get("manifest.json") ?? []).toString("utf8"),
      ).toContain('"appVersion": "0.2.1-test"');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
