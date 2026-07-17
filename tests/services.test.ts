import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({
  openPath: vi.fn<(...args: unknown[]) => Promise<string>>(),
}));

vi.mock("electron", () => ({
  app: {},
  autoUpdater: {},
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getFocusedWindow: vi.fn(),
  },
  dialog: {},
  globalShortcut: {},
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
import { ServiceDispatcher, type ServiceContext } from "../src/main/services";
import { StateStore } from "../src/main/state";
import type { ParsedChannel } from "../src/shared/channels";

const openOutputsDirChannel: ParsedChannel = {
  channel:
    "$eipc_message$_test_$_claude.web_$_LocalAgentModeSessions_$_openOutputsDir",
  kind: "message",
  generatorId: "test",
  namespace: "claude.web",
  service: "LocalAgentModeSessions",
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
  return new ServiceDispatcher({ state } as unknown as ServiceContext);
}

describe("ServiceDispatcher local Code integration", () => {
  beforeEach(() => {
    electron.openPath.mockReset();
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
});
