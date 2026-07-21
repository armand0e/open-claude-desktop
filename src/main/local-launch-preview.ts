import { spawn, type ChildProcess } from "node:child_process";
// @ts-expect-error -- untyped CommonJS dependency
import crossSpawn from "cross-spawn";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
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
import { OPEN_CLAUDE_DIRECTORY } from "../shared/open-claude-paths";
import { publicBrowserUrl } from "./local-browser";
import type { LocalCodeSessionManager } from "./local-code";

type JsonObject = Record<string, unknown>;

function samePath(left: string, right: string): boolean {
  const leftPath = path.resolve(left);
  const rightPath = path.resolve(right);
  return process.platform === "win32"
    ? leftPath.toLowerCase() === rightPath.toLowerCase()
    : leftPath === rightPath;
}

async function readVerifiedText(
  filePath: string,
  maxBytes: number,
): Promise<string> {
  const expected = await realpath(filePath);
  if (!samePath(expected, filePath))
    throw new Error("Launch configuration cannot be a symbolic link");
  const descriptor = await open(
    expected,
    constants.O_RDONLY |
      (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
  );
  try {
    const info = await descriptor.stat();
    if (!info.isFile() || info.size > maxBytes)
      throw new Error("Launch configuration exceeds its local safety limit");
    const confirmed = await realpath(expected);
    const confirmedInfo = await stat(confirmed);
    if (
      !samePath(expected, confirmed) ||
      confirmedInfo.dev !== info.dev ||
      confirmedInfo.ino !== info.ino
    )
      throw new Error("Launch configuration changed while being opened");
    const bytes = await descriptor.readFile();
    if (bytes.byteLength > maxBytes)
      throw new Error("Launch configuration exceeds its local safety limit");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally {
    await descriptor.close();
  }
}

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

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
  tabs: Map<string, PreviewTab>;
  activeTabId: string;
  nextTabNumber: number;
  attachedTabId?: string;
  lastBounds?: Rectangle;
  attached: boolean;
  claimantId?: string;
  process?: ChildProcess;
  logs: Array<{ line: string; timestamp: string }>;
  viewport?: { width: number; height: number };
  colorScheme: "light" | "dark" | "system";
  selectionEnabled: boolean;
  selectionGeneration: number;
  browserMode: boolean;
}

interface PreviewTab {
  tabId: string;
  initialUrl: string;
  origin: string;
  title?: string;
  faviconUrl?: string;
  loading: boolean;
  view?: WebContentsView;
}

interface LaunchConfiguration {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  port: number;
  autoPort: boolean;
  env: Record<string, string>;
  program?: string;
}

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
const MAX_LAUNCH_CONFIG_BYTES = 1024 * 1024;
const MAX_CONFIGURATIONS = 32;
const MAX_SCREENSHOT_BASE64 = 4 * 1024 * 1024;
const MAX_BROWSER_TABS = 8;
// The retained renderer classifies this prefix as an in-process HTML preview.
// Other IDs are treated as dev servers or browser sessions and custom-scheme
// origins are consequently shown as missing/uncontrollable.
const HTML_PREVIEW_PREFIX = "html-preview-";
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
  if (
    !values.every((part) => typeof part === "number" && Number.isFinite(part))
  )
    return null;
  return {
    x: Math.min(32_767, Math.max(0, Math.round(candidate.x as number))),
    y: Math.min(32_767, Math.max(0, Math.round(candidate.y as number))),
    width: Math.min(32_768, Math.max(1, Math.round(candidate.width as number))),
    height: Math.min(
      32_768,
      Math.max(1, Math.round(candidate.height as number)),
    ),
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
        url.hostname === "[::1]" ||
        /^127(?:\.\d{1,3}){3}$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}

async function terminateProcessTree(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn(
        "taskkill.exe",
        ["/pid", String(child.pid), "/T", "/F"],
        { windowsHide: true, stdio: "ignore" },
      );
      const timer = setTimeout(() => {
        killer.kill();
        resolve();
      }, 10_000);
      killer.once("error", () => {
        clearTimeout(timer);
        child.kill();
        resolve();
      });
      killer.once("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 && child.exitCode === null && child.signalCode === null)
          child.kill();
        resolve();
      });
    });
  } else if (child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  } else child.kill("SIGTERM");
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      clearTimeout(giveUpTimer);
      child.removeListener("exit", finish);
      resolve();
    };
    const forceTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return finish();
      if (process.platform !== "win32" && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      } else child.kill();
    }, 5_000);
    const giveUpTimer = setTimeout(finish, 10_000);
    forceTimer.unref?.();
    giveUpTimer.unref?.();
    child.once("exit", finish);
    if (child.exitCode !== null || child.signalCode !== null) finish();
  });
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
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" &&
            item.length <= 8_192 &&
            !item.includes("\0"),
        )
        .slice(0, 128)
    : [];
}

function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(objectValue(value))
      .filter(
        (entry): entry is [string, string] =>
          Boolean(entry[0]) &&
          entry[0].length <= 256 &&
          !entry[0].includes("\0") &&
          typeof entry[1] === "string" &&
          entry[1].length <= 32_768 &&
          !entry[1].includes("\0"),
      )
      .slice(0, 256),
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

const CANCEL_ELEMENT_SELECTION_SCRIPT = `(() => {
  const picker = window.__claudeLocalElementPicker;
  if (picker && typeof picker.cancel === "function") picker.cancel();
  return true;
})()`;

