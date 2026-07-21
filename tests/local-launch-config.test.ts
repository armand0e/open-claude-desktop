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

const electron = vi.hoisted(() => ({
  handle: vi.fn(),
  unhandle: vi.fn(),
  onBeforeRequest: vi.fn(),
  loadUrl: vi.fn(async () => undefined),
}));

vi.mock("electron", () => ({
  BrowserWindow: class {},
  dialog: {},
  session: {
    fromPartition: () => ({
      webRequest: { onBeforeRequest: electron.onBeforeRequest },
      protocol: { handle: electron.handle, unhandle: electron.unhandle },
    }),
  },
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  WebContentsView: class {
    webContents = {
      isDestroyed: () => false,
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      loadURL: electron.loadUrl,
      getURL: vi.fn(() => "http://localhost:4173/agent"),
      getTitle: vi.fn(() => "Browser fixture"),
      executeJavaScript: vi.fn(async (script: string) =>
        script.includes("document.title")
          ? {
              title: "Browser fixture",
              url: "http://localhost:4173/agent",
              text: "Fixture body",
            }
          : { ok: true },
      ),
      capturePage: vi.fn(async () => ({
        isEmpty: () => false,
        toPNG: () => Buffer.from("fixture-png"),
      })),
      send: vi.fn(),
      close: vi.fn(),
    };
    setVisible = vi.fn();
  },
}));

import { LocalLaunchPreview } from "../src/main/local-launch-preview";
import type { LocalCodeSessionManager } from "../src/main/local-code";

const roots: string[] = [];
const previews: LocalLaunchPreview[] = [];

afterEach(async () => {
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
        "mcp__Claude_Browser__click",
        { tabId: created.tabId, selector: "#submit" },
        signal,
      ),
    ).resolves.toContain('"ok":true');
    await expect(
      preview.executeCodeBrowserTool(
        "agent-session",
        root,
        "mcp__Claude_Browser__type",
        { tabId: created.tabId, selector: "#query", text: "local browser" },
        signal,
      ),
    ).resolves.toContain('"ok":true');
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
});
