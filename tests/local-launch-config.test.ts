import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import { createServer as createNetServer } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const electronUrl = vi.hoisted(() => ({ value: "" }));
const electron = vi.hoisted(() => ({
  executedScripts: [] as string[],
  handle: vi.fn(),
  unhandle: vi.fn(),
  onBeforeRequest: vi.fn(),
  sessionOn: vi.fn(),
  setPermissionCheckHandler: vi.fn(),
  setPermissionRequestHandler: vi.fn(),
  setProxy: vi.fn(async () => undefined),
  loadUrl: vi.fn(async (url: string) => {
    electronUrl.value = url;
  }),
  debuggerCommand: vi.fn(
    async (_command?: string): Promise<Record<string, unknown>> => ({}),
  ),
  executeJavaScript: vi.fn(async (script: string) => {
    electron.executedScripts.push(script);
    return script.includes("document.title")
      ? {
          title: "Browser fixture",
          url: "http://localhost:4173/agent",
          text: "Fixture body",
        }
      : script.includes("getBoundingClientRect")
        ? { ok: true, x: 10, y: 20 }
        : { ok: true };
  }),
  capturePage: vi.fn(async () => ({
    isEmpty: (): boolean => false,
    toPNG: () => Buffer.from("fixture-png"),
  })),
  goBack: vi.fn(),
  goForward: vi.fn(),
  reload: vi.fn(),
  addChildView: vi.fn(),
  removeChildView: vi.fn(),
  setBounds: vi.fn(),
  getBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  setVisible: vi.fn(),
  setBorderRadius: vi.fn(),
  openPath: vi.fn(async () => ""),
}));

vi.mock("electron", () => ({
  BrowserWindow: class {},
  dialog: {},
  session: {
    fromPartition: () => ({
      webRequest: { onBeforeRequest: electron.onBeforeRequest },
      protocol: { handle: electron.handle, unhandle: electron.unhandle },
      on: electron.sessionOn,
      setPermissionCheckHandler: electron.setPermissionCheckHandler,
      setPermissionRequestHandler: electron.setPermissionRequestHandler,
      setProxy: electron.setProxy,
    }),
  },
  shell: { openExternal: vi.fn(), openPath: electron.openPath },
  WebContentsView: class {
    webContents = {
      isDestroyed: () => false,
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      loadURL: electron.loadUrl,
      getURL: vi.fn(() => electronUrl.value || "http://localhost:4173/agent"),
      getTitle: vi.fn(() => "Browser fixture"),
      debugger: {
        isAttached: vi.fn(() => true),
        attach: vi.fn(),
        detach: vi.fn(),
        sendCommand: electron.debuggerCommand,
      },
      navigationHistory: {
        canGoBack: vi.fn(() => true),
        canGoForward: vi.fn(() => true),
        goBack: electron.goBack,
        goForward: electron.goForward,
      },
      reload: electron.reload,
      executeJavaScript: electron.executeJavaScript,
      stop: vi.fn(),
      forcefullyCrashRenderer: vi.fn(),
      capturePage: electron.capturePage,
      send: vi.fn(),
      close: vi.fn(),
    };
    getBounds = electron.getBounds;
    setBounds = electron.setBounds;
    setVisible = electron.setVisible;
    setBorderRadius = electron.setBorderRadius;
  },
}));

import {
  isAllowedLaunchRuntime,
  LocalLaunchPreview,
} from "../src/main/local-launch-preview";
import type { LocalCodeSessionManager } from "../src/main/local-code";

const roots: string[] = [];
const previews: LocalLaunchPreview[] = [];

afterEach(async () => {
  electronUrl.value = "";
  electron.executedScripts.length = 0;
  electron.capturePage.mockReset();
  electron.capturePage.mockResolvedValue({
    isEmpty: () => false,
    toPNG: () => Buffer.from("fixture-png"),
  });
  electron.debuggerCommand.mockReset();
  electron.debuggerCommand.mockResolvedValue({});
  electron.executeJavaScript.mockReset();
  electron.executeJavaScript.mockImplementation(async (script: string) => {
    electron.executedScripts.push(script);
    return script.includes("document.title")
      ? {
          title: "Browser fixture",
          url: "http://localhost:4173/agent",
          text: "Fixture body",
        }
      : script.includes("getBoundingClientRect")
        ? { ok: true, x: 10, y: 20 }
        : { ok: true };
  });
  await Promise.all(previews.splice(0).map((preview) => preview.dispose()));
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
  vi.clearAllMocks();
});