const ELEMENT_SELECTION_SCRIPT = `(() => {
  const key = "__claudeLocalElementPicker";
  const previous = window[key];
  if (previous && typeof previous.cancel === "function") previous.cancel();

  return new Promise((resolve) => {
    let finished = false;
    let target = null;
    const host = document.body || document.documentElement;
    const overlay = document.createElement("div");
    const label = document.createElement("div");
    const cursorStyle = document.createElement("style");

    overlay.dataset.claudeLocalElementPicker = "overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      zIndex: "2147483646",
      pointerEvents: "none",
      display: "none",
      boxSizing: "border-box",
      border: "2px solid rgb(217, 119, 87)",
      background: "rgba(217, 119, 87, 0.14)",
      borderRadius: "3px",
      boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.7)",
    });
    Object.assign(label.style, {
      position: "absolute",
      left: "-2px",
      bottom: "calc(100% + 4px)",
      maxWidth: "min(420px, 90vw)",
      overflow: "hidden",
      padding: "4px 7px",
      borderRadius: "4px",
      background: "rgb(35, 33, 31)",
      color: "white",
      font: "12px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.28)",
    });
    cursorStyle.textContent = "* { cursor: crosshair !important; }";
    overlay.appendChild(label);
    host.appendChild(overlay);
    (document.head || document.documentElement).appendChild(cursorStyle);

    const escapeIdentifier = (value) => {
      if (window.CSS && typeof window.CSS.escape === "function")
        return window.CSS.escape(value);
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (character) =>
        "\\\\" + character.charCodeAt(0).toString(16) + " ",
      );
    };
    const selectorSegment = (element) => {
      if (element.id) return "#" + escapeIdentifier(element.id);
      let segment = element.tagName.toLowerCase();
      const classes = Array.from(element.classList || []).filter(Boolean).slice(0, 2);
      if (classes.length)
        segment += classes.map((name) => "." + escapeIdentifier(name)).join("");
      const parent = element.parentElement;
      if (parent) {
        const peers = Array.from(parent.children).filter(
          (candidate) => candidate.tagName === element.tagName,
        );
        if (peers.length > 1)
          segment += ":nth-of-type(" + (peers.indexOf(element) + 1) + ")";
      }
      return segment;
    };
    const selectorFor = (element) => {
      const parts = [];
      let current = element;
      while (current && parts.length < 6) {
        const segment = selectorSegment(current);
        parts.unshift(segment);
        if (segment.startsWith("#") || current === document.body) break;
        current = current.parentElement;
      }
      return parts.join(" > ");
    };
    const elementFromEvent = (event) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      return (
        path.find(
          (candidate) =>
            candidate instanceof Element &&
            candidate !== overlay &&
            !overlay.contains(candidate),
        ) || (event.target instanceof Element ? event.target : null)
      );
    };
    const showTarget = (element) => {
      if (!element || element === overlay || overlay.contains(element)) return;
      target = element;
      const rect = element.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.left = Math.round(rect.left) + "px";
      overlay.style.top = Math.round(rect.top) + "px";
      overlay.style.width = Math.max(1, Math.round(rect.width)) + "px";
      overlay.style.height = Math.max(1, Math.round(rect.height)) + "px";
      label.textContent = selectorFor(element);
      label.style.bottom = rect.top < 34 ? "auto" : "calc(100% + 4px)";
      label.style.top = rect.top < 34 ? "calc(100% + 4px)" : "auto";
    };
    const onMove = (event) => showTarget(elementFromEvent(event));
    const blockPointer = (event) => {
      if (!elementFromEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const cleanup = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("pointerdown", blockPointer, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
      cursorStyle.remove();
      if (window[key]?.finish === finish) delete window[key];
    };
    const finish = (value) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      finish(null);
    };
    const onClick = (event) => {
      const element = elementFromEvent(event) || target;
      if (!element) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const rect = element.getBoundingClientRect();
      const attributes = {};
      for (const attribute of Array.from(element.attributes || []).slice(0, 50))
        attributes[String(attribute.name).slice(0, 64)] = String(attribute.value).slice(0, 512);
      const styleNames = [
        "display", "position", "inset", "top", "right", "bottom", "left",
        "z-index", "box-sizing", "width", "height", "min-width", "min-height",
        "max-width", "max-height", "margin", "padding", "overflow", "opacity",
        "color", "background", "background-color", "background-image",
        "border", "border-color", "border-radius", "box-shadow", "font-family",
        "font-size", "font-style", "font-weight", "line-height", "letter-spacing",
        "text-align", "text-decoration", "text-transform", "white-space",
        "flex", "flex-direction", "flex-wrap", "align-items", "justify-content",
        "gap", "grid-template-columns", "grid-template-rows", "transform",
        "transition", "cursor"
      ];
      const computed = getComputedStyle(element);
      const computedStyles = {};
      for (const name of styleNames) {
        const value = computed.getPropertyValue(name);
        if (value) computedStyles[name] = String(value).slice(0, 256);
      }
      const siblingParts = [
        element.previousElementSibling,
        element.nextElementSibling,
      ]
        .filter((candidate) => candidate && candidate !== overlay)
        .map((candidate) => candidate.outerHTML);
      finish({
        tagName: element.tagName.toLowerCase().slice(0, 32),
        id: element.id ? element.id.slice(0, 128) : undefined,
        classes: Array.from(element.classList || [])
          .slice(0, 50)
          .map((value) => String(value).slice(0, 128)),
        attributes,
        computedStyles,
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        screenshot: "",
        innerText:
          String(element.innerText || element.textContent || "").trim().slice(0, 300) ||
          undefined,
        parentPath: selectorFor(element),
        action: "inspect",
        outerHTML: String(element.outerHTML || "").slice(0, 6000) || undefined,
        siblingHTML: siblingParts.join("\\n").slice(0, 4000) || undefined,
      });
    };

    window[key] = { cancel: () => finish(null), finish };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("pointerdown", blockPointer, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
})()`;

