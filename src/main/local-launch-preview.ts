import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BrowserWindow,
  dialog,
  session as electronSession,
  shell,
  WebContentsView,
  type Rectangle,
} from "electron";
import { isPathInside } from "./file-access";
import type { LocalCodeSessionManager } from "./local-code";

type JsonObject = Record<string, unknown>;

interface LaunchServer {
  serverId: string;
  name: string;
  port: number;
  status: "starting" | "running" | "stopped" | "error";
  startedAt: string;
  cwd: string;
  sessionId?: string;
  filePath?: string;
}

interface PreviewEntry {
  server: LaunchServer;
  token: string;
  root: string;
  initialUrl: string;
  inlineContent?: string;
  view?: WebContentsView;
  attached: boolean;
  claimantId?: string;
  process?: ChildProcess;
  logs: Array<{ line: string; timestamp: string }>;
  viewport?: { width: number; height: number };
  colorScheme: "light" | "dark" | "system";
}

interface LaunchConfiguration {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  port: number;
  autoPort: boolean;
  env: Record<string, string>;
}

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function rectangle(value: unknown): Rectangle | null {
  const candidate = objectValue(value);
  const values = [candidate.x, candidate.y, candidate.width, candidate.height];
  if (!values.every((part) => typeof part === "number" && Number.isFinite(part)))
    return null;
  return {
    x: Math.max(0, Math.round(candidate.x as number)),
    y: Math.max(0, Math.round(candidate.y as number)),
    width: Math.max(1, Math.round(candidate.width as number)),
    height: Math.max(1, Math.round(candidate.height as number)),
  };
}

function localPreviewUrl(token: string, relativePath = "index.html"): string {
  const encoded = relativePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `claude-local-launch://${token}/${encoded}`;
}

function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "about:") return url.href === "about:blank";
    if (url.protocol === "claude-local-launch:") return true;
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" ||
        url.hostname === "::1" ||
        /^127(?:\.\d{1,3}){3}$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}