async function fixture(): Promise<{
  root: string;
  config: string;
  preview: LocalLaunchPreview;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "local-launch-"));
  roots.push(root);
  const configDirectory = path.join(root, ".open-claude");
  await mkdir(configDirectory);
  const preview = new LocalLaunchPreview(
    () => null,
    {} as LocalCodeSessionManager,
    () => undefined,
    () => undefined,
  );
  previews.push(preview);
  return { root, config: path.join(configDirectory, "launch.json"), preview };
}

async function availablePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!port) throw new Error("Could not select a launch test port");
  return port;
}

describe("launch configuration boundary", () => {
  it("allows common development runtimes but rejects command shells", () => {
    expect(isAllowedLaunchRuntime("node.exe")).toBe(true);
    expect(isAllowedLaunchRuntime("npm.cmd")).toBe(true);
    expect(isAllowedLaunchRuntime("python3")).toBe(true);
    expect(isAllowedLaunchRuntime("powershell.exe")).toBe(false);
    expect(isAllowedLaunchRuntime("cmd.exe")).toBe(false);
  });

  it("denies embedded permissions, downloads, and non-PDF extensions", async () => {
    const { preview } = await fixture();
    expect(electron.setPermissionCheckHandler).toHaveBeenCalledTimes(2);
    expect(electron.setPermissionRequestHandler).toHaveBeenCalledTimes(2);
    expect(electron.sessionOn).toHaveBeenCalledWith(
      "will-download",
      expect.any(Function),
    );

    const browserRequest = electron.onBeforeRequest.mock.calls[1]?.[0] as (
      details: { url: string; webContentsId?: number },
      callback: (result: { cancel: boolean }) => void,
    ) => void;
    const blocked = vi.fn();
    browserRequest(
      { url: "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html" },
      blocked,
    );
    await vi.waitFor(() =>
      expect(blocked).toHaveBeenCalledWith({ cancel: true }),
    );
    const pdfViewer = vi.fn();
    browserRequest(
      {
        url: "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/index.html",
      },
      pdfViewer,
    );
    await vi.waitFor(() =>
      expect(pdfViewer).toHaveBeenCalledWith({ cancel: false }),
    );
    expect(preview).toBeDefined();
  });

  it("rejects non-finite viewports and cross-origin artifact routes", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "local-launch-artifact-origin-"),
    );
    roots.push(root);
    const codeSessions = {
      invoke: vi.fn(async () => null),
    } as unknown as LocalCodeSessionManager;
    const preview = new LocalLaunchPreview(
      () => null,
      codeSessions,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = preview.startBrowserPreview(root, "session-origin");
    expect(serverId).toEqual(expect.any(String));
    expect(preview.setPreviewViewport(serverId, Number.NaN, 800)).toBe(false);
    expect(
      preview.setPreviewViewport(serverId, 800, Number.POSITIVE_INFINITY),
    ).toBe(false);
    await expect(
      preview.loadArtifactPreview(
        "https://example.com/code/artifact/00000000-0000-4000-8000-000000000001",
        root,
        "session-origin",
      ),
    ).resolves.toBeNull();
    expect(codeSessions.invoke).not.toHaveBeenCalled();
  });

  it("cancels an in-flight Code browser DOM action", async () => {
    const { root, preview } = await fixture();
    const serverId = preview.startBrowserPreview(root, "cancel-session");
    const tabId = preview.openPreviewTab(serverId, root);
    if (!serverId || !tabId) throw new Error("Missing browser fixture tab");
    electron.executeJavaScript.mockImplementationOnce(
      () => new Promise<never>(() => undefined),
    );
    const controller = new AbortController();
    const action = preview.executeCodeBrowserTool(
      "cancel-session",
      root,
      "mcp__Claude_Browser__read_page",
      { tabId },
      controller.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(action).rejects.toThrow(/cancelled/i);
  });

  it("pins public Code browser traffic through the guarded proxy", async () => {
    const { root, preview } = await fixture();
    const serverId = preview.startBrowserPreview(root, "public-session");
    const tabId = preview.openPreviewTab(serverId, root);
    if (!serverId || !tabId) throw new Error("Missing browser fixture tab");
    await expect(
      preview.navigatePreview(serverId, "https://93.184.216.34/", tabId),
    ).resolves.toBe(true);
    expect(electron.setProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyRules: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+$/),
      }),
    );
  });

  it("refreshes artifact content from disk and opens its backing file", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "local-launch-artifact-"),
    );
    roots.push(root);
    const artifactPath = path.join(root, "artifact.html");
    await writeFile(artifactPath, "<!doctype html><p>first</p>");
    let content = "<!doctype html><p>first</p>";
    const codeSessions = {
      invoke: vi.fn(async (method: string) =>
        method === "readArtifactById"
          ? {
              content,
              type: "text/html",
              path: artifactPath,
              cwd: root,
              sessionId: "session-1",
            }
          : null,
      ),
    } as unknown as LocalCodeSessionManager;
    const owner = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800] as [number, number],
      contentView: {
        addChildView: electron.addChildView,
        removeChildView: electron.removeChildView,
      },
    };
    const preview = new LocalLaunchPreview(
      () => owner as never,
      codeSessions,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = await preview.loadArtifactPreview(
      "/code/artifact/00000000-0000-4000-8000-000000000001",
      root,
      "session-1",
    );
    expect(serverId).not.toBeNull();
    expect(
      preview.showPreview(
        serverId,
        { x: 500, y: 90, width: 600, height: 500 },
        "artifact-pane",
      ),
    ).toBe(true);

    content = "<!doctype html><p>second</p>";
    expect(preview.refreshPreview(serverId)).toBe(true);
    await vi.waitFor(() => expect(electron.reload).toHaveBeenCalled());
    electronUrl.value = "claude-local-launch://fixture/artifact.html";
    await expect(preview.openPreviewInBrowser(serverId)).resolves.toBe(true);
    expect(electron.openPath).toHaveBeenCalledWith(artifactPath);
  });

  it("detaches native previews while renderer menus are open", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "local-launch-overlay-"));
    roots.push(root);
    const owner = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800] as [number, number],
      contentView: {
        addChildView: electron.addChildView,
        removeChildView: electron.removeChildView,
      },
    };
    const preview = new LocalLaunchPreview(
      () => owner as never,
      {} as LocalCodeSessionManager,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = await preview.loadHtmlPreviewContent(
      "<!doctype html><p>artifact</p>",
      "artifact.html",
      false,
      root,
      "session-1",
    );

    expect(
      preview.showPreview(
        serverId,
        { x: 500, y: 90, width: 600, height: 500 },
        "artifact-pane",
      ),
    ).toBe(true);
    expect(electron.addChildView).toHaveBeenCalledTimes(1);
    expect(preview.setNativePreviewOverlayOpen(true)).toBe(1);
    expect(electron.removeChildView).toHaveBeenCalledTimes(1);
    expect(electron.setVisible).toHaveBeenLastCalledWith(false);
    expect(preview.setNativePreviewOverlayOpen(false)).toBe(1);
    expect(electron.addChildView).toHaveBeenCalledTimes(2);
    expect(electron.setVisible).toHaveBeenLastCalledWith(true);
  });

  it("gives a shown preview a usable viewport when layout reports zero size", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "local-launch-bounds-"));
    roots.push(root);
    const owner = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800] as [number, number],
      contentView: {
        addChildView: electron.addChildView,
        removeChildView: electron.removeChildView,
      },
    };
    const preview = new LocalLaunchPreview(
      () => owner as never,
      {} as LocalCodeSessionManager,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = preview.startBrowserPreview(root, "zero-bounds");

    expect(
      preview.showPreview(
        serverId,
        { x: 1200, y: 800, width: 0, height: 0 },
        "browser-pane",
      ),
    ).toBe(true);
    expect(electron.setBounds).toHaveBeenLastCalledWith({
      x: 720,
      y: 440,
      width: 480,
      height: 360,
    });
  });

  it("captures a hidden browser tab through CDP when the compositor is empty", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "local-launch-shot-"));
    roots.push(root);
    electron.capturePage.mockResolvedValue({
      isEmpty: (): boolean => true,
      toPNG: () => Buffer.alloc(0),
    });
    const cdpPng = Buffer.from("cdp-screenshot").toString("base64");
    electron.debuggerCommand.mockImplementation(async (command?: string) =>
      command === "Page.captureScreenshot" ? { data: cdpPng } : {},
    );
    const owner = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800] as [number, number],
      contentView: {
        addChildView: electron.addChildView,
        removeChildView: electron.removeChildView,
      },
    };
    const preview = new LocalLaunchPreview(
      () => owner as never,
      {} as LocalCodeSessionManager,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = preview.startBrowserPreview(root, "session-shot");
    expect(serverId).not.toBeNull();
    const tabId = preview.openPreviewTab(serverId, root);
    expect(tabId).not.toBeNull();
    expect(preview.setActivePreviewTab(serverId, tabId)).toBe(true);
    expect(
      preview.showPreview(
        serverId,
        { x: 500, y: 90, width: 600, height: 500 },
        "browser-pane",
      ),
    ).toBe(true);

    await expect(
      preview.capturePreviewScreenshot(serverId, tabId),
    ).resolves.toBe(cdpPng);
    expect(electron.debuggerCommand).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.objectContaining({ format: "png", fromSurface: true }),
    );
  });

  it("bounds native capture before falling back to CDP", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "local-launch-hung-shot-"),
    );
    roots.push(root);
    electron.capturePage.mockImplementation(
      () => new Promise<never>(() => undefined),
    );
    const cdpPng = Buffer.from("cdp-after-timeout").toString("base64");
    electron.debuggerCommand.mockResolvedValue({ data: cdpPng });
    const owner = {
      isDestroyed: () => false,
      getContentSize: () => [1200, 800] as [number, number],
      contentView: {
        addChildView: electron.addChildView,
        removeChildView: electron.removeChildView,
      },
    };
    const preview = new LocalLaunchPreview(
      () => owner as never,
      {} as LocalCodeSessionManager,
      () => undefined,
      () => undefined,
    );
    previews.push(preview);
    const serverId = preview.startBrowserPreview(root, "hung-shot");
    const tabId = preview.openPreviewTab(serverId, root);
    expect(preview.setActivePreviewTab(serverId, tabId)).toBe(true);
    expect(
      preview.showPreview(
        serverId,
        { x: 500, y: 90, width: 600, height: 500 },
        "browser-pane",
      ),
    ).toBe(true);

    await expect(
      preview.capturePreviewScreenshot(serverId, tabId),
    ).resolves.toBe(cdpPng);
    expect(electron.debuggerCommand).toHaveBeenCalledWith(
      "Page.captureScreenshot",
      expect.objectContaining({ format: "png" }),
    );
    expect(electron.capturePage).toHaveBeenCalled();
  });

  it("ignores Anthropic .claude launch state", async () => {
    const { root, preview } = await fixture();
    const reservedDirectory = path.join(root, ".claude");
    const reservedConfig = path.join(reservedDirectory, "launch.json");
    await mkdir(reservedDirectory);
    await writeFile(
      reservedConfig,
      JSON.stringify({
        autoVerify: true,
        configurations: [
          { name: "must-not-load", runtimeExecutable: process.execPath },
        ],
      }),
    );

    await expect(preview.getConfiguredServices(root)).resolves.toEqual([]);
    await expect(preview.getAutoVerify(root)).resolves.toBe(false);
    await expect(preview.setAutoVerify(root, false)).resolves.toBe(false);
    expect(JSON.parse(await readFile(reservedConfig, "utf8"))).toEqual(
      expect.objectContaining({ autoVerify: true }),
    );
  });

  it("ignores malformed and workspace-escaping configurations", async () => {
    const { root, config, preview } = await fixture();
    await writeFile(config, "not json");
    await expect(preview.getConfiguredServices(root)).resolves.toEqual([]);

    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          { name: "escape", program: "../outside.js" },
          {
            name: "valid",
            runtimeExecutable: process.execPath,
            args: ["--version"],
            port: 70_000,
          },
        ],
      }),
    );
    await expect(preview.getConfiguredServices(root)).resolves.toEqual([
      { name: "valid", port: 3000 },
    ]);
  });

  it("updates a regular config atomically but refuses a linked config", async () => {
    const { root, config, preview } = await fixture();
    await writeFile(
      config,
      JSON.stringify({
        autoVerify: false,
        configurations: [
          { name: "valid", runtimeExecutable: process.execPath },
        ],
      }),
    );
    await expect(preview.setAutoVerify(root, true)).resolves.toBe(true);
    expect(JSON.parse(await readFile(config, "utf8")).autoVerify).toBe(true);

    const outside = path.join(
      path.dirname(root),
      `${path.basename(root)}-outside.json`,
    );
    roots.push(outside);
    await writeFile(outside, JSON.stringify({ autoVerify: "unchanged" }));
    await rm(config);
    await symlink(outside, config, "file");
    await expect(preview.setAutoVerify(root, false)).resolves.toBe(false);
    expect(JSON.parse(await readFile(outside, "utf8")).autoVerify).toBe(
      "unchanged",
    );
  });

  it("lets Browser previews navigate loopback without widening file previews", async () => {
    const { root, preview } = await fixture();
    const browserId = preview.startBrowserPreview(root, "session");
    expect(browserId).toEqual(expect.any(String));
    await expect(
      preview.navigatePreview(browserId, "http://127.0.0.1:43123/page"),
    ).resolves.toBe(true);
    expect(electron.loadUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:43123/page",
    );

    const fileId = await preview.loadHtmlPreviewContent(
      "<!doctype html>",
      "preview.html",
      false,
      root,
      "session",
    );
    expect(fileId).toMatch(/^html-preview-[0-9a-f-]{36}$/);
    await expect(
      preview.navigatePreview(fileId, "http://127.0.0.1:43123/page"),
    ).resolves.toBe(false);

    await preview.dispose();
    expect(preview.startBrowserPreview(root, "session")).toBeNull();
  });

  it("exposes native browser tab summaries and emits active tab changes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "local-launch-tabs-"));
    roots.push(root);
    const tabEvents: Array<{
      serverId: string;
      tabs: readonly Record<string, unknown>[];
      activeTabId: string;
    }> = [];
    const urlEvents: Array<{ serverId: string; url: string }> = [];
    const preview = new LocalLaunchPreview(
      () => null,
      {} as LocalCodeSessionManager,
      () => undefined,
      () => undefined,
      (serverId, tabs, activeTabId) =>
        tabEvents.push({ serverId, tabs, activeTabId }),
      (serverId, url) => urlEvents.push({ serverId, url }),
    );
    previews.push(preview);

    const serverId = preview.startBrowserPreview(root, "session");
    expect(serverId).toEqual(expect.any(String));
    expect(preview.getPreviewTabs(serverId)).toEqual({
      tabs: [
        {
          tabId: "seed",
          origin: "",
          toolAccess: "allowed",
          isOrgBlocked: false,
          loading: false,
        },
      ],
      activeTabId: "seed",
    });

    const tabId = preview.openPreviewTab(serverId, root);
    expect(tabId).toBe("tab-1");
    expect(preview.setActivePreviewTab(serverId, tabId)).toBe(true);
    await expect(
      preview.navigatePreview(serverId, "http://localhost:4173/app", tabId),
    ).resolves.toBe(true);
    expect(preview.getPreviewTabs(serverId)).toMatchObject({
      activeTabId: "tab-1",
      tabs: [{ tabId: "seed" }, { tabId: "tab-1" }],
    });
    expect(tabEvents.at(-1)?.activeTabId).toBe("tab-1");
    expect(urlEvents.at(-1)).toEqual({ serverId, url: "about:blank" });

    await expect(
      preview.navigatePreview(serverId, "http://example.com", tabId),
    ).resolves.toBe(false);
    await expect(
      preview.navigatePreview(serverId, "https://192.168.1.1/private", tabId),
    ).resolves.toBe(false);
    expect(preview.closePreviewTab(serverId, tabId)).toBe(true);
    expect(preview.getPreviewTabs(serverId)).toMatchObject({
      activeTabId: "seed",
      tabs: [{ tabId: "seed" }],
    });

    const agentOutput = await preview.executeCodeBrowserTool(
      "agent-session",
      root,
      "mcp__Claude_Browser__tabs_create",
      { url: "http://localhost:4173/agent" },
      new AbortController().signal,
    );
    const jsonEnd = agentOutput.indexOf("\n}");
    expect(jsonEnd).toBeGreaterThan(0);
    const created = JSON.parse(agentOutput.slice(0, jsonEnd + 2));
    expect(created).toMatchObject({
      type: "browser",
      serverId: expect.any(String),
      tabId: "tab-1",
      reused: false,
      navOk: true,
    });

    const signal = new AbortController().signal;
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__read_page",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toContain("Fixture body");
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__tabs_list",
        {},
        signal,
      ),
    ).resolves.toContain('"activeTabId":"tab-1"');
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__snapshot",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toContain("Fixture body");
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__inspect",
        { tabId: created.tabId, selector: "#submit" },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__console_logs",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toBe("[]");
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__click",
        { tabId: created.tabId, selector: "button", text: "Submit" },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    expect(electron.executedScripts.at(-1)).toContain(
      "matches.find(candidate => labelFor(candidate) === visibleText)",
    );
    expect(electron.debuggerCommand).toHaveBeenCalledWith(
      "Input.dispatchMouseEvent",
      expect.objectContaining({ type: "mousePressed" }),
    );
    const mouseCommandsBeforeFallback =
      electron.debuggerCommand.mock.calls.filter(
        ([method]) => method === "Input.dispatchMouseEvent",
      ).length;
    electron.executeJavaScript.mockImplementationOnce(
      async (script: string) => {
        electron.executedScripts.push(script);
        return { ok: true, x: -88, y: -55, inViewport: false };
      },
    );
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__click",
        { tabId: created.tabId, selector: "button", text: "Submit" },
        signal,
      ),
    ).resolves.toContain('"activation":"dom"');
    expect(electron.executedScripts.at(-1)).toContain("element.click()");
    expect(
      electron.debuggerCommand.mock.calls.filter(
        ([method]) => method === "Input.dispatchMouseEvent",
      ),
    ).toHaveLength(mouseCommandsBeforeFallback);
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__type",
        { tabId: created.tabId, selector: "#query", text: "local browser" },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    expect(electron.debuggerCommand).toHaveBeenCalledWith("Input.insertText", {
      text: "local browser",
    });
    expect(preview.setPreviewViewport(created.serverId, 390, 844)).toBe(true);
    expect(preview.setPreviewColorScheme(created.serverId, "dark")).toBe(true);
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__go_back",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    expect(electron.goBack).toHaveBeenCalled();
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__refresh",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    expect(electron.reload).toHaveBeenCalled();
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__screenshot",
        { tabId: created.tabId },
        signal,
      ),
    ).resolves.toContain('"mimeType":"image/png"');
  });

  it("coalesces concurrent starts of the same configured service", async () => {
    const { root, config, preview } = await fixture();
    const port = await availablePort();
    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "shared-service",
            runtimeExecutable: process.execPath,
            args: [
              "-e",
              "require('http').createServer((_q,r)=>r.end('ok')).listen(Number(process.env.PORT))",
            ],
            port,
          },
        ],
      }),
    );

    const [first, second] = await Promise.all([
      preview.startFromConfig(root, "shared-service", "session"),
      preview.startFromConfig(root, "shared-service", "session"),
    ]);
    expect(first.serverId).toEqual(expect.any(String));
    expect(second.serverId).toBe(first.serverId);
    expect(preview.servers).toHaveLength(1);
  });

  it("restarts a managed service when its launch configuration changes", async () => {
    const { root, config, preview } = await fixture();
    const firstPort = await availablePort();
    const command = (body: string) => [
      "-e",
      `require('http').createServer((_q,r)=>r.end(${JSON.stringify(body)})).listen(Number(process.env.PORT))`,
    ];
    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "replaceable-service",
            runtimeExecutable: process.execPath,
            args: command("first"),
            port: firstPort,
          },
        ],
      }),
    );
    const first = await preview.startFromConfig(
      root,
      "replaceable-service",
      "session",
    );
    expect(
      await fetch(String(first.url)).then((response) => response.text()),
    ).toBe("first");

    // Allocate this only after the first service is listening so the OS cannot
    // hand us the already-active port on a fast test host.
    const secondPort = await availablePort();

    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "replaceable-service",
            runtimeExecutable: process.execPath,
            args: command("second"),
            port: secondPort,
          },
        ],
      }),
    );
    const second = await preview.startFromConfig(
      root,
      "replaceable-service",
      "session",
    );
    expect(second.serverId).not.toBe(first.serverId);
    expect(preview.servers).toHaveLength(1);
    expect(
      await fetch(String(second.url)).then((response) => response.text()),
    ).toBe("second");
  });

  it("auto-selects a free port, injects PORT, and returns readiness", async () => {
    const { root, config, preview } = await fixture();
    const occupied = createNetServer();
    await new Promise<void>((resolve) => occupied.listen(0, resolve));
    const address = occupied.address();
    if (!address || typeof address === "string")
      throw new Error("Missing occupied test port");
    try {
      await writeFile(
        config,
        JSON.stringify({
          configurations: [
            {
              name: "auto-port-service",
              runtimeExecutable: process.execPath,
              args: [
                "-e",
                "require('http').createServer((_q,r)=>r.end('ready')).listen(Number(process.env.PORT))",
              ],
              port: address.port,
              autoPort: true,
            },
          ],
        }),
      );

      const result = await preview.startFromConfig(
        root,
        "auto-port-service",
        "session",
      );
      expect(result).toEqual(
        expect.objectContaining({
          serverId: expect.any(String),
          status: "running",
          url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/$/),
        }),
      );
      expect(result.url).not.toBe(`http://127.0.0.1:${address.port}/`);
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });

  it("retries an auto port when another listener wins after availability", async () => {
    const { root, config, preview } = await fixture();
    const requestedPort = await availablePort();
    const marker = path.join(root, "collision-observed");
    const script = [
      "const fs=require('fs'),http=require('http');",
      `const marker=${JSON.stringify(marker)},port=Number(process.env.PORT);`,
      "if(!fs.existsSync(marker)){",
      "fs.writeFileSync(marker,String(port));",
      "const blocker=http.createServer();",
      "blocker.listen(port,'127.0.0.1',()=>{",
      "const app=http.createServer((_q,r)=>r.end('wrong'));",
      "app.once('error',e=>{console.error(e.code);blocker.close(()=>process.exit(1));});",
      "app.listen(port,'127.0.0.1');});",
      "}else{http.createServer((_q,r)=>r.end('retried')).listen(port,'127.0.0.1');}",
    ].join("");
    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "raced-auto-port",
            runtimeExecutable: process.execPath,
            args: ["-e", script],
            port: requestedPort,
            autoPort: true,
          },
        ],
      }),
    );

    const result = await preview.startFromConfig(
      root,
      "raced-auto-port",
      "session",
    );
    expect(result).toMatchObject({ status: "running" });
    expect(result.url).not.toBe(`http://127.0.0.1:${requestedPort}/`);
    expect(
      await fetch(String(result.url)).then((response) => response.text()),
    ).toBe("retried");
  });

  it("uses an IPv6 loopback URL when a managed dev server is IPv6-only", async () => {
    const { root, config, preview } = await fixture();
    const port = await availablePort();
    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "ipv6-only-service",
            runtimeExecutable: process.execPath,
            args: [
              "-e",
              "require('http').createServer((_q,r)=>r.end('ipv6 ready')).listen(Number(process.env.PORT), '::1')",
            ],
            port,
          },
        ],
      }),
    );

    const result = await preview.startFromConfig(
      root,
      "ipv6-only-service",
      "session",
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "running",
        url: `http://[::1]:${port}/`,
      }),
    );
    expect(
      await fetch(String(result.url)).then((response) => response.text()),
    ).toBe("ipv6 ready");
  });

  it("adopts a loopback dev-server URL reported by a command that ignores PORT", async () => {
    const { root, config, preview } = await fixture();
    const configuredPort = await availablePort();
    let actualPort = await availablePort();
    while (actualPort === configuredPort) actualPort = await availablePort();
    await writeFile(
      config,
      JSON.stringify({
        configurations: [
          {
            name: "vite-style-service",
            runtimeExecutable: process.execPath,
            args: [
              "-e",
              `const p=${actualPort}; console.log('  Local: http://localhost:' + p + '/'); require('http').createServer((_q,r)=>r.end('reported listener')).listen(p)`,
            ],
            port: configuredPort,
          },
        ],
      }),
    );

    const result = await preview.startFromConfig(
      root,
      "vite-style-service",
      "session",
    );
    expect(result).toEqual(
      expect.objectContaining({
        status: "running",
        url: `http://localhost:${actualPort}/`,
      }),
    );
    expect(preview.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port: actualPort, status: "running" }),
      ]),
    );
    expect(
      await fetch(String(result.url)).then((response) => response.text()),
    ).toBe("reported listener");
  });
});