export class LocalLaunchPreview {
  readonly #window: () => BrowserWindow | null;
  readonly #codeSessions: LocalCodeSessionManager;
  readonly #onChange: (servers: readonly LaunchServer[]) => void;
  readonly #onElementSelected: (serverId: string, context: JsonObject) => void;
  readonly #onTabsChanged: (
    serverId: string,
    tabs: readonly JsonObject[],
    activeTabId: string,
  ) => void;
  readonly #onUrlChanged: (serverId: string, url: string) => void;
  readonly #onRevealRequested: (
    serverId: string,
    sessionId: string,
    tabId?: string,
  ) => void;
  readonly #session = electronSession.fromPartition(
    `claude-local-launch-${randomUUID()}`,
  );
  readonly #browserSession = electronSession.fromPartition(
    "persist:open-claude-code-browser",
  );
  readonly #entries = new Map<string, PreviewEntry>();
  readonly #tokens = new Map<string, PreviewEntry>();
  readonly #autoVerify = new Map<string, boolean>();
  readonly #pendingLaunches = new Map<string, Promise<JsonObject>>();
  #configMutationChain = Promise.resolve();
  #disposed = false;

  constructor(
    window: () => BrowserWindow | null,
    codeSessions: LocalCodeSessionManager,
    onChange: (servers: readonly LaunchServer[]) => void,
    onElementSelected: (serverId: string, context: JsonObject) => void,
    onTabsChanged: (
      serverId: string,
      tabs: readonly JsonObject[],
      activeTabId: string,
    ) => void = () => undefined,
    onUrlChanged: (serverId: string, url: string) => void = () => undefined,
    onRevealRequested: (
      serverId: string,
      sessionId: string,
      tabId?: string,
    ) => void = () => undefined,
  ) {
    this.#window = window;
    this.#codeSessions = codeSessions;
    this.#onChange = onChange;
    this.#onElementSelected = onElementSelected;
    this.#onTabsChanged = onTabsChanged;
    this.#onUrlChanged = onUrlChanged;
    this.#onRevealRequested = onRevealRequested;
    this.#session.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = new URL(details.url);
        const owner = this.#entryForWebContents(details.webContentsId);
        const ownerOrigin = owner ? new URL(owner.initialUrl).origin : null;
        const allowed =
          (url.protocol === "claude-local-launch:" &&
            this.#tokens.has(url.hostname) &&
            (!owner || owner.token === url.hostname)) ||
          (isLoopbackUrl(url.toString()) && ownerOrigin === url.origin) ||
          ["data:", "blob:", "about:", "chrome-extension:"].includes(
            url.protocol,
          );
        callback({ cancel: !allowed });
      } catch {
        callback({ cancel: true });
      }
    });
    this.#session.protocol.handle("claude-local-launch", (request) =>
      this.#handle(request),
    );
    this.#browserSession.webRequest.onBeforeRequest((details, callback) => {
      void this.#browserRequestAllowed(details.url)
        .then((allowed) => callback({ cancel: !allowed }))
        .catch(() => callback({ cancel: true }));
    });
  }

  get servers(): readonly LaunchServer[] {
    return [...this.#entries.values()].map((entry) => ({ ...entry.server }));
  }

  #emitChange(): void {
    this.#onChange(this.servers);
  }

  async #handle(request: Request): Promise<Response> {
    try {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, { status: 405 });
      const url = new URL(request.url);
      const entry = this.#tokens.get(url.hostname);
      if (!entry) return new Response("Preview expired", { status: 404 });
      const relative =
        decodeURIComponent(url.pathname.slice(1)) || "index.html";
      if (relative === "index.html" && entry.inlineContent !== undefined) {
        return new Response(
          request.method === "HEAD" ? null : entry.inlineContent,
          {
            headers: {
              "Content-Type": entry.server.filePath
                ?.toLowerCase()
                .endsWith(".svg")
                ? "image/svg+xml; charset=utf-8"
                : "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "Content-Security-Policy":
                "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'none'; frame-src 'self' data: blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }
      const candidate = path.resolve(entry.root, relative);
      if (!isPathInside(entry.root, candidate))
        return new Response("Path outside preview root", { status: 403 });
      const resolved = await realpath(candidate);
      if (!isPathInside(entry.root, resolved))
        return new Response("Path outside preview root", { status: 403 });
      const descriptor = await open(
        resolved,
        constants.O_RDONLY |
          (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
      );
      try {
        const details = await descriptor.stat();
        if (!details.isFile() || details.size > MAX_PREVIEW_BYTES)
          return new Response("Preview file unavailable", { status: 404 });
        const confirmed = await realpath(resolved);
        if (!isPathInside(entry.root, confirmed))
          return new Response("Path outside preview root", { status: 403 });
        const confirmedDetails = await stat(confirmed);
        if (
          confirmedDetails.dev !== details.dev ||
          confirmedDetails.ino !== details.ino
        )
          return new Response("Preview file changed during load", {
            status: 409,
          });
        const content =
          request.method === "HEAD" ? null : await descriptor.readFile();
        if (content && content.byteLength > MAX_PREVIEW_BYTES)
          return new Response("Preview file unavailable", { status: 404 });
        return new Response(content, {
          headers: {
            "Content-Type":
              MIME_TYPES[path.extname(resolved).toLowerCase()] ??
              "application/octet-stream",
            "Cache-Control": "no-store",
            "Cross-Origin-Resource-Policy": "same-origin",
            "Content-Security-Policy":
              "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'none'; frame-src 'self' data: blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
            "X-Content-Type-Options": "nosniff",
            "Content-Length": String(content?.byteLength ?? details.size),
          },
        });
      } finally {
        await descriptor.close();
      }
    } catch {
      return new Response("Preview file unavailable", { status: 404 });
    }
  }

  #entry(serverId: unknown): PreviewEntry | undefined {
    return typeof serverId === "string"
      ? this.#entries.get(serverId)
      : undefined;
  }

  #entryForWebContents(
    webContentsId: number | undefined,
  ): PreviewEntry | undefined {
    if (webContentsId === undefined) return undefined;
    return [...this.#entries.values()].find((entry) =>
      [...entry.tabs.values()].some(
        (tab) => tab.view?.webContents.id === webContentsId,
      ),
    );
  }

  async #browserRequestAllowed(rawUrl: string): Promise<boolean> {
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return false;
    }
    if (
      ["data:", "blob:", "about:", "chrome-extension:"].includes(
        target.protocol,
      )
    )
      return true;
    if (target.username || target.password) return false;
    if (isLoopbackUrl(target.toString())) return true;
    if (target.protocol !== "https:") return false;
    try {
      await publicBrowserUrl(target.toString());
      return true;
    } catch {
      return false;
    }
  }

  #tab(entry: PreviewEntry, tabId?: unknown): PreviewTab | undefined {
    return entry.tabs.get(
      typeof tabId === "string" ? tabId : entry.activeTabId,
    );
  }

  #tabSummary(tab: PreviewTab): JsonObject {
    return {
      tabId: tab.tabId,
      origin: tab.origin,
      toolAccess: "allowed",
      isOrgBlocked: false,
      ...(tab.title ? { title: tab.title } : {}),
      ...(tab.faviconUrl ? { faviconUrl: tab.faviconUrl } : {}),
      loading: tab.loading,
    };
  }

  #emitTabs(entry: PreviewEntry): void {
    this.#onTabsChanged(
      entry.server.serverId,
      [...entry.tabs.values()].map((tab) => this.#tabSummary(tab)),
      entry.activeTabId,
    );
  }

  #emitUrl(entry: PreviewEntry): void {
    const tab = this.#tab(entry);
    this.#onUrlChanged(
      entry.server.serverId,
      tab?.view?.webContents.getURL() || tab?.initialUrl || "",
    );
  }

  #createEntry(input: {
    serverId?: string;
    name: string;
    cwd: string;
    sessionId?: string;
    filePath?: string;
    initialUrl: string;
    inlineContent?: string;
    port?: number;
    status?: LaunchServer["status"];
    process?: ChildProcess;
    browserMode?: boolean;
  }): PreviewEntry {
    if (this.#disposed) throw new Error("Launch preview is shutting down");
    const token = randomUUID();
    const serverId = input.serverId ?? `local-preview-${randomUUID()}`;
    if (this.#entries.has(serverId))
      throw new Error(`Launch preview already exists: ${serverId}`);
    const browserMode = input.browserMode === true;
    const initialTabId = browserMode ? "seed" : "default";
    const initialTabUrl = browserMode ? "about:blank" : input.initialUrl;
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
      tabs: new Map([
        [
          initialTabId,
          {
            tabId: initialTabId,
            initialUrl: initialTabUrl,
            origin: browserMode ? "" : new URL(input.initialUrl).origin,
            loading: false,
          },
        ],
      ]),
      activeTabId: initialTabId,
      nextTabNumber: 1,
      attached: false,
      logs: [],
      colorScheme: "system",
      selectionEnabled: false,
      selectionGeneration: 0,
      browserMode,
    };
    this.#entries.set(serverId, entry);
    this.#tokens.set(token, entry);
    try {
      this.#emitChange();
    } catch (error) {
      this.#entries.delete(serverId);
      this.#tokens.delete(token);
      throw error;
    }
    return entry;
  }

  #ensureView(entry: PreviewEntry, tabId?: unknown): WebContentsView {
    const tab = this.#tab(entry, tabId);
    if (!tab) throw new Error("Preview tab is unavailable");
    if (tab.view && !tab.view.webContents.isDestroyed()) return tab.view;
    const view = new WebContentsView({
      webPreferences: {
        session: entry.browserMode ? this.#browserSession : this.#session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        plugins: true,
      },
    });
    // Workspace output cannot create popups. In browser mode, target=_blank
    // becomes another local tab instead of escaping into the system browser.
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (entry.browserMode) {
        queueMicrotask(() => {
          const opened = this.openPreviewTab(entry.server.serverId);
          if (opened)
            void this.navigatePreview(entry.server.serverId, url, opened);
        });
      }
      return { action: "deny" };
    });
    const protectNavigation = (event: Electron.Event, url: string) => {
      let allowed = false;
      try {
        const target = new URL(url);
        const initial = new URL(tab.initialUrl);
        allowed =
          (target.protocol === "claude-local-launch:" &&
            target.hostname === entry.token) ||
          (isLoopbackUrl(target.toString()) &&
            (entry.browserMode || target.origin === initial.origin)) ||
          (entry.browserMode &&
            target.protocol === "https:" &&
            !target.username &&
            !target.password);
      } catch {
        allowed = false;
      }
      if (!allowed) {
        event.preventDefault();
      }
    };
    view.webContents.on("will-navigate", protectNavigation);
    view.webContents.on("will-redirect", protectNavigation);
    const updateLocation = (_event: Electron.Event, url: string) => {
      try {
        const current = new URL(url);
        tab.initialUrl = current.toString();
        tab.origin = current.protocol === "about:" ? "" : current.origin;
      } catch {
        tab.origin = "";
      }
      if (entry.activeTabId === tab.tabId) this.#emitUrl(entry);
      this.#emitTabs(entry);
    };
    view.webContents.on("did-navigate", updateLocation);
    view.webContents.on("did-navigate-in-page", updateLocation);
    view.webContents.on("did-start-loading", () => {
      tab.loading = true;
      this.#emitTabs(entry);
    });
    view.webContents.on("did-stop-loading", () => {
      tab.loading = false;
      tab.title = view.webContents.getTitle() || undefined;
      this.#emitTabs(entry);
    });
    view.webContents.on("page-title-updated", (_event, title) => {
      tab.title = title || undefined;
      this.#emitTabs(entry);
    });
    view.webContents.on("page-favicon-updated", (_event, favicons) => {
      const favicon = favicons.find((candidate) =>
        candidate.startsWith("data:"),
      );
      tab.faviconUrl = favicon;
      this.#emitTabs(entry);
    });
    view.webContents.on("did-finish-load", () => {
      if (!entry.selectionEnabled || entry.activeTabId !== tab.tabId) return;
      const generation = ++entry.selectionGeneration;
      void this.#runElementSelection(entry, generation);
    });
    tab.view = view;
    return view;
  }

  async #captureSelectedElement(
    entry: PreviewEntry,
    context: JsonObject,
  ): Promise<string> {
    const view = this.#tab(entry)?.view;
    const bounds = rectangle(context.boundingBox);
    if (!view || view.webContents.isDestroyed() || !bounds) return "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 32 * (attempt + 1)));
      try {
        const direct = await view.webContents.capturePage(bounds);
        if (!direct.isEmpty()) {
          const screenshot = direct.toPNG().toString("base64");
          if (screenshot.length <= 2_000_000) return screenshot;
        }
        const page = await view.webContents.capturePage();
        const size = page.getSize();
        if (size.width < 1 || size.height < 1) continue;
        const x = Math.max(0, Math.min(bounds.x, size.width - 1));
        const y = Math.max(0, Math.min(bounds.y, size.height - 1));
        const width = Math.max(
          1,
          Math.min(bounds.width, Math.max(1, size.width - x)),
        );
        const height = Math.max(
          1,
          Math.min(bounds.height, Math.max(1, size.height - y)),
        );
        const cropped = page.crop({ x, y, width, height });
        const screenshot = (cropped.isEmpty() ? page : cropped)
          .toPNG()
          .toString("base64");
        if (screenshot.length <= 2_000_000) return screenshot;
      } catch {
        // A just-finished pointer event can race Chromium's next compositor
        // frame. The second attempt runs after that frame is available.
      }
    }
    return "";
  }

  async #runElementSelection(
    entry: PreviewEntry,
    generation: number,
  ): Promise<void> {
    const view = this.#tab(entry)?.view;
    if (!view || view.webContents.isDestroyed()) return;
    const selected = await view.webContents
      .executeJavaScript(ELEMENT_SELECTION_SCRIPT, true)
      .catch(() => null);
    if (
      !entry.selectionEnabled ||
      entry.selectionGeneration !== generation ||
      !selected ||
      typeof selected !== "object" ||
      Array.isArray(selected)
    )
      return;
    entry.selectionEnabled = false;
    const context = selected as JsonObject;
    context.screenshot = await this.#captureSelectedElement(entry, context);
    this.#onElementSelected(entry.server.serverId, context);
  }

  #setBounds(entry: PreviewEntry, bounds: Rectangle): void {
    const owner = this.#window();
    const view = this.#tab(entry)?.view;
    if (!owner || owner.isDestroyed() || !view) return;
    const [windowWidth, windowHeight] = owner.getContentSize();
    entry.lastBounds = bounds;
    view.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.min(bounds.width, Math.max(1, windowWidth - bounds.x)),
      height: Math.min(bounds.height, Math.max(1, windowHeight - bounds.y)),
    });
    view.setBorderRadius(0);
  }

  async loadHtmlPreview(
    filePath: unknown,
    sessionId?: unknown,
    cwd?: unknown,
  ): Promise<string | null> {
    if (this.#disposed || typeof filePath !== "string") return null;
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
      if (root && canonical && isPathInside(root, canonical))
        resolved = canonical;
    }
    if (this.#disposed || !resolved) return null;
    const details = await stat(resolved).catch(() => null);
    if (!details?.isFile() || details.size > MAX_PREVIEW_BYTES) return null;
    const extension = path.extname(resolved).toLowerCase();
    if (
      ![
        ".html",
        ".htm",
        ".svg",
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
      ].includes(extension)
    )
      return null;
    const root = await realpath(path.dirname(resolved));
    if (this.#disposed) return null;
    const token = randomUUID();
    const entry = this.#createEntry({
      serverId: `${HTML_PREVIEW_PREFIX}${randomUUID()}`,
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
    if (this.#disposed) throw new Error("Launch preview is shutting down");
    if (
      typeof content === "string" &&
      Buffer.byteLength(content, "utf8") > MAX_PREVIEW_BYTES
    )
      throw new Error("Inline preview exceeds the 50 MB limit");
    const root =
      typeof cwd === "string"
        ? await realpath(path.resolve(cwd)).catch(() => path.resolve(cwd))
        : process.cwd();
    if (this.#disposed) throw new Error("Launch preview is shutting down");
    const token = randomUUID();
    const requestedFile =
      typeof filePath === "string" ? path.resolve(root, filePath) : null;
    const safeFile =
      requestedFile && isPathInside(root, requestedFile)
        ? requestedFile
        : path.join(root, isSvg ? "preview.svg" : "preview.html");
    const entry = this.#createEntry({
      serverId: `${HTML_PREVIEW_PREFIX}${randomUUID()}`,
      name:
        typeof filePath === "string" && path.basename(filePath)
          ? path.basename(filePath)
          : "Preview",
      cwd: root,
      ...(typeof sessionId === "string" ? { sessionId } : {}),
      filePath: safeFile,
      initialUrl: localPreviewUrl(token),
      inlineContent: typeof content === "string" ? content : "",
    });
    this.#tokens.delete(entry.token);
    entry.token = token;
    this.#tokens.set(token, entry);
    return entry.server.serverId;
  }

  startBrowserPreview(cwd: unknown, sessionId: unknown): string | null {
    if (this.#disposed || typeof sessionId !== "string") return null;
    if (sessionId.length > 512) return null;
    // The retained Code renderer binds its browser pane to this deterministic
    // id as soon as a local session opens. Matching that desktop contract lets
    // the toolbar open a ready seed tab even before the model uses a browser
    // tool, and lets restored sessions reconnect to the same pane.
    const serverId = `preview-${sessionId}`;
    const existing = this.#entries.get(serverId);
    if (existing) return existing.browserMode ? serverId : null;
    if (typeof cwd !== "string" || !cwd || cwd.length > 32_768) return null;
    const token = randomUUID();
    const entry = this.#createEntry({
      serverId,
      name: "Browser",
      cwd: path.resolve(cwd),
      sessionId,
      initialUrl: localPreviewUrl(token),
      inlineContent:
        "<!doctype html><meta charset=utf-8><style>html{color-scheme:light dark}body{font:14px system-ui;margin:0}</style>",
      browserMode: true,
    });
    this.#tokens.delete(entry.token);
    entry.token = token;
    this.#tokens.set(token, entry);
    return entry.server.serverId;
  }

  ensureCodeBrowser(sessionId: string, cwd: string): string | null {
    return this.startBrowserPreview(cwd, sessionId);
  }

  async loadArtifactPreview(
    pageUrl: unknown,
    cwd: unknown,
    sessionId: unknown,
  ): Promise<string | null> {
    if (this.#disposed || typeof pageUrl !== "string") return null;
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
    if (this.#disposed || !artifact || typeof artifact.content !== "string")
      return null;
    const type =
      typeof artifact.type === "string" ? artifact.type : "text/plain";
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
    if (claimant && entry.claimantId && claimant !== entry.claimantId)
      return false;
    const owner = this.#window();
    if (!owner || owner.isDestroyed()) return false;
    const view = this.#ensureView(entry);
    const tab = this.#tab(entry);
    if (!tab) return false;
    entry.claimantId = claimant;
    if (entry.attached && entry.attachedTabId !== tab.tabId) {
      const attached = this.#tab(entry, entry.attachedTabId)?.view;
      attached?.setVisible(false);
      if (attached) owner.contentView.removeChildView(attached);
      entry.attached = false;
      delete entry.attachedTabId;
    }
    if (!entry.attached) {
      owner.contentView.addChildView(view);
      entry.attached = true;
      entry.attachedTabId = tab.tabId;
    }
    this.#setBounds(entry, bounds);
    view.setVisible(true);
    if (!view.webContents.getURL())
      void view.webContents.loadURL(tab.initialUrl).catch(() => undefined);
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
    const attached = this.#tab(entry, entry.attachedTabId)?.view;
    entry.selectionEnabled = false;
    entry.selectionGeneration += 1;
    if (attached && !attached.webContents.isDestroyed())
      void attached.webContents
        .executeJavaScript(CANCEL_ELEMENT_SELECTION_SCRIPT, true)
        .catch(() => undefined);
    attached?.setVisible(false);
    if (owner && !owner.isDestroyed() && attached && entry.attached) {
      owner.contentView.removeChildView(attached);
      entry.attached = false;
    }
    delete entry.attachedTabId;
    entry.claimantId = undefined;
    return true;
  }

  focusPreview(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    const view = entry ? this.#tab(entry)?.view : undefined;
    if (!view) return false;
    view.webContents.focus();
    return true;
  }

  getPreviewUrl(serverId: unknown): string | null {
    const entry = this.#entry(serverId);
    const tab = entry ? this.#tab(entry) : undefined;
    return tab?.view?.webContents.getURL() || tab?.initialUrl || null;
  }

  getPreviewNavState(serverId: unknown, tabId?: unknown): JsonObject | null {
    const entry = this.#entry(serverId);
    if (!entry) return null;
    const tab = this.#tab(entry, tabId);
    if (!tab) return null;
    const contents = tab.view?.webContents;
    return {
      url: contents?.getURL() || tab.initialUrl,
      canGoBack: contents?.navigationHistory.canGoBack() ?? false,
      canGoForward: contents?.navigationHistory.canGoForward() ?? false,
      isLoading: contents?.isLoading() ?? tab.loading,
    };
  }

  async navigatePreview(
    serverId: unknown,
    rawUrl: unknown,
    tabId?: unknown,
  ): Promise<boolean> {
    const entry = this.#entry(serverId);
    if (this.#disposed || !entry || typeof rawUrl !== "string") return false;
    const tab = this.#tab(entry, tabId);
    if (!tab) return false;
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return false;
    }
    const isOwnPreview =
      target.protocol === "claude-local-launch:" &&
      target.hostname === entry.token;
    const initial = new URL(tab.initialUrl);
    const isAllowedLoopback =
      isLoopbackUrl(target.toString()) &&
      target.protocol !== "claude-local-launch:" &&
      (entry.browserMode || target.origin === initial.origin);
    let isAllowedPublic = false;
    if (
      entry.browserMode &&
      target.protocol === "https:" &&
      !target.username &&
      !target.password
    ) {
      isAllowedPublic = await publicBrowserUrl(target.toString())
        .then(() => true)
        .catch(() => false);
    }
    if (!isOwnPreview && !isAllowedLoopback && !isAllowedPublic) return false;
    const previousInitialUrl = tab.initialUrl;
    tab.initialUrl = target.toString();
    const view = this.#ensureView(entry, tab.tabId);
    try {
      await view.webContents.loadURL(target.toString());
      return true;
    } catch {
      tab.initialUrl = previousInitialUrl;
      return false;
    }
  }

  goBack(serverId: unknown, tabId?: unknown): boolean {
    const entry = this.#entry(serverId);
    const contents = entry
      ? this.#tab(entry, tabId)?.view?.webContents
      : undefined;
    if (!contents?.navigationHistory.canGoBack()) return false;
    contents.navigationHistory.goBack();
    return true;
  }

  goForward(serverId: unknown, tabId?: unknown): boolean {
    const entry = this.#entry(serverId);
    const contents = entry
      ? this.#tab(entry, tabId)?.view?.webContents
      : undefined;
    if (!contents?.navigationHistory.canGoForward()) return false;
    contents.navigationHistory.goForward();
    return true;
  }

  refreshPreview(serverId: unknown, tabId?: unknown): boolean {
    const entry = this.#entry(serverId);
    const contents = entry
      ? this.#tab(entry, tabId)?.view?.webContents
      : undefined;
    if (!contents) return false;
    contents.reload();
    return true;
  }

  toggleSelectionMode(
    serverId: unknown,
    enabled: unknown,
    tabId?: unknown,
  ): boolean {
    const entry = this.#entry(serverId);
    if (!entry || typeof enabled !== "boolean") return false;
    if (typeof tabId === "string" && !this.setActivePreviewTab(serverId, tabId))
      return false;
    const view = this.#ensureView(entry, tabId);
    entry.selectionEnabled = enabled;
    const generation = ++entry.selectionGeneration;
    if (!enabled) {
      void view.webContents
        .executeJavaScript(CANCEL_ELEMENT_SELECTION_SCRIPT, true)
        .catch(() => undefined);
      return true;
    }
    void this.#runElementSelection(entry, generation);
    return true;
  }

  async capturePreviewScreenshot(
    serverId: unknown,
    tabId?: unknown,
  ): Promise<string | null> {
    const entry = this.#entry(serverId);
    const contents = entry
      ? this.#tab(entry, tabId)?.view?.webContents
      : undefined;
    if (!contents) return null;
    // A freshly attached WebContentsView can briefly have no compositor
    // frame on Windows even after did-finish-load. Retry that narrow race so
    // both the toolbar capture and the model screenshot tool are reliable.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (attempt > 0)
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
      if (contents.isDestroyed()) return null;
      try {
        const image = await contents.capturePage();
        if (image.isEmpty()) continue;
        const screenshot = image.toPNG().toString("base64");
        return screenshot.length <= MAX_SCREENSHOT_BASE64 ? screenshot : null;
      } catch {
        // A subsequent attempt can acquire the first committed frame.
      }
    }
    return null;
  }

  setPreviewViewport(
    serverId: unknown,
    width: unknown,
    height: unknown,
    _tabId?: unknown,
  ): boolean {
    const entry = this.#entry(serverId);
    if (!entry || typeof width !== "number" || typeof height !== "number")
      return false;
    entry.viewport = {
      width: Math.min(16_384, Math.max(1, Math.round(width))),
      height: Math.min(16_384, Math.max(1, Math.round(height))),
    };
    return true;
  }

  clearPreviewViewport(serverId: unknown, _tabId?: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    delete entry.viewport;
    return true;
  }

  setPreviewColorScheme(
    serverId: unknown,
    scheme: unknown,
    tabId?: unknown,
  ): boolean {
    const entry = this.#entry(serverId);
    if (!entry || !["light", "dark", "system"].includes(String(scheme)))
      return false;
    entry.colorScheme = scheme as PreviewEntry["colorScheme"];
    this.#tab(entry, tabId)?.view?.webContents.send(
      "claude-local-preview-color-scheme",
      scheme,
    );
    return true;
  }

  getPreviewTabs(serverId: unknown): JsonObject {
    const entry = this.#entry(serverId);
    if (!entry) return { tabs: [], activeTabId: "seed" };
    return {
      tabs: [...entry.tabs.values()].map((tab) => this.#tabSummary(tab)),
      activeTabId: entry.activeTabId,
    };
  }

  openPreviewTab(serverId: unknown, _cwd?: unknown): string | null {
    const entry = this.#entry(serverId);
    if (!entry) return null;
    if (!entry.browserMode) return entry.activeTabId;
    if (entry.tabs.size >= MAX_BROWSER_TABS) return null;
    const tabId = `tab-${entry.nextTabNumber++}`;
    entry.tabs.set(tabId, {
      tabId,
      initialUrl: "about:blank",
      origin: "",
      loading: false,
    });
    this.#emitTabs(entry);
    return tabId;
  }

  setActivePreviewTab(serverId: unknown, tabId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry || typeof tabId !== "string" || !entry.tabs.has(tabId))
      return false;
    if (entry.activeTabId === tabId) return true;
    const owner = this.#window();
    const previous = this.#tab(entry, entry.attachedTabId)?.view;
    entry.selectionEnabled = false;
    entry.selectionGeneration += 1;
    entry.activeTabId = tabId;
    if (entry.attached && owner && !owner.isDestroyed()) {
      previous?.setVisible(false);
      if (previous) owner.contentView.removeChildView(previous);
      const next = this.#ensureView(entry, tabId);
      owner.contentView.addChildView(next);
      entry.attachedTabId = tabId;
      if (entry.lastBounds) this.#setBounds(entry, entry.lastBounds);
      next.setVisible(true);
      const tab = this.#tab(entry, tabId);
      if (tab && !next.webContents.getURL())
        void next.webContents.loadURL(tab.initialUrl).catch(() => undefined);
    }
    this.#emitUrl(entry);
    this.#emitTabs(entry);
    return true;
  }

  closePreviewTab(serverId: unknown, tabId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (
      !entry ||
      typeof tabId !== "string" ||
      tabId === "seed" ||
      !entry.tabs.has(tabId)
    )
      return false;
    const ids = [...entry.tabs.keys()];
    const index = ids.indexOf(tabId);
    const tab = entry.tabs.get(tabId);
    if (entry.activeTabId === tabId) {
      const replacement = ids[index - 1] ?? ids[index + 1] ?? "seed";
      this.setActivePreviewTab(serverId, replacement);
    }
    if (entry.attachedTabId === tabId) {
      const owner = this.#window();
      if (owner && !owner.isDestroyed() && tab?.view)
        owner.contentView.removeChildView(tab.view);
      delete entry.attachedTabId;
      entry.attached = false;
    }
    if (tab?.view && !tab.view.webContents.isDestroyed())
      tab.view.webContents.close();
    entry.tabs.delete(tabId);
    this.#emitTabs(entry);
    return true;
  }

  closeAllPreviewTabs(serverId: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    for (const tabId of [...entry.tabs.keys()]) {
      if (tabId !== "seed") this.closePreviewTab(serverId, tabId);
    }
    if (entry.tabs.has("seed")) {
      const seed = entry.tabs.get("seed")!;
      if (seed.view && !seed.view.webContents.isDestroyed())
        void seed.view.webContents
          .loadURL("about:blank")
          .catch(() => undefined);
      seed.initialUrl = "about:blank";
      seed.origin = "";
      seed.title = undefined;
      entry.activeTabId = "seed";
      this.#emitUrl(entry);
      this.#emitTabs(entry);
    }
    return true;
  }

  async executeCodeBrowserTool(
    sessionId: string,
    cwd: string,
    name: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<string> {
    if (signal.aborted) throw new Error("Browser action was cancelled");
    let entry = [...this.#entries.values()].find(
      (candidate) =>
        candidate.browserMode && candidate.server.sessionId === sessionId,
    );
    if (!entry) {
      const serverId = this.startBrowserPreview(cwd, sessionId);
      entry = serverId ? this.#entry(serverId) : undefined;
    }
    if (!entry) throw new Error("Could not start the built-in Code browser");

    if (name === "mcp__Claude_Browser__tabs_create") {
      const tabId = this.openPreviewTab(entry.server.serverId, cwd);
      if (!tabId) throw new Error("The built-in browser tab limit was reached");
      this.setActivePreviewTab(entry.server.serverId, tabId);
      const requestedUrl =
        typeof input.url === "string" ? input.url.trim() : "";
      const navOk = requestedUrl
        ? await this.navigatePreview(entry.server.serverId, requestedUrl, tabId)
        : true;
      this.#onRevealRequested(entry.server.serverId, sessionId, tabId);
      return `${JSON.stringify(
        {
          type: "browser",
          serverId: entry.server.serverId,
          tabId,
          reused: false,
          navOk,
        },
        null,
        2,
      )}\n\n${navOk ? "Built-in browser tab ready." : "The tab was created, but the URL was blocked or unavailable."}`;
    }

    const tabId = typeof input.tabId === "string" ? input.tabId : "";
    const tab = this.#tab(entry, tabId);
    if (!tab || !tabId) throw new Error("Unknown built-in browser tab");
    this.setActivePreviewTab(entry.server.serverId, tabId);
    const view = this.#ensureView(entry, tabId);
    if (!view.webContents.getURL())
      await view.webContents.loadURL(tab.initialUrl);
    if (signal.aborted) throw new Error("Browser action was cancelled");

    if (name === "mcp__Claude_Browser__navigate") {
      const url = typeof input.url === "string" ? input.url.trim() : "";
      if (!url) throw new Error("Browser navigate requires a URL");
      const ok = await this.navigatePreview(entry.server.serverId, url, tabId);
      if (!ok) throw new Error("The browser URL was blocked or unavailable");
      return JSON.stringify({
        ok: true,
        tabId,
        url: this.getPreviewUrl(entry.server.serverId),
      });
    }

    if (name === "mcp__Claude_Browser__read_page") {
      const page = await view.webContents.executeJavaScript(
        `(() => ({ title: document.title, url: location.href, text: String(document.body?.innerText || document.documentElement?.innerText || "").slice(0, 50000) }))()`,
        true,
      );
      return JSON.stringify(page);
    }

    if (name === "mcp__Claude_Browser__click") {
      const selector =
        typeof input.selector === "string"
          ? input.selector.slice(0, 4_096)
          : "";
      const visibleText =
        typeof input.text === "string" ? input.text.slice(0, 4_096) : "";
      if (!selector && !visibleText)
        throw new Error("Browser click requires selector or text");
      const result = await view.webContents.executeJavaScript(
        `(({ selector, visibleText }) => {
          let element = null;
          if (selector) element = document.querySelector(selector);
          if (!element && visibleText) {
            const candidates = document.querySelectorAll("a,button,input,[role=button],[role=link],summary,label");
            element = [...candidates].find((candidate) => String(candidate.innerText || candidate.value || candidate.textContent || "").trim().includes(visibleText)) || null;
          }
          if (!(element instanceof HTMLElement)) throw new Error("Element not found");
          element.scrollIntoView({ block: "center", inline: "center" });
          element.click();
          return { ok: true, tag: element.tagName.toLowerCase(), text: String(element.innerText || element.textContent || "").trim().slice(0, 500) };
        })(${JSON.stringify({ selector, visibleText })})`,
        true,
      );
      return JSON.stringify(result);
    }

    if (name === "mcp__Claude_Browser__type") {
      const selector =
        typeof input.selector === "string"
          ? input.selector.slice(0, 4_096)
          : "";
      const value =
        typeof input.text === "string" ? input.text.slice(0, 1024 * 1024) : "";
      if (!selector) throw new Error("Browser type requires a selector");
      const result = await view.webContents.executeJavaScript(
        `(({ selector, value, submit }) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLElement && element.isContentEditable)) throw new Error("Editable element not found");
          element.focus();
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) element.value = value;
          else element.textContent = value;
          element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          if (submit) {
            const form = element.closest("form");
            if (form instanceof HTMLFormElement) form.requestSubmit();
            else element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
          }
          return { ok: true, submitted: Boolean(submit) };
        })(${JSON.stringify({ selector, value, submit: input.submit === true })})`,
        true,
      );
      return JSON.stringify(result);
    }

    if (name === "mcp__Claude_Browser__screenshot") {
      const screenshot = await this.capturePreviewScreenshot(
        entry.server.serverId,
        tabId,
      );
      if (!screenshot) throw new Error("Could not capture the browser tab");
      return JSON.stringify({
        ok: true,
        tabId,
        mimeType: "image/png",
        bytes: Buffer.byteLength(screenshot, "base64"),
        ...(screenshot.length <= 512_000 ? { base64: screenshot } : {}),
      });
    }

    throw new Error(`Unknown built-in browser tool: ${name}`);
  }

  async openPreviewInBrowser(
    serverId: unknown,
    tabId?: unknown,
  ): Promise<boolean> {
    const entry = this.#entry(serverId);
    const tab = entry ? this.#tab(entry, tabId) : undefined;
    const url = tab?.view?.webContents.getURL() || tab?.initialUrl || null;
    if (!url) return false;
    if (url.startsWith("claude-local-launch:")) {
      const filePath = entry?.server.filePath;
      if (!filePath) return false;
      return (await shell.openPath(filePath)) === "";
    }
    if (!isLoopbackUrl(url)) {
      const target = await publicBrowserUrl(url).catch(() => null);
      if (!target || target.protocol !== "https:") return false;
    }
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
    const configPath = path.join(cwd, OPEN_CLAUDE_DIRECTORY, "launch.json");
    let parsed: JsonObject;
    try {
      const canonicalRoot = await realpath(cwd);
      const linkInfo = await lstat(configPath);
      if (!linkInfo.isFile() || linkInfo.isSymbolicLink()) return null;
      const canonicalConfig = await realpath(configPath);
      if (!isPathInside(canonicalRoot, canonicalConfig)) return null;
      const source = await readVerifiedText(
        canonicalConfig,
        MAX_LAUNCH_CONFIG_BYTES,
      );
      parsed = objectValue(JSON.parse(source));
    } catch {
      return null;
    }
    if (!Array.isArray(parsed.configurations)) return null;
    const configurations = parsed.configurations
      .slice(0, MAX_CONFIGURATIONS)
      .flatMap((value): LaunchConfiguration[] => {
        const item = objectValue(value);
        const rawProgram =
          typeof item.program === "string" &&
          item.program.length <= 8_192 &&
          !item.program.includes("\0")
            ? item.program
                .replaceAll("${workspaceFolder}", cwd)
                .replaceAll("${workspaceRoot}", cwd)
            : "";
        const program = rawProgram ? path.resolve(cwd, rawProgram) : "";
        if (program && !isPathInside(cwd, program)) return [];
        if (
          typeof item.runtimeExecutable === "string" &&
          (item.runtimeExecutable.length > 8_192 ||
            item.runtimeExecutable.includes("\0"))
        )
          return [];
        const runtimeExecutable =
          typeof item.runtimeExecutable === "string"
            ? item.runtimeExecutable
            : "";
        const executable =
          runtimeExecutable || (program ? process.execPath : "");
        if (!executable) return [];
        const args = [
          ...stringArray(item.runtimeArgs),
          ...(runtimeExecutable || !program ? [] : [program]),
          ...stringArray(item.args),
        ].map((part) =>
          part
            .replaceAll("${workspaceFolder}", cwd)
            .replaceAll("${workspaceRoot}", cwd),
        );
        if (
          typeof item.cwd === "string" &&
          (item.cwd.length > 32_768 || item.cwd.includes("\0"))
        )
          return [];
        const requestedCwd =
          typeof item.cwd === "string" &&
          item.cwd.length <= 32_768 &&
          !item.cwd.includes("\0")
            ? item.cwd
                .replaceAll("${workspaceFolder}", cwd)
                .replaceAll("${workspaceRoot}", cwd)
            : cwd;
        const resolvedCwd = path.resolve(cwd, requestedCwd);
        if (!isPathInside(cwd, resolvedCwd)) return [];
        const requestedPort =
          typeof item.port === "number" && Number.isInteger(item.port)
            ? item.port
            : Number(stringRecord(item.env).PORT) || 3000;
        const port =
          requestedPort >= 1 && requestedPort <= 65_535 ? requestedPort : 3000;
        return [
          {
            name:
              typeof item.name === "string" && item.name.trim()
                ? item.name.trim().slice(0, 128)
                : path.basename(String(item.program ?? executable)),
            command: executable
              .replaceAll("${workspaceFolder}", cwd)
              .replaceAll("${workspaceRoot}", cwd),
            args,
            cwd: resolvedCwd,
            port,
            autoPort: item.autoPort === true,
            env: stringRecord(item.env),
            ...(program ? { program } : {}),
          },
        ];
      });
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
    const operation = this.#configMutationChain
      .catch(() => undefined)
      .then(async () => {
        const requestedRoot = path.resolve(cwd);
        try {
          const resolved = await realpath(requestedRoot);
          const configPath = path.join(
            resolved,
            OPEN_CLAUDE_DIRECTORY,
            "launch.json",
          );
          const linkInfo = await lstat(configPath);
          if (!linkInfo.isFile() || linkInfo.isSymbolicLink()) return false;
          const canonicalConfig = await realpath(configPath);
          if (!isPathInside(resolved, canonicalConfig)) return false;
          const source = await readVerifiedText(
            canonicalConfig,
            MAX_LAUNCH_CONFIG_BYTES,
          );
          const expectedHash = contentHash(source);
          const parsed = objectValue(JSON.parse(source));
          parsed.autoVerify = enabled;
          const serialized = `${JSON.stringify(parsed, null, 2)}\n`;
          if (Buffer.byteLength(serialized, "utf8") > MAX_LAUNCH_CONFIG_BYTES)
            return false;
          const temporary = `${canonicalConfig}.${randomUUID()}.tmp`;
          try {
            await writeFile(temporary, serialized, {
              encoding: "utf8",
              flag: "wx",
              mode: 0o600,
            });
            const current = await readVerifiedText(
              canonicalConfig,
              MAX_LAUNCH_CONFIG_BYTES,
            );
            if (contentHash(current) !== expectedHash) return false;
            await rename(temporary, canonicalConfig);
          } finally {
            await rm(temporary, { force: true }).catch(() => undefined);
          }
          this.#autoVerify.set(resolved, enabled);
          return true;
        } catch {
          return false;
        }
      });
    this.#configMutationChain = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async startFromConfig(
    cwd: unknown,
    name?: unknown,
    sessionId?: unknown,
  ): Promise<JsonObject> {
    if (this.#disposed) return { error: "Launch preview is shutting down" };
    if (typeof cwd !== "string") return { error: "A workspace is required" };
    const root = await realpath(path.resolve(cwd)).catch(() => null);
    if (!root) return { error: "The workspace does not exist" };
    const config = await this.readLaunchConfig(root);
    if (!config)
      return {
        error: `No ${OPEN_CLAUDE_DIRECTORY}/launch.json found in ${root}`,
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
    const selectedCwd = await realpath(selected.cwd).catch(() => null);
    const selectedCwdInfo = selectedCwd
      ? await stat(selectedCwd).catch(() => null)
      : null;
    if (
      !selectedCwd ||
      !selectedCwdInfo?.isDirectory() ||
      !isPathInside(root, selectedCwd)
    )
      return { error: "Configured working directory leaves the workspace" };
    let launchArgs = selected.args;
    if (selected.program) {
      const canonicalProgram = await realpath(selected.program).catch(
        () => null,
      );
      const programInfo = canonicalProgram
        ? await stat(canonicalProgram).catch(() => null)
        : null;
      if (
        !canonicalProgram ||
        !programInfo?.isFile() ||
        !isPathInside(root, canonicalProgram)
      )
        return { error: "Configured program leaves the workspace" };
      launchArgs = selected.args.map((argument) =>
        argument === selected.program ? canonicalProgram : argument,
      );
    }
    const launchKey = `${root}\0${selected.name.toLowerCase()}`;
    const pending = this.#pendingLaunches.get(launchKey);
    if (pending) return pending;
    const operation = this.#startConfiguredService(
      root,
      selected,
      selectedCwd,
      launchArgs,
      sessionId,
    );
    this.#pendingLaunches.set(launchKey, operation);
    try {
      return await operation;
    } finally {
      if (this.#pendingLaunches.get(launchKey) === operation)
        this.#pendingLaunches.delete(launchKey);
    }
  }

  async #startConfiguredService(
    root: string,
    selected: LaunchConfiguration,
    selectedCwd: string,
    launchArgs: string[],
    sessionId: unknown,
  ): Promise<JsonObject> {
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
    if (this.#disposed) return { error: "Launch preview is shutting down" };
    if (
      [...this.#entries.values()].some(
        (entry) =>
          entry.server.port === port &&
          ["starting", "running"].includes(entry.server.status),
      )
    )
      return { error: `Port ${port} is already in use` };
    const child = crossSpawn(selected.command, launchArgs, {
      cwd: selectedCwd,
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        ...selected.env,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }) as ChildProcess;
    let entry: PreviewEntry;
    try {
      entry = this.#createEntry({
        name: selected.name,
        cwd: root,
        ...(typeof sessionId === "string" ? { sessionId } : {}),
        port,
        status: "starting",
        initialUrl: `http://127.0.0.1:${port}/`,
        process: child,
      });
    } catch (error) {
      await terminateProcessTree(child);
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
      if (this.#entries.has(entry.server.serverId)) this.#emitChange();
    });
    child.once("exit", (code) => {
      appendLogs(`Process exited with code ${String(code)}`);
      if (entry.server.status !== "stopped") entry.server.status = "stopped";
      if (this.#entries.has(entry.server.serverId)) this.#emitChange();
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
    while (
      !this.#disposed &&
      this.#entries.has(entry.server.serverId) &&
      Date.now() < deadline &&
      entry.server.status === "starting"
    ) {
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
    if (
      !this.#disposed &&
      this.#entries.has(entry.server.serverId) &&
      entry.server.status === "starting"
    ) {
      entry.server.status = "error";
      entry.logs.push({
        line: "Preview server did not become reachable within 20 seconds",
        timestamp: new Date().toISOString(),
      });
      this.#emitChange();
      if (entry.process) void terminateProcessTree(entry.process);
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

  async stopServer(serverId: unknown): Promise<boolean> {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    entry.server.status = "stopped";
    const process = entry.process;
    delete entry.process;
    this.#emitChange();
    if (process) await terminateProcessTree(process);
    return true;
  }

  async destroyPreview(serverId: unknown): Promise<boolean> {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    this.hidePreview(serverId);
    for (const tab of entry.tabs.values()) {
      if (tab.view && !tab.view.webContents.isDestroyed())
        tab.view.webContents.close();
    }
    const process = entry.process;
    delete entry.process;
    this.#tokens.delete(entry.token);
    this.#entries.delete(entry.server.serverId);
    this.#emitChange();
    if (process) await terminateProcessTree(process);
    return true;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.allSettled(
      [...this.#entries.keys()].map((serverId) =>
        this.destroyPreview(serverId),
      ),
    );
    await this.#configMutationChain.catch(() => undefined);
    this.#session.protocol.unhandle("claude-local-launch");
  }
}