async function unusedPort(): Promise<number> {
  const { createServer } = await import("node:net");
  const server = createServer();
  await new Promise<void>((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function isPortAvailable(port: number): Promise<boolean> {
  const { createServer } = await import("node:net");
  const server = createServer();
  return new Promise<boolean>((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () =>
      server.close(() => resolve(true)),
    );
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(objectValue(value)).flatMap(([key, item]) =>
      typeof item === "string" ? [[key, item]] : [],
    ),
  );
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export class LocalLaunchPreview {
  readonly #window: () => BrowserWindow | null;
  readonly #codeSessions: LocalCodeSessionManager;
  readonly #onChange: (servers: readonly LaunchServer[]) => void;
  readonly #session = electronSession.fromPartition("persist:claude-local-launch");
  readonly #entries = new Map<string, PreviewEntry>();
  readonly #tokens = new Map<string, PreviewEntry>();
  readonly #autoVerify = new Map<string, boolean>();

  constructor(
    window: () => BrowserWindow | null,
    codeSessions: LocalCodeSessionManager,
    onChange: (servers: readonly LaunchServer[]) => void,
  ) {
    this.#window = window;
    this.#codeSessions = codeSessions;
    this.#onChange = onChange;
    this.#session.protocol.handle("claude-local-launch", (request) =>
      this.#handle(request),
    );
  }

  get servers(): readonly LaunchServer[] {
    return [...this.#entries.values()].map((entry) => ({ ...entry.server }));
  }

  #emitChange(): void {
    this.#onChange(this.servers);
  }

  async #handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const entry = this.#tokens.get(url.hostname);
      if (!entry) return new Response("Preview expired", { status: 404 });
      const relative = decodeURIComponent(url.pathname.slice(1)) || "index.html";
      if (relative === "index.html" && entry.inlineContent !== undefined) {
        return new Response(entry.inlineContent, {
          headers: {
            "Content-Type": entry.server.filePath?.toLowerCase().endsWith(".svg")
              ? "image/svg+xml; charset=utf-8"
              : "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; object-src 'none'; base-uri 'self'",
          },
        });
      }
      const candidate = path.resolve(entry.root, relative);
      if (!isPathInside(entry.root, candidate))
        return new Response("Path outside preview root", { status: 403 });
      const resolved = await realpath(candidate);
      if (!isPathInside(entry.root, resolved))
        return new Response("Path outside preview root", { status: 403 });
      const details = await stat(resolved);
      if (!details.isFile() || details.size > MAX_PREVIEW_BYTES)
        return new Response("Preview file unavailable", { status: 404 });
      return new Response(await readFile(resolved), {
        headers: {
          "Content-Type":
            MIME_TYPES[path.extname(resolved).toLowerCase()] ??
            "application/octet-stream",
          "Cache-Control": "no-store",
          "Cross-Origin-Resource-Policy": "same-origin",
        },
      });
    } catch {
      return new Response("Preview file unavailable", { status: 404 });
    }
  }

  #entry(serverId: unknown): PreviewEntry | undefined {
    return typeof serverId === "string" ? this.#entries.get(serverId) : undefined;
  }

  #createEntry(input: {
    name: string;
    cwd: string;
    sessionId?: string;
    filePath?: string;
    initialUrl: string;
    inlineContent?: string;
    port?: number;
    status?: LaunchServer["status"];
    process?: ChildProcess;
  }): PreviewEntry {
    const token = randomUUID();
    const serverId = `local-preview-${randomUUID()}`;
    const entry: PreviewEntry = {
      server: {
        serverId,
        name: input.name,
        port: input.port ?? 0,
        status: input.status ?? "running",
        startedAt: new Date().toISOString(),
        cwd: input.cwd,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.filePath ? { filePath: input.filePath } : {}),
      },
      token,
      root: input.cwd,
      initialUrl: input.initialUrl,
      ...(input.inlineContent !== undefined
        ? { inlineContent: input.inlineContent }
        : {}),
      ...(input.process ? { process: input.process } : {}),
      attached: false,
      logs: [],
      colorScheme: "system",
    };
    this.#entries.set(serverId, entry);
    this.#tokens.set(token, entry);
    this.#emitChange();
    return entry;
  }

  #ensureView(entry: PreviewEntry): WebContentsView {
    if (entry.view && !entry.view.webContents.isDestroyed()) return entry.view;
    const view = new WebContentsView({
      webPreferences: {
        session: this.#session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        plugins: true,
      },
    });
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (!isLoopbackUrl(url)) void shell.openExternal(url).catch(() => {});
      return { action: "deny" };
    });
    const protectNavigation = (event: Electron.Event, url: string) => {
      if (!isLoopbackUrl(url)) {
        event.preventDefault();
        void shell.openExternal(url).catch(() => {});
      }
    };
    view.webContents.on("will-navigate", protectNavigation);
    view.webContents.on("will-redirect", protectNavigation);
    entry.view = view;
    return view;
  }

  #setBounds(entry: PreviewEntry, bounds: Rectangle): void {
    const owner = this.#window();
    if (!owner || owner.isDestroyed() || !entry.view) return;
    const [windowWidth, windowHeight] = owner.getContentSize();
    entry.view.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.min(bounds.width, Math.max(1, windowWidth - bounds.x)),
      height: Math.min(bounds.height, Math.max(1, windowHeight - bounds.y)),
    });
    entry.view.setBorderRadius(0);
  }

  async loadHtmlPreview(
    filePath: unknown,
    sessionId?: unknown,
    cwd?: unknown,
  ): Promise<string | null> {
    if (typeof filePath !== "string") return null;
    let resolved: string | null = null;
    if (typeof sessionId === "string") {
      const candidate = await this.#codeSessions.invoke("resolveSessionFile", [
        sessionId,
        filePath,
      ]);
      if (typeof candidate === "string") resolved = candidate;
    } else if (typeof cwd === "string") {
      const root = await realpath(path.resolve(cwd)).catch(() => null);
      const candidate = path.resolve(cwd, filePath);
      const canonical = await realpath(candidate).catch(() => null);
      if (root && canonical && isPathInside(root, canonical)) resolved = canonical;
    }
    if (!resolved) return null;
    const details = await stat(resolved).catch(() => null);
    if (!details?.isFile() || details.size > MAX_PREVIEW_BYTES) return null;
    const extension = path.extname(resolved).toLowerCase();
    if (![".html", ".htm", ".svg", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(extension))
      return null;
    const root = await realpath(path.dirname(resolved));
    const token = randomUUID();
    const entry = this.#createEntry({
      name: path.basename(resolved),
      cwd: root,
      ...(typeof sessionId === "string" ? { sessionId } : {}),
      filePath: resolved,
      initialUrl: localPreviewUrl(token, path.basename(resolved)),
    });
    this.#tokens.delete(entry.token);
    entry.token = token;
    this.#tokens.set(token, entry);
    return entry.server.serverId;
  }

  async loadHtmlPreviewContent(
    content: unknown,
    filePath: unknown,
    isSvg: unknown,
    cwd: unknown,
    sessionId: unknown,
  ): Promise<string> {
    const root =
      typeof cwd === "string"
        ? await realpath(path.resolve(cwd)).catch(() => path.resolve(cwd))
        : process.cwd();
    const token = randomUUID();
    const entry = this.#createEntry({
      name:
        typeof filePath === "string" && path.basename(filePath)
          ? path.basename(filePath)
          : "Preview",
      cwd: root,
      ...(typeof sessionId === "string" ? { sessionId } : {}),
      filePath:
        typeof filePath === "string"
          ? path.resolve(root, filePath)
          : path.join(root, isSvg ? "preview.svg" : "preview.html"),
      initialUrl: localPreviewUrl(token),
      inlineContent: typeof content === "string" ? content : "",
    });
    this.#tokens.delete(entry.token);
    entry.token = token;
    this.#tokens.set(token, entry);
    return entry.server.serverId;
  }

  startBrowserPreview(cwd: unknown, sessionId: unknown): string | null {
    if (typeof cwd !== "string" || typeof sessionId !== "string") return null;
    const token = randomUUID();
    const entry = this.#createEntry({
      name: "Browser",
      cwd: path.resolve(cwd),
      sessionId,
      initialUrl: localPreviewUrl(token),
      inlineContent:
        "<!doctype html><meta charset=utf-8><style>html{color-scheme:light dark}body{font:14px system-ui;margin:0}</style>",
    });
    this.#tokens.delete(entry.token);
    entry.token = token;
    this.#tokens.set(token, entry);
    return entry.server.serverId;
  }

  async loadArtifactPreview(
    pageUrl: unknown,
    cwd: unknown,
    sessionId: unknown,
  ): Promise<string | null> {
    if (typeof pageUrl !== "string") return null;
    let id: string | undefined;
    try {
      id = new URL(pageUrl, "app://localhost").pathname.match(
        /^\/code\/artifact\/([0-9a-f-]{36})$/i,
      )?.[1];
    } catch {
      return null;
    }
    if (!id) return null;
    const artifact = (await this.#codeSessions.invoke("readArtifactById", [
      id.toLowerCase(),
    ])) as JsonObject | null;
    if (!artifact || typeof artifact.content !== "string") return null;
    const type = typeof artifact.type === "string" ? artifact.type : "text/plain";
    const content = artifact.content;
    const rendered =
      type === "text/html" || type === "image/svg+xml"
        ? content
        : `<!doctype html><meta charset="utf-8"><style>html{color-scheme:light dark}body{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;font:15px/1.6 ui-sans-serif,system-ui,sans-serif}pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,Consolas,monospace}</style><pre>${escapeHtml(content)}</pre>`;
    const artifactCwd =
      typeof artifact.cwd === "string"
        ? artifact.cwd
        : typeof cwd === "string"
          ? cwd
          : process.cwd();
    const artifactSessionId =
      typeof artifact.sessionId === "string"
        ? artifact.sessionId
        : typeof sessionId === "string"
          ? sessionId
          : "local-artifact";
    return this.loadHtmlPreviewContent(
      rendered,
      typeof artifact.path === "string" ? artifact.path : "artifact.html",
      type === "image/svg+xml",
      artifactCwd,
      artifactSessionId,
    );
  }

  showPreview(
    serverId: unknown,
    rawBounds: unknown,
    claimantId?: unknown,
  ): boolean {
    const entry = this.#entry(serverId);
    const bounds = rectangle(rawBounds);
    if (!entry || !bounds) return false;
    const claimant = typeof claimantId === "string" ? claimantId : undefined;
    if (claimant && entry.claimantId && claimant !== entry.claimantId) return false;
    const owner = this.#window();
    if (!owner || owner.isDestroyed()) return false;
    const view = this.#ensureView(entry);
    entry.claimantId = claimant;
    if (!entry.attached) {
      owner.contentView.addChildView(view);
      entry.attached = true;
    }
    this.#setBounds(entry, bounds);
    view.setVisible(true);
    if (!view.webContents.getURL())
      void view.webContents.loadURL(entry.initialUrl).catch(() => undefined);
    return true;
  }

  hidePreview(serverId: unknown, claimantId?: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    if (
      typeof claimantId === "string" &&
      entry.claimantId &&
      claimantId !== entry.claimantId
    )
      return false;
    const owner = this.#window();
    entry.view?.setVisible(false);
    if (owner && !owner.isDestroyed() && entry.view && entry.attached) {
      owner.contentView.removeChildView(entry.view);
      entry.attached = false;
    }
    entry.claimantId = undefined;
    return true;
  }

  focusPreview(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry?.view) return false;
    entry.view.webContents.focus();
    return true;
  }

  getPreviewUrl(serverId: unknown): string | null {
    const entry = this.#entry(serverId);
    return entry?.view?.webContents.getURL() || entry?.initialUrl || null;
  }

  getPreviewNavState(serverId: unknown): JsonObject | null {
    const entry = this.#entry(serverId);
    if (!entry) return null;
    const contents = entry.view?.webContents;
    return {
      url: contents?.getURL() || entry.initialUrl,
      canGoBack: contents?.navigationHistory.canGoBack() ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? false,
      isLoading: contents?.isLoading() ?? false,
    };
  }

  async navigatePreview(serverId: unknown, rawUrl: unknown): Promise<boolean> {
    const entry = this.#entry(serverId);
    if (!entry || typeof rawUrl !== "string" || !isLoopbackUrl(rawUrl))
      return false;
    const view = this.#ensureView(entry);
    await view.webContents.loadURL(rawUrl);
    return true;
  }

  goBack(serverId: unknown): boolean {
    const contents = this.#entry(serverId)?.view?.webContents;
    if (!contents?.navigationHistory.canGoBack()) return false;
    contents.navigationHistory.goBack();
    return true;
  }

  goForward(serverId: unknown): boolean {
    const contents = this.#entry(serverId)?.view?.webContents;
    if (!contents?.navigationHistory.canGoForward()) return false;
    contents.navigationHistory.goForward();
    return true;
  }

  refreshPreview(serverId: unknown): boolean {
    const contents = this.#entry(serverId)?.view?.webContents;
    if (!contents) return false;
    contents.reload();
    return true;
  }

  async capturePreviewScreenshot(serverId: unknown): Promise<string | null> {
    const contents = this.#entry(serverId)?.view?.webContents;
    if (!contents) return null;
    try {
      return (await contents.capturePage()).toPNG().toString("base64");
    } catch {
      return null;
    }
  }

  setPreviewViewport(serverId: unknown, width: unknown, height: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry || typeof width !== "number" || typeof height !== "number")
      return false;
    entry.viewport = {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
    return true;
  }

  clearPreviewViewport(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    delete entry.viewport;
    return true;
  }

  setPreviewColorScheme(serverId: unknown, scheme: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry || !["light", "dark", "system"].includes(String(scheme)))
      return false;
    entry.colorScheme = scheme as PreviewEntry["colorScheme"];
    entry.view?.webContents.send("claude-local-preview-color-scheme", scheme);
    return true;
  }

  getPreviewTabs(serverId: unknown): JsonObject {
    const entry = this.#entry(serverId);
    if (!entry) return { tabs: [], activeTabId: null };
    return {
      tabs: [
        {
          id: "default",
          title: entry.server.name,
          url: this.getPreviewUrl(serverId),
        },
      ],
      activeTabId: "default",
    };
  }

  async openPreviewInBrowser(serverId: unknown): Promise<boolean> {
    const url = this.getPreviewUrl(serverId);
    if (!url) return false;
    if (url.startsWith("claude-local-launch:")) {
      const filePath = this.#entry(serverId)?.server.filePath;
      if (!filePath) return false;
      return (await shell.openPath(filePath)) === "";
    }
    if (!isLoopbackUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  }

  getLogs(serverId: unknown): readonly JsonObject[] {
    return this.#entry(serverId)?.logs.map((log) => ({ ...log })) ?? [];
  }

  private async readLaunchConfig(cwd: string): Promise<{
    autoVerify: boolean;
    configurations: LaunchConfiguration[];
  } | null> {
    const configPath = path.join(cwd, ".claude", "launch.json");
    const parsed = objectValue(
      JSON.parse(await readFile(configPath, "utf8").catch(() => "null")),
    );
    if (!Array.isArray(parsed.configurations)) return null;
    const configurations = parsed.configurations.flatMap(
      (value): LaunchConfiguration[] => {
        const item = objectValue(value);
        const executable =
          typeof item.runtimeExecutable === "string"
            ? item.runtimeExecutable
            : typeof item.program === "string"
              ? process.execPath
              : "";
        if (!executable) return [];
        const args = [
          ...stringArray(item.runtimeArgs),
          ...(typeof item.runtimeExecutable === "string" ||
          typeof item.program !== "string"
            ? []
            : [item.program]),
          ...stringArray(item.args),
        ].map((part) =>
          part
            .replaceAll("${workspaceFolder}", cwd)
            .replaceAll("${workspaceRoot}", cwd),
        );
        const requestedCwd =
          typeof item.cwd === "string"
            ? item.cwd
                .replaceAll("${workspaceFolder}", cwd)
                .replaceAll("${workspaceRoot}", cwd)
            : cwd;
        const resolvedCwd = path.resolve(cwd, requestedCwd);
        if (!isPathInside(cwd, resolvedCwd)) return [];
        const port =
          typeof item.port === "number" && Number.isInteger(item.port)
            ? item.port
            : Number(stringRecord(item.env).PORT) || 3000;
        return [
          {
            name:
              typeof item.name === "string" && item.name.trim()
                ? item.name.trim()
                : path.basename(String(item.program ?? executable)),
            command: executable
              .replaceAll("${workspaceFolder}", cwd)
              .replaceAll("${workspaceRoot}", cwd),
            args,
            cwd: resolvedCwd,
            port,
            autoPort: item.autoPort === true,
            env: stringRecord(item.env),
          },
        ];
      },
    );
    return configurations.length > 0
      ? { autoVerify: parsed.autoVerify !== false, configurations }
      : null;
  }

  async getConfiguredServices(cwd: unknown): Promise<readonly JsonObject[]> {
    if (typeof cwd !== "string") return [];
    const config = await this.readLaunchConfig(path.resolve(cwd));
    return (
      config?.configurations.map(({ name, port }) => ({ name, port })) ?? []
    );
  }

  async getAutoVerify(cwd: unknown): Promise<boolean> {
    if (typeof cwd !== "string") return false;
    const resolved = path.resolve(cwd);
    if (this.#autoVerify.has(resolved)) return this.#autoVerify.get(resolved)!;
    return (await this.readLaunchConfig(resolved))?.autoVerify ?? false;
  }

  async setAutoVerify(cwd: unknown, enabled: unknown): Promise<boolean> {
    if (typeof cwd !== "string" || typeof enabled !== "boolean") return false;
    const resolved = path.resolve(cwd);
    const configPath = path.join(resolved, ".claude", "launch.json");
    try {
      const parsed = objectValue(JSON.parse(await readFile(configPath, "utf8")));
      parsed.autoVerify = enabled;
      await writeFile(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      this.#autoVerify.set(resolved, enabled);
      return true;
    } catch {
      return false;
    }
  }

  async startFromConfig(
    cwd: unknown,
    name?: unknown,
    sessionId?: unknown,
  ): Promise<JsonObject> {
    if (typeof cwd !== "string") return { error: "A workspace is required" };
    const root = await realpath(path.resolve(cwd)).catch(() => null);
    if (!root) return { error: "The workspace does not exist" };
    const config = await this.readLaunchConfig(root);
    if (!config)
      return {
        error: `No .claude/launch.json found in ${root}`,
      };
    const requested = typeof name === "string" ? name.toLowerCase() : "";
    const selected = requested
      ? config.configurations.find(
          (candidate) => candidate.name.toLowerCase() === requested,
        )
      : config.configurations[0];
    if (!selected)
      return {
        error: `No configured service named ${String(name)}`,
      };
    const existing = [...this.#entries.values()].find(
      (entry) =>
        entry.server.cwd === root &&
        entry.server.name.toLowerCase() === selected.name.toLowerCase() &&
        ["starting", "running"].includes(entry.server.status),
    );
    if (existing)
      return {
        serverId: existing.server.serverId,
        previewId: existing.server.serverId,
        tabId: "default",
      };

    const port =
      selected.autoPort && !(await isPortAvailable(selected.port))
        ? await unusedPort()
        : selected.port;
    if (!(await isPortAvailable(port)))
      return { error: `Port ${port} is already in use` };
    const child = spawn(selected.command, selected.args, {
      cwd: selected.cwd,
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        ...selected.env,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const entry = this.#createEntry({
      name: selected.name,
      cwd: root,
      ...(typeof sessionId === "string" ? { sessionId } : {}),
      port,
      status: "starting",
      initialUrl: `http://127.0.0.1:${port}/`,
      process: child,
    });
    const appendLogs = (chunk: Buffer | string) => {
      for (const line of String(chunk).split(/\r?\n/).filter(Boolean))
        entry.logs.push({ line, timestamp: new Date().toISOString() });
      entry.logs.splice(0, Math.max(0, entry.logs.length - 1000));
    };
    child.stdout?.on("data", appendLogs);
    child.stderr?.on("data", appendLogs);
    child.once("error", (error) => {
      appendLogs(error.message);
      entry.server.status = "error";
      this.#emitChange();
    });
    child.once("exit", (code) => {
      appendLogs(`Process exited with code ${String(code)}`);
      if (entry.server.status !== "stopped") entry.server.status = "stopped";
      this.#emitChange();
    });
    void this.#waitUntilReady(entry);
    return {
      serverId: entry.server.serverId,
      previewId: entry.server.serverId,
      tabId: "default",
    };
  }

  async #waitUntilReady(entry: PreviewEntry): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && entry.server.status === "starting") {
      try {
        const response = await fetch(entry.initialUrl, {
          signal: AbortSignal.timeout(750),
        });
        await response.body?.cancel();
        entry.server.status = "running";
        this.#emitChange();
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (entry.server.status === "starting") {
      entry.server.status = "running";
      this.#emitChange();
    }
  }

  async pickHtmlFile(cwd: unknown): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      defaultPath: typeof cwd === "string" ? cwd : undefined,
      properties: ["openFile"],
      filters: [
        {
          name: "Previewable",
          extensions: [
            "html",
            "htm",
            "svg",
            "png",
            "jpg",
            "jpeg",
            "gif",
            "webp",
            "pdf",
          ],
        },
      ],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  }

  stopServer(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    entry.server.status = "stopped";
    if (entry.process && !entry.process.killed) entry.process.kill();
    this.#emitChange();
    return true;
  }

  destroyPreview(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    this.hidePreview(serverId);
    if (entry.view && !entry.view.webContents.isDestroyed())
      entry.view.webContents.close();
    if (entry.process && !entry.process.killed) entry.process.kill();
    this.#tokens.delete(entry.token);
    this.#entries.delete(entry.server.serverId);
    this.#emitChange();
    return true;
  }

  dispose(): void {
    for (const serverId of [...this.#entries.keys()]) this.destroyPreview(serverId);
    void this.#session.protocol.unhandle("claude-local-launch");
  }
}
