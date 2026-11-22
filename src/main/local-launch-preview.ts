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
  type Session,
} from "electron";
import { isPathInside } from "./file-access";
import { OPEN_CLAUDE_DIRECTORY } from "../shared/open-claude-paths";
import {
  publicBrowserUrl,
  startPublicNetworkProxy,
  type PublicNetworkProxy,
} from "./local-browser";
import type { LocalCodeSessionManager } from "./local-code";
import { diagnosticError, LocalDiagnostics } from "./local-diagnostics";
import { childEnvironment } from "./child-environment";

type JsonObject = Record<string, unknown>;

const ALLOWED_RUNTIME_EXECUTABLES = new Set([
  "bun",
  "bun.exe",
  "cargo",
  "cargo.exe",
  "deno",
  "deno.exe",
  "dotnet",
  "dotnet.exe",
  "go",
  "go.exe",
  "java",
  "java.exe",
  "node",
  "node.exe",
  "npm",
  "npm.cmd",
  "npx",
  "npx.cmd",
  "php",
  "php.exe",
  "pnpm",
  "pnpm.cmd",
  "py",
  "py.exe",
  "python",
  "python.exe",
  "python3",
  "python3.exe",
  "ruby",
  "ruby.exe",
  "uv",
  "uv.exe",
  "yarn",
  "yarn.cmd",
]);

export function isAllowedLaunchRuntime(
  executable: string,
  runsWorkspaceProgram = false,
): boolean {
  const normalized = path.basename(executable).toLowerCase();
  return (
    ALLOWED_RUNTIME_EXECUTABLES.has(normalized) ||
    (runsWorkspaceProgram &&
      path.resolve(executable) === path.resolve(process.execPath))
  );
}

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
  launchSignature?: string;
}

interface PreviewEntry {
  server: LaunchServer;
  token: string;
  root: string;
  initialUrl: string;
  inlineContent?: string;
  artifactId?: string;
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
  consoleLogs: PreviewConsoleLog[];
  rendererCrashes: number[];
  view?: WebContentsView;
}

interface PreviewConsoleLog {
  level: "debug" | "info" | "warning" | "error";
  message: string;
  timestamp: string;
  source?: string;
  line?: number;
  tabId: string;
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
const MAX_BROWSER_CONSOLE_LOGS = 500;
const MAX_BROWSER_ACTION_MS = 15_000;
const MAX_RENDERER_CRASHES_PER_MINUTE = 3;
const ARTIFACT_ID_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PDF_VIEWER_EXTENSION_ID = "mhjfbmdgcfjbbpaeojofohoefgiehjai";
const hardenedPreviewSessions = new WeakSet<Session>();
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

function isSafeEmbeddedScheme(url: URL): boolean {
  return (
    ["data:", "blob:", "about:"].includes(url.protocol) ||
    (url.protocol === "chrome-extension:" &&
      url.hostname === PDF_VIEWER_EXTENSION_ID)
  );
}

function hardenPreviewSession(target: Session): void {
  if (hardenedPreviewSessions.has(target)) return;
  hardenedPreviewSessions.add(target);
  target.setPermissionCheckHandler(() => false);
  target.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  target.on("will-download", (event) => event.preventDefault());
}

async function boundedBrowserAction<T>(
  action: () => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = MAX_BROWSER_ACTION_MS,
  onCancel: (reason: "cancelled" | "timed out") => void = () => undefined,
): Promise<T> {
  if (signal?.aborted) throw new Error("Browser action was cancelled");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () =>
      finish(() => {
        onCancel("cancelled");
        reject(new Error("Browser action was cancelled"));
      });
    const timer = setTimeout(
      () =>
        finish(() => {
          onCancel("timed out");
          reject(new Error("Browser action timed out"));
        }),
      timeoutMs,
    );
    timer.unref?.();
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(action)
      .then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
  });
}

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

function loopbackUrls(port: number): string[] {
  // Dev servers do not agree on their default loopback bind. Vite can bind
  // IPv6-only localhost while many Node/Python servers accept IPv4. Probe both
  // concrete loopback families before the hostname fallback so the browser is
  // given the address that proved reachable.
  return [
    `http://127.0.0.1:${port}/`,
    `http://[::1]:${port}/`,
    `http://localhost:${port}/`,
  ];
}

function loggedLoopbackUrls(
  logs: readonly { line: string; timestamp: string }[],
): string[] {
  const urls: string[] = [];
  for (const { line } of logs.slice(-100)) {
    for (const match of line.matchAll(/https?:\/\/[^\s"'<>]+/giu)) {
      try {
        const url = new URL(match[0]);
        if (isLoopbackUrl(url.toString()) && !url.username && !url.password)
          urls.push(url.toString());
      } catch {
        // Process output is untrusted text. Only successfully parsed,
        // credential-free loopback URLs can expand the readiness probe.
      }
    }
  }
  return urls;
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
    server.listen(0, resolve).once("error", reject),
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
    // Match the default bind used by common Node/Python dev servers. Probing
    // only 127.0.0.1 can report a dual-stack :: listener as available on
    // Windows, then the managed child immediately fails with EADDRINUSE.
    server.listen(port, () => server.close(() => resolve(true)));
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
  readonly #diagnostics?: LocalDiagnostics;
  readonly #session = electronSession.fromPartition(
    `claude-local-launch-${randomUUID()}`,
  );
  readonly #browserSession = electronSession.fromPartition(
    "persist:open-claude-code-browser",
  );
  readonly #entries = new Map<string, PreviewEntry>();
  readonly #tokens = new Map<string, PreviewEntry>();
  readonly #allowedOrigins = new Set<string>();
  readonly #autoVerify = new Map<string, boolean>();
  readonly #pendingLaunches = new Map<string, Promise<JsonObject>>();
  readonly #overlaySuspended = new Map<
    string,
    { bounds: Rectangle; claimantId?: string; tabId?: string }
  >();
  #configMutationChain = Promise.resolve();
  #browserProxy: PublicNetworkProxy | null = null;
  #browserProxyPromise: Promise<PublicNetworkProxy> | null = null;
  #disposed = false;
  #rendererOverlayOpen = false;

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
    diagnostics?: LocalDiagnostics,
  ) {
    this.#window = window;
    this.#codeSessions = codeSessions;
    this.#onChange = onChange;
    this.#onElementSelected = onElementSelected;
    this.#onTabsChanged = onTabsChanged;
    this.#onUrlChanged = onUrlChanged;
    this.#onRevealRequested = onRevealRequested;
    this.#diagnostics = diagnostics;
    hardenPreviewSession(this.#session);
    hardenPreviewSession(this.#browserSession);
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
          isSafeEmbeddedScheme(url);
        callback({ cancel: !allowed });
      } catch {
        callback({ cancel: true });
      }
    });
    this.#session.protocol.handle("claude-local-launch", (request) =>
      this.#handle(request),
    );
    this.#browserSession.webRequest.onBeforeRequest((details, callback) => {
      void this.#browserRequestAllowed(details.url, details.webContentsId)
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

  async #ensureBrowserProxy(): Promise<PublicNetworkProxy> {
    if (this.#disposed) throw new Error("Launch preview is shutting down");
    if (this.#browserProxy) return this.#browserProxy;
    if (!this.#browserProxyPromise) {
      this.#browserProxyPromise = (async () => {
        const proxy = await startPublicNetworkProxy(false);
        try {
          if (this.#disposed)
            throw new Error("Launch preview is shutting down");
          await this.#browserSession.setProxy({
            proxyRules: proxy.server,
            proxyBypassRules: "<local>;localhost;*.localhost;127.0.0.0/8;[::1]",
          });
          if (this.#disposed)
            throw new Error("Launch preview is shutting down");
          this.#browserProxy = proxy;
          return proxy;
        } catch (error) {
          await proxy.close().catch(() => undefined);
          throw error;
        }
      })();
    }
    try {
      return await this.#browserProxyPromise;
    } finally {
      this.#browserProxyPromise = null;
    }
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

  async #browserRequestAllowed(
    rawUrl: string,
    _webContentsId?: number,
  ): Promise<boolean> {
    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return false;
    }
    if (isSafeEmbeddedScheme(target)) return true;
    if (target.username || target.password) return false;
    if (isLoopbackUrl(target.toString())) return true;
    if (target.protocol !== "https:") return false;
    // The retained origin list is compatibility metadata, not a network-safety
    // bypass. Re-resolve every public request so a hostname cannot become
    // private via DNS rebinding after it was added to that list.
    try {
      await publicBrowserUrl(target.toString());
      await this.#ensureBrowserProxy();
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
    artifactId?: string;
    port?: number;
    status?: LaunchServer["status"];
    process?: ChildProcess;
    browserMode?: boolean;
    launchSignature?: string;
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
        ...(input.launchSignature
          ? { launchSignature: input.launchSignature }
          : {}),
      },
      token,
      root: input.cwd,
      initialUrl: input.initialUrl,
      ...(input.inlineContent !== undefined
        ? { inlineContent: input.inlineContent }
        : {}),
      ...(input.artifactId ? { artifactId: input.artifactId } : {}),
      ...(input.process ? { process: input.process } : {}),
      tabs: new Map([
        [
          initialTabId,
          {
            tabId: initialTabId,
            initialUrl: initialTabUrl,
            origin: browserMode ? "" : new URL(input.initialUrl).origin,
            loading: false,
            consoleLogs: [],
            rendererCrashes: [],
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

  #recordConsole(
    tab: PreviewTab,
    level: PreviewConsoleLog["level"],
    message: unknown,
    source?: unknown,
    line?: unknown,
  ): void {
    tab.consoleLogs.push({
      level,
      message: String(message).slice(0, 20_000),
      timestamp: new Date().toISOString(),
      tabId: tab.tabId,
      ...(typeof source === "string" && source ? { source } : {}),
      ...(typeof line === "number" && Number.isFinite(line)
        ? { line: Math.max(0, Math.round(line)) }
        : {}),
    });
    if (tab.consoleLogs.length > MAX_BROWSER_CONSOLE_LOGS)
      tab.consoleLogs.splice(
        0,
        tab.consoleLogs.length - MAX_BROWSER_CONSOLE_LOGS,
      );
  }

  async #debuggerCommand(
    contents: Electron.WebContents,
    method: string,
    parameters: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (contents.isDestroyed()) throw new Error("Browser tab is unavailable");
    const browserDebugger = contents.debugger;
    if (!browserDebugger.isAttached()) browserDebugger.attach("1.3");
    return boundedBrowserAction(
      () => browserDebugger.sendCommand(method, parameters),
      signal,
      MAX_BROWSER_ACTION_MS,
      () => {
        try {
          if (browserDebugger.isAttached()) browserDebugger.detach();
        } catch {
          // The renderer may have exited while the command was pending.
        }
      },
    );
  }

  async #executeJavaScript(
    contents: Electron.WebContents,
    script: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (contents.isDestroyed()) throw new Error("Browser tab is unavailable");
    return boundedBrowserAction(
      () => contents.executeJavaScript(script, true),
      signal,
      MAX_BROWSER_ACTION_MS,
      (reason) => {
        contents.stop();
        if (reason === "timed out") contents.forcefullyCrashRenderer();
      },
    );
  }

  async #applyBrowserEmulation(
    entry: PreviewEntry,
    tab: PreviewTab,
  ): Promise<void> {
    const contents = tab.view?.webContents;
    if (!contents || contents.isDestroyed()) return;
    try {
      if (entry.viewport) {
        await this.#debuggerCommand(
          contents,
          "Emulation.setDeviceMetricsOverride",
          {
            width: entry.viewport.width,
            height: entry.viewport.height,
            deviceScaleFactor: 1,
            mobile: false,
          },
        );
      } else {
        await this.#debuggerCommand(
          contents,
          "Emulation.clearDeviceMetricsOverride",
        );
      }
      await this.#debuggerCommand(contents, "Emulation.setEmulatedMedia", {
        features:
          entry.colorScheme === "system"
            ? []
            : [
                {
                  name: "prefers-color-scheme",
                  value: entry.colorScheme,
                },
              ],
      });
    } catch (error) {
      this.#recordConsole(
        tab,
        "warning",
        `Browser emulation update failed: ${String(error)}`,
      );
    }
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
    view.webContents.on("will-attach-webview", (event) =>
      event.preventDefault(),
    );
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
    view.webContents.on(
      "console-message",
      (_event, level, message, line, sourceId) => {
        const normalizedLevel: PreviewConsoleLog["level"] =
          level >= 3
            ? "error"
            : level === 2
              ? "warning"
              : level === 1
                ? "info"
                : "debug";
        this.#recordConsole(tab, normalizedLevel, message, sourceId, line);
        this.#diagnostics?.record(
          "preview",
          "console",
          {
            serverId: entry.server.serverId,
            tabId: tab.tabId,
            level: normalizedLevel,
            sourceId,
            line,
            messageLength: message.length,
          },
          normalizedLevel === "error"
            ? "error"
            : normalizedLevel === "warning"
              ? "warn"
              : "debug",
        );
      },
    );
    view.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
        if (isMainFrame === false) return;
        tab.loading = false;
        this.#recordConsole(
          tab,
          "error",
          `Navigation failed (${errorCode}): ${errorDescription}`,
          validatedUrl,
        );
        this.#diagnostics?.record(
          "preview",
          "navigation.failed",
          {
            serverId: entry.server.serverId,
            tabId: tab.tabId,
            errorCode,
            errorDescription,
            url: validatedUrl,
          },
          "error",
        );
        this.#emitTabs(entry);
      },
    );
    view.webContents.on("render-process-gone", (_event, details) => {
      tab.loading = false;
      this.#recordConsole(
        tab,
        "error",
        `Browser renderer exited: ${details.reason}`,
      );
      this.#diagnostics?.record(
        "preview",
        "renderer.gone",
        {
          serverId: entry.server.serverId,
          tabId: tab.tabId,
          reason: details.reason,
          exitCode: details.exitCode,
        },
        "error",
      );
      if (tab.view === view) tab.view = undefined;
      const owner = this.#window();
      if (owner && !owner.isDestroyed() && entry.attachedTabId === tab.tabId) {
        try {
          owner.contentView.removeChildView(view);
        } catch {
          // Chromium may already have detached the crashed view.
        }
        entry.attached = false;
        delete entry.attachedTabId;
      }
      const now = Date.now();
      tab.rendererCrashes = tab.rendererCrashes.filter(
        (timestamp) => now - timestamp < 60_000,
      );
      tab.rendererCrashes.push(now);
      if (tab.rendererCrashes.length > MAX_RENDERER_CRASHES_PER_MINUTE) {
        this.#recordConsole(
          tab,
          "error",
          "Automatic preview recovery paused after repeated renderer crashes",
        );
        this.#emitTabs(entry);
        return;
      }
      queueMicrotask(() => {
        if (this.#disposed || !this.#entries.has(entry.server.serverId)) return;
        try {
          const replacement = this.#ensureView(entry, tab.tabId);
          if (
            owner &&
            !owner.isDestroyed() &&
            entry.activeTabId === tab.tabId
          ) {
            owner.contentView.addChildView(replacement);
            entry.attached = true;
            entry.attachedTabId = tab.tabId;
            if (entry.lastBounds) this.#setBounds(entry, entry.lastBounds);
            replacement.setVisible(true);
          }
          void replacement.webContents
            .loadURL(tab.initialUrl)
            .catch((error) =>
              this.#recordConsole(tab, "error", String(error), tab.initialUrl),
            );
        } catch (error) {
          this.#recordConsole(tab, "error", String(error));
        }
      });
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
      void this.#applyBrowserEmulation(entry, tab);
      if (!entry.selectionEnabled || entry.activeTabId !== tab.tabId) return;
      const generation = ++entry.selectionGeneration;
      void this.#runElementSelection(entry, generation);
    });
    tab.view = view;
    void this.#applyBrowserEmulation(entry, tab);
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
    const selected = await this.#executeJavaScript(
      view.webContents,
      ELEMENT_SELECTION_SCRIPT,
    ).catch(() => null);
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
    const previous = entry.lastBounds;
    const resolved = { ...bounds };
    if (resolved.width <= 1) {
      if (previous && previous.width > 1) {
        resolved.x = previous.x;
        resolved.width = previous.width;
      } else {
        resolved.x = Math.min(
          resolved.x,
          Math.max(0, windowWidth - Math.min(480, windowWidth)),
        );
        resolved.width = Math.max(1, windowWidth - resolved.x);
      }
    }
    if (resolved.height <= 1) {
      if (previous && previous.height > 1) {
        resolved.y = previous.y;
        resolved.height = previous.height;
      } else {
        resolved.y = Math.min(
          resolved.y,
          Math.max(0, windowHeight - Math.min(360, windowHeight)),
        );
        resolved.height = Math.max(1, windowHeight - resolved.y);
      }
    }
    resolved.x = Math.min(resolved.x, Math.max(0, windowWidth - 1));
    resolved.y = Math.min(resolved.y, Math.max(0, windowHeight - 1));
    resolved.width = Math.min(
      resolved.width,
      Math.max(1, windowWidth - resolved.x),
    );
    resolved.height = Math.min(
      resolved.height,
      Math.max(1, windowHeight - resolved.y),
    );
    entry.lastBounds = resolved;
    view.setBounds(resolved);
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
    artifactId?: unknown,
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
      ...(typeof artifactId === "string" ? { artifactId } : {}),
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
      const target = new URL(pageUrl, "app://localhost");
      if (target.protocol !== "app:" || target.hostname !== "localhost")
        return null;
      id = target.pathname.match(
        new RegExp(`^/code/artifact/(${ARTIFACT_ID_SOURCE})$`, "i"),
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
      id.toLowerCase(),
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
    if (this.#rendererOverlayOpen) {
      entry.lastBounds = bounds;
      entry.claimantId = claimant;
      this.#overlaySuspended.set(entry.server.serverId, {
        bounds,
        ...(claimant ? { claimantId: claimant } : {}),
        ...(entry.activeTabId ? { tabId: entry.activeTabId } : {}),
      });
      return true;
    }
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
    this.#overlaySuspended.delete(entry.server.serverId);
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

  // Chromium popovers are rendered by the main renderer, underneath native
  // WebContentsViews. Temporarily detach attached previews while a menu or
  // listbox is open so artifact toolbar controls remain visible and clickable.
  setNativePreviewOverlayOpen(open: unknown): number {
    if (typeof open !== "boolean" || this.#rendererOverlayOpen === open)
      return this.#overlaySuspended.size;
    this.#rendererOverlayOpen = open;
    const owner = this.#window();
    if (!owner || owner.isDestroyed()) return 0;
    if (open) {
      for (const entry of this.#entries.values()) {
        const tabId = entry.attachedTabId;
        const view = this.#tab(entry, tabId)?.view;
        if (!entry.attached || !view || !entry.lastBounds) continue;
        this.#overlaySuspended.set(entry.server.serverId, {
          bounds: entry.lastBounds,
          ...(entry.claimantId ? { claimantId: entry.claimantId } : {}),
          ...(tabId ? { tabId } : {}),
        });
        view.setVisible(false);
        owner.contentView.removeChildView(view);
        entry.attached = false;
        delete entry.attachedTabId;
      }
      return this.#overlaySuspended.size;
    }
    const suspended = [...this.#overlaySuspended.entries()];
    this.#overlaySuspended.clear();
    for (const [serverId, state] of suspended) {
      const entry = this.#entries.get(serverId);
      if (!entry) continue;
      if (state.tabId && entry.tabs.has(state.tabId))
        entry.activeTabId = state.tabId;
      this.showPreview(serverId, state.bounds, state.claimantId);
    }
    return suspended.length;
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
    signal?: AbortSignal,
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
        .then(() => this.#ensureBrowserProxy())
        .then(() => true)
        .catch(() => false);
    }
    if (!isOwnPreview && !isAllowedLoopback && !isAllowedPublic) return false;
    const previousInitialUrl = tab.initialUrl;
    tab.initialUrl = target.toString();
    const view = this.#ensureView(entry, tab.tabId);
    try {
      await boundedBrowserAction(
        () => view.webContents.loadURL(target.toString()),
        signal,
        MAX_BROWSER_ACTION_MS,
        () => view.webContents.stop(),
      );
      return true;
    } catch (error) {
      tab.initialUrl = previousInitialUrl;
      if (signal?.aborted) throw error;
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
    if (entry?.artifactId) {
      void this.#codeSessions
        .invoke("readArtifactById", [entry.artifactId])
        .then((value) => {
          if (!value || typeof value !== "object") return;
          const artifact = value as JsonObject;
          if (typeof artifact.content !== "string") return;
          const type =
            typeof artifact.type === "string" ? artifact.type : "text/plain";
          entry.inlineContent =
            type === "text/html" || type === "image/svg+xml"
              ? artifact.content
              : `<!doctype html><meta charset="utf-8"><style>html{color-scheme:light dark}body{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;font:15px/1.6 ui-sans-serif,system-ui,sans-serif}pre{white-space:pre-wrap;font:13px/1.55 ui-monospace,Consolas,monospace}</style><pre>${escapeHtml(artifact.content)}</pre>`;
          contents.reload();
        })
        .catch((error) => {
          const tab = this.#tab(entry, tabId);
          if (tab)
            this.#recordConsole(
              tab,
              "error",
              `Artifact refresh failed: ${String(error)}`,
            );
        });
      return true;
    }
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
    const tab = entry ? this.#tab(entry, tabId) : undefined;
    const view = tab?.view;
    const contents = view?.webContents;
    if (!contents) return null;
    {
      const owner = this.#window();
      let temporaryAttachment = false;
      if (
        entry &&
        tab &&
        owner &&
        !owner.isDestroyed() &&
        entry.attachedTabId !== tab.tabId
      ) {
        owner.contentView.addChildView(view);
        view.setVisible(true);
        temporaryAttachment = true;
      }
      let temporaryDeviceMetrics = false;
      const originalBounds = view.getBounds();
      let temporaryBounds = false;
      if (originalBounds.width < 1 || originalBounds.height < 1) {
        view.setBounds({
          x: originalBounds.x,
          y: originalBounds.y,
          width: entry?.viewport?.width ?? 1280,
          height: entry?.viewport?.height ?? 720,
        });
        temporaryBounds = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const restoreTemporaryCaptureState = async () => {
        if (temporaryAttachment) {
          temporaryAttachment = false;
          view.setVisible(false);
          if (owner && !owner.isDestroyed())
            owner.contentView.removeChildView(view);
        }
        if (temporaryBounds) {
          temporaryBounds = false;
          view.setBounds(originalBounds);
        }
        if (temporaryDeviceMetrics && !contents.isDestroyed()) {
          temporaryDeviceMetrics = false;
          await contents.debugger
            .sendCommand("Emulation.clearDeviceMetricsOverride")
            .catch(() => undefined);
        }
      };
      const captureErrors: string[] = [];
      // Prepare CDP emulation before capture, but let Electron's native
      // capturePage path run first. A stalled Page.captureScreenshot command
      // can block every later screenshot command on the same target.
      try {
        if (!contents.debugger.isAttached()) contents.debugger.attach("1.3");
        await contents.debugger
          .sendCommand("Page.enable")
          .catch(() => undefined);
        const layout = (await contents.debugger
          .sendCommand("Page.getLayoutMetrics")
          .catch(() => null)) as {
          cssLayoutViewport?: { clientWidth?: number; clientHeight?: number };
        } | null;
        const layoutWidth = layout?.cssLayoutViewport?.clientWidth ?? 0;
        const layoutHeight = layout?.cssLayoutViewport?.clientHeight ?? 0;
        if (layoutWidth < 1 || layoutHeight < 1) {
          await contents.debugger.sendCommand(
            "Emulation.setDeviceMetricsOverride",
            {
              width: entry?.viewport?.width ?? 1280,
              height: entry?.viewport?.height ?? 720,
              deviceScaleFactor: 1,
              mobile: false,
            },
          );
          temporaryDeviceMetrics = !entry?.viewport;
        }
      } catch (error) {
        captureErrors.push(
          `Screenshot emulation setup failed: ${String(error)}`,
        );
      }
      // A freshly attached WebContentsView can briefly have no compositor
      // frame on Windows even after did-finish-load. Retry that narrow race so
      // both the toolbar capture and the model screenshot tool are reliable.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0)
          await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        if (contents.isDestroyed()) return null;
        try {
          const captured = await Promise.race([
            contents.capturePage().then(
              (image) => ({ image, timedOut: false as const }),
              () => ({ image: null, timedOut: false as const }),
            ),
            new Promise<{ image: null; timedOut: true }>((resolve) =>
              setTimeout(() => resolve({ image: null, timedOut: true }), 1_500),
            ),
          ]);
          if (captured.timedOut) break;
          const image = captured.image;
          if (!image) continue;
          if (image.isEmpty()) continue;
          const screenshot = image.toPNG().toString("base64");
          await restoreTemporaryCaptureState();
          return screenshot.length <= MAX_SCREENSHOT_BASE64 ? screenshot : null;
        } catch {
          // A subsequent attempt can acquire the first committed frame.
        }
      }
      // capturePage depends on the native view having a committed compositor
      // surface. Hidden/detached tabs can still be captured reliably through
      // the already-used DevTools protocol without attaching them onscreen.
      try {
        if (!contents.debugger.isAttached()) contents.debugger.attach("1.3");
        await contents.debugger
          .sendCommand("Page.enable")
          .catch(() => undefined);
        for (const fromSurface of [true, false]) {
          try {
            const captured = (await Promise.race([
              contents.debugger.sendCommand("Page.captureScreenshot", {
                format: "png",
                fromSurface,
                captureBeyondViewport: !fromSurface,
              }),
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 5_000),
              ),
            ])) as { data?: unknown } | null;
            if (!captured) {
              captureErrors.push(
                `Page.captureScreenshot fromSurface=${fromSurface} timed out`,
              );
              continue;
            }
            if (typeof captured.data === "string") {
              const bytes = Buffer.byteLength(captured.data, "base64");
              if (bytes > 0 && captured.data.length <= MAX_SCREENSHOT_BASE64) {
                await restoreTemporaryCaptureState();
                return captured.data;
              }
            }
            captureErrors.push(
              `Page.captureScreenshot fromSurface=${fromSurface} returned no image`,
            );
          } catch (error) {
            captureErrors.push(
              `Page.captureScreenshot fromSurface=${fromSurface} failed: ${String(error)}`,
            );
          }
        }
      } catch (error) {
        captureErrors.push(`DevTools attachment failed: ${String(error)}`);
      }
      if (tab && captureErrors.length > 0) {
        this.#recordConsole(tab, "error", captureErrors.join("; "));
        entry?.logs.push({
          line: `Screenshot capture failed for ${tab.tabId}: ${captureErrors.join("; ")}`.slice(
            0,
            20_000,
          ),
          timestamp: new Date().toISOString(),
        });
        if (entry) entry.logs.splice(0, Math.max(0, entry.logs.length - 1_000));
      }
      await restoreTemporaryCaptureState();
      return null;
    }
  }

  setPreviewViewport(
    serverId: unknown,
    width: unknown,
    height: unknown,
    _tabId?: unknown,
  ): boolean {
    const entry = this.#entry(serverId);
    if (
      !entry ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    )
      return false;
    entry.viewport = {
      width: Math.min(16_384, Math.max(1, Math.round(width))),
      height: Math.min(16_384, Math.max(1, Math.round(height))),
    };
    const tab = this.#tab(entry, _tabId);
    if (tab) void this.#applyBrowserEmulation(entry, tab);
    return true;
  }

  clearPreviewViewport(serverId: unknown, _tabId?: unknown): boolean {
    const entry = this.#entry(serverId);
    if (!entry) return false;
    delete entry.viewport;
    const tab = this.#tab(entry, _tabId);
    if (tab) void this.#applyBrowserEmulation(entry, tab);
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
    const tab = this.#tab(entry, tabId);
    if (tab) void this.#applyBrowserEmulation(entry, tab);
    return true;
  }

  async ensureRemoteBlankPreview(sessionId: unknown): Promise<string | null> {
    if (typeof sessionId !== "string" || !sessionId) return null;
    const session = await this.#codeSessions
      .invoke("getSession", [sessionId])
      .catch(() => null);
    if (!session || typeof session !== "object" || Array.isArray(session))
      return null;
    const cwd = (session as JsonObject).cwd;
    return typeof cwd === "string"
      ? this.startBrowserPreview(cwd, sessionId)
      : null;
  }

  async navigatePreviewFromModel(
    serverId: unknown,
    rawUrl: unknown,
  ): Promise<JsonObject> {
    const entry = this.#entry(serverId);
    if (!entry || typeof rawUrl !== "string")
      return { ok: false, error: "Preview or URL is unavailable" };
    const ok = await this.navigatePreview(serverId, rawUrl, entry.activeTabId);
    return {
      ok,
      serverId: entry.server.serverId,
      tabId: entry.activeTabId,
      url: this.getPreviewUrl(serverId),
      ...(!ok ? { error: "The browser URL was blocked or unavailable" } : {}),
    };
  }

  previewConsoleLogs(
    serverId: unknown,
    rawOptions?: unknown,
  ): PreviewConsoleLog[] | null {
    const entry = this.#entry(serverId);
    if (!entry) return null;
    const options =
      rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions)
        ? (rawOptions as JsonObject)
        : {};
    const requestedTab =
      typeof options.tabId === "string" ? options.tabId : undefined;
    const levels = Array.isArray(options.levels)
      ? new Set(
          options.levels.filter(
            (value): value is string => typeof value === "string",
          ),
        )
      : null;
    const limit =
      typeof options.limit === "number" && Number.isFinite(options.limit)
        ? Math.min(500, Math.max(1, Math.round(options.limit)))
        : 200;
    return [...entry.tabs.values()]
      .filter((tab) => !requestedTab || tab.tabId === requestedTab)
      .flatMap((tab) => tab.consoleLogs)
      .filter((item) => !levels || levels.has(item.level))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .slice(-limit);
  }

  async previewInspect(
    serverId: unknown,
    selector: unknown,
    rawStyles?: unknown,
    signal?: AbortSignal,
  ): Promise<JsonObject | null> {
    const entry = this.#entry(serverId);
    const tab = entry ? this.#tab(entry) : undefined;
    const contents = tab?.view?.webContents;
    if (!contents || typeof selector !== "string" || !selector.trim())
      return null;
    const styles = Array.isArray(rawStyles)
      ? rawStyles
          .filter(
            (value): value is string =>
              typeof value === "string" && /^[-a-zA-Z0-9]{1,80}$/.test(value),
          )
          .slice(0, 64)
      : [];
    const result = await this.#executeJavaScript(
      contents,
      `(({ selector, styles }) => {
        const element = document.querySelector(selector);
        if (!(element instanceof Element)) return null;
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        const styleNames = styles.length ? styles : ["display", "position", "color", "background-color", "font-size", "font-family", "margin", "padding", "width", "height"];
        return {
          selector,
          tagName: element.tagName.toLowerCase(),
          text: String(element.textContent || "").trim().slice(0, 10000),
          attributes: Object.fromEntries([...element.attributes].slice(0, 100).map(attribute => [attribute.name, attribute.value.slice(0, 2000)])),
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          styles: Object.fromEntries(styleNames.map(name => [name, computed.getPropertyValue(name)])),
        };
      })(${JSON.stringify({ selector: selector.slice(0, 4_096), styles })})`,
      signal,
    );
    return result && typeof result === "object" && !Array.isArray(result)
      ? (result as JsonObject)
      : null;
  }

  async previewSnapshot(
    serverId: unknown,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const entry = this.#entry(serverId);
    const tab = entry ? this.#tab(entry) : undefined;
    const contents = tab?.view?.webContents;
    if (!contents) return null;
    const snapshot = await this.#executeJavaScript(
      contents,
      `(() => {
        const selectorFor = element => {
          if (element.id) return "#" + CSS.escape(element.id);
          const parts = [];
          for (let current = element; current instanceof Element && parts.length < 6; current = current.parentElement) {
            let part = current.tagName.toLowerCase();
            const siblings = current.parentElement ? [...current.parentElement.children].filter(child => child.tagName === current.tagName) : [];
            if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
            parts.unshift(part);
          }
          return parts.join(" > ");
        };
        const interactive = [...document.querySelectorAll("a,button,input,textarea,select,summary,[role=button],[role=link],[contenteditable=true]")]
          .filter(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          })
          .slice(0, 300)
          .map(element => {
            const rect = element.getBoundingClientRect();
            return {
              selector: selectorFor(element),
              tag: element.tagName.toLowerCase(),
              role: element.getAttribute("role"),
              name: String(element.getAttribute("aria-label") || element.innerText || element.value || element.textContent || "").trim().slice(0, 500),
              disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
              boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            };
          });
        return { title: document.title, url: location.href, text: String(document.body?.innerText || "").slice(0, 100000), interactive };
      })()`,
      signal,
    );
    const serialized = JSON.stringify(snapshot);
    if (serialized.length <= 2_000_000) return serialized;
    const value = objectValue(snapshot);
    return JSON.stringify({
      title: String(value.title ?? "").slice(0, 10_000),
      url: String(value.url ?? "").slice(0, 8_192),
      text: String(value.text ?? "").slice(0, 1_500_000),
      interactive: Array.isArray(value.interactive)
        ? value.interactive.slice(0, 100)
        : [],
      truncated: true,
    });
  }

  previewModelScreenshot(serverId: unknown): Promise<string | null> {
    return this.capturePreviewScreenshot(serverId);
  }

  getPreviewAllowedOrigins(): JsonObject[] {
    return [
      { origin: "http://localhost", builtin: true },
      { origin: "http://127.0.0.1", builtin: true },
      { origin: "http://[::1]", builtin: true },
      ...[...this.#allowedOrigins]
        .sort()
        .map((origin) => ({ origin, builtin: false })),
    ];
  }

  async addPreviewAllowedOrigin(rawOrigin: unknown): Promise<string> {
    if (typeof rawOrigin !== "string") return "invalid";
    let target: URL;
    try {
      target = new URL(rawOrigin.trim());
    } catch {
      return "invalid";
    }
    if (isLoopbackUrl(target.toString())) return "loopback";
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash
    )
      return "invalid";
    const origin = target.origin;
    if (this.#allowedOrigins.has(origin)) return "exists";
    const verified = await publicBrowserUrl(origin).catch(() => null);
    if (!verified) return "blocked";
    this.#allowedOrigins.add(origin);
    return "ok";
  }

  removePreviewAllowedOrigin(rawOrigin: unknown): boolean {
    if (typeof rawOrigin !== "string") return false;
    try {
      return this.#allowedOrigins.delete(new URL(rawOrigin).origin);
    } catch {
      return false;
    }
  }

  clearPreviewAllowedOrigins(): boolean {
    this.#allowedOrigins.clear();
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
      consoleLogs: [],
      rendererCrashes: [],
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

  async focusOrOpenPreviewTab(
    previewId: unknown,
    cwd: unknown,
    rawUrl: unknown,
  ): Promise<string | null> {
    if (typeof cwd !== "string" || typeof previewId !== "string") return null;
    let entry = this.#entry(previewId);
    if (!entry) {
      const sessionId = previewId.startsWith("preview-")
        ? previewId.slice("preview-".length)
        : previewId;
      const serverId = this.startBrowserPreview(cwd, sessionId);
      entry = serverId ? this.#entry(serverId) : undefined;
    }
    if (!entry) return null;
    if (typeof rawUrl === "string" && rawUrl) {
      const tabId =
        entry.activeTabId === "seed"
          ? this.openPreviewTab(entry.server.serverId, cwd) || entry.activeTabId
          : entry.activeTabId;
      this.setActivePreviewTab(entry.server.serverId, tabId);
      if (!(await this.navigatePreview(entry.server.serverId, rawUrl, tabId)))
        return null;
    }
    this.#onRevealRequested(
      entry.server.serverId,
      entry.server.sessionId || previewId,
      entry.activeTabId,
    );
    this.focusPreview(entry.server.serverId);
    return entry.server.serverId;
  }

  openExternalLinkInPreview(
    previewId: unknown,
    cwd: unknown,
    rawUrl: unknown,
  ): Promise<string | null> {
    return this.focusOrOpenPreviewTab(previewId, cwd, rawUrl);
  }

  async exportPreview(
    serverId: unknown,
    rawKind: unknown,
  ): Promise<boolean | null> {
    const entry = this.#entry(serverId);
    const tab = entry ? this.#tab(entry) : undefined;
    const contents = tab?.view?.webContents;
    if (!entry || !tab || !contents) return null;
    const kind = String(rawKind).toLowerCase();
    const exportHtml = kind === "html";
    if (!exportHtml && kind !== "png" && kind !== "screenshot") return null;
    const owner = this.#window();
    const options: Electron.SaveDialogOptions = {
      title: exportHtml ? "Export preview HTML" : "Export preview screenshot",
      defaultPath: path.join(
        entry.server.cwd,
        `${(tab.title || entry.server.name || "preview").replace(/[^a-z0-9._-]+/gi, "-")}.${exportHtml ? "html" : "png"}`,
      ),
      filters: exportHtml
        ? [{ name: "HTML", extensions: ["html"] }]
        : [{ name: "PNG image", extensions: ["png"] }],
    };
    const selection = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (selection.canceled || !selection.filePath) return false;
    if (exportHtml) {
      const html = await contents.executeJavaScript(
        `"<!doctype html>\n" + document.documentElement.outerHTML`,
        true,
      );
      await writeFile(selection.filePath, String(html), "utf8");
    } else {
      const screenshot = await this.capturePreviewScreenshot(
        entry.server.serverId,
        tab.tabId,
      );
      if (!screenshot) return null;
      await writeFile(selection.filePath, Buffer.from(screenshot, "base64"));
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
        ? await this.navigatePreview(
            entry.server.serverId,
            requestedUrl,
            tabId,
            signal,
          )
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

    if (name === "mcp__Claude_Browser__tabs_list")
      return JSON.stringify(this.getPreviewTabs(entry.server.serverId));

    if (name === "mcp__Claude_Browser__tabs_close") {
      const closeTabId = typeof input.tabId === "string" ? input.tabId : "";
      if (
        !closeTabId ||
        !this.closePreviewTab(entry.server.serverId, closeTabId)
      )
        throw new Error("Unknown or protected built-in browser tab");
      return JSON.stringify({ ok: true, tabId: closeTabId });
    }

    const tabId = typeof input.tabId === "string" ? input.tabId : "";
    const tab = this.#tab(entry, tabId);
    if (!tab || !tabId) throw new Error("Unknown built-in browser tab");
    this.setActivePreviewTab(entry.server.serverId, tabId);
    const view = this.#ensureView(entry, tabId);
    if (!view.webContents.getURL())
      await boundedBrowserAction(
        () => view.webContents.loadURL(tab.initialUrl),
        signal,
        MAX_BROWSER_ACTION_MS,
        () => view.webContents.stop(),
      );
    if (signal.aborted) throw new Error("Browser action was cancelled");

    if (name === "mcp__Claude_Browser__navigate") {
      const url = typeof input.url === "string" ? input.url.trim() : "";
      if (!url) throw new Error("Browser navigate requires a URL");
      const ok = await this.navigatePreview(
        entry.server.serverId,
        url,
        tabId,
        signal,
      );
      if (!ok) throw new Error("The browser URL was blocked or unavailable");
      return JSON.stringify({
        ok: true,
        tabId,
        url: this.getPreviewUrl(entry.server.serverId),
      });
    }

    if (name === "mcp__Claude_Browser__read_page") {
      const page = await this.#executeJavaScript(
        view.webContents,
        `(() => ({ title: document.title, url: location.href, text: String(document.body?.innerText || document.documentElement?.innerText || "").slice(0, 50000) }))()`,
        signal,
      );
      return JSON.stringify(page);
    }

    if (name === "mcp__Claude_Browser__snapshot") {
      const snapshot = await this.previewSnapshot(
        entry.server.serverId,
        signal,
      );
      if (!snapshot) throw new Error("Could not snapshot the browser tab");
      return snapshot;
    }

    if (name === "mcp__Claude_Browser__inspect") {
      const selector = typeof input.selector === "string" ? input.selector : "";
      const inspected = await this.previewInspect(
        entry.server.serverId,
        selector,
        input.styles,
        signal,
      );
      if (!inspected) throw new Error("Browser element was not found");
      return JSON.stringify(inspected);
    }

    if (name === "mcp__Claude_Browser__console_logs")
      return JSON.stringify(
        this.previewConsoleLogs(entry.server.serverId, {
          tabId,
          limit: input.limit,
          levels: input.levels,
        }) ?? [],
      );

    if (name === "mcp__Claude_Browser__go_back") {
      if (!this.goBack(entry.server.serverId, tabId))
        throw new Error("The browser tab has no previous history entry");
      return JSON.stringify({ ok: true, tabId });
    }

    if (name === "mcp__Claude_Browser__go_forward") {
      if (!this.goForward(entry.server.serverId, tabId))
        throw new Error("The browser tab has no forward history entry");
      return JSON.stringify({ ok: true, tabId });
    }

    if (name === "mcp__Claude_Browser__refresh") {
      if (!this.refreshPreview(entry.server.serverId, tabId))
        throw new Error("The browser tab could not be refreshed");
      return JSON.stringify({ ok: true, tabId });
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
      const result = (await this.#executeJavaScript(
        view.webContents,
        `(({ selector, visibleText }) => {
          const labelFor = candidate => String(candidate.innerText || candidate.value || candidate.textContent || "").trim();
          let element = null;
          if (selector) {
            const matches = [...document.querySelectorAll(selector)];
            element = visibleText
              ? matches.find(candidate => labelFor(candidate) === visibleText)
                || matches.find(candidate => labelFor(candidate).includes(visibleText))
                || null
              : matches[0] || null;
          }
          if (!element && visibleText) {
            const candidates = document.querySelectorAll("a,button,input,[role=button],[role=link],summary,label");
            element = [...candidates].find(candidate => labelFor(candidate) === visibleText)
              || [...candidates].find(candidate => labelFor(candidate).includes(visibleText))
              || null;
          }
          if (!(element instanceof HTMLElement)) throw new Error("Element not found");
          element.scrollIntoView({ block: "center", inline: "center" });
          const rect = element.getBoundingClientRect();
          const inViewport = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
          return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, inViewport, tag: element.tagName.toLowerCase(), text: String(element.innerText || element.textContent || "").trim().slice(0, 500) };
        })(${JSON.stringify({ selector, visibleText })})`,
        signal,
      )) as JsonObject;
      // A detached WebContentsView can lay out its page at negative viewport
      // coordinates. CDP accepts those mouse events but activates nothing, so
      // use the same DOM activation fallback we use for older Electron builds.
      if (result.inViewport === false) {
        await this.#executeJavaScript(
          view.webContents,
          `(({ selector, visibleText }) => {
            const labelFor = candidate => String(candidate.innerText || candidate.value || candidate.textContent || "").trim();
            let element = null;
            if (selector) {
              const matches = [...document.querySelectorAll(selector)];
              element = visibleText
                ? matches.find(candidate => labelFor(candidate) === visibleText)
                  || matches.find(candidate => labelFor(candidate).includes(visibleText))
                  || null
                : matches[0] || null;
            }
            if (!element && visibleText) {
              const candidates = [...document.querySelectorAll("a,button,input,[role=button],[role=link],summary,label")];
              element = candidates.find(candidate => labelFor(candidate) === visibleText)
                || candidates.find(candidate => labelFor(candidate).includes(visibleText))
                || null;
            }
            if (!(element instanceof HTMLElement)) throw new Error("Element not found");
            element.click();
          })(${JSON.stringify({ selector, visibleText })})`,
          signal,
        );
        return JSON.stringify({ ...result, activation: "dom" });
      }
      if (typeof result.x === "number" && typeof result.y === "number") {
        try {
          await this.#debuggerCommand(
            view.webContents,
            "Input.dispatchMouseEvent",
            { type: "mouseMoved", x: result.x, y: result.y },
            signal,
          );
          await this.#debuggerCommand(
            view.webContents,
            "Input.dispatchMouseEvent",
            {
              type: "mousePressed",
              x: result.x,
              y: result.y,
              button: "left",
              clickCount: 1,
            },
            signal,
          );
          await this.#debuggerCommand(
            view.webContents,
            "Input.dispatchMouseEvent",
            {
              type: "mouseReleased",
              x: result.x,
              y: result.y,
              button: "left",
              clickCount: 1,
            },
            signal,
          );
        } catch {
          if (signal.aborted) throw new Error("Browser action was cancelled");
          // Older Electron builds without debugger input still get a real
          // element activation as a compatibility fallback.
          await this.#executeJavaScript(
            view.webContents,
            `document.elementFromPoint(${result.x}, ${result.y})?.click()`,
            signal,
          );
        }
      }
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
      const result = (await this.#executeJavaScript(
        view.webContents,
        `(({ selector }) => {
          const element = document.querySelector(selector);
          if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLElement && element.isContentEditable)) throw new Error("Editable element not found");
          element.scrollIntoView({ block: "center", inline: "center" });
          element.focus();
          const rect = element.getBoundingClientRect();
          return { ok: true, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        })(${JSON.stringify({ selector })})`,
        signal,
      )) as JsonObject;
      try {
        await this.#debuggerCommand(
          view.webContents,
          "Input.dispatchKeyEvent",
          {
            type: "keyDown",
            key: "a",
            code: "KeyA",
            modifiers: 2,
          },
          signal,
        );
        await this.#debuggerCommand(
          view.webContents,
          "Input.dispatchKeyEvent",
          {
            type: "keyUp",
            key: "a",
            code: "KeyA",
            modifiers: 2,
          },
          signal,
        );
        await this.#debuggerCommand(
          view.webContents,
          "Input.insertText",
          {
            text: value,
          },
          signal,
        );
        if (input.submit === true) {
          await this.#debuggerCommand(
            view.webContents,
            "Input.dispatchKeyEvent",
            {
              type: "keyDown",
              key: "Enter",
              code: "Enter",
              windowsVirtualKeyCode: 13,
              nativeVirtualKeyCode: 13,
            },
            signal,
          );
          await this.#debuggerCommand(
            view.webContents,
            "Input.dispatchKeyEvent",
            {
              type: "keyUp",
              key: "Enter",
              code: "Enter",
              windowsVirtualKeyCode: 13,
              nativeVirtualKeyCode: 13,
            },
            signal,
          );
        }
      } catch {
        if (signal.aborted) throw new Error("Browser action was cancelled");
        await this.#executeJavaScript(
          view.webContents,
          `(({ selector, value, submit }) => {
            const element = document.querySelector(selector);
            if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLElement && element.isContentEditable)) throw new Error("Editable element not found");
            if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
              const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
              setter ? setter.call(element, value) : element.value = value;
            } else element.textContent = value;
            element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
            if (submit) {
              const form = element.closest("form");
              if (form instanceof HTMLFormElement) form.requestSubmit();
              else element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
            }
          })(${JSON.stringify({ selector, value, submit: input.submit === true })})`,
          signal,
        );
      }
      return JSON.stringify({ ...result, submitted: input.submit === true });
    }

    if (name === "mcp__Claude_Browser__screenshot") {
      const screenshot = await boundedBrowserAction(
        () => this.capturePreviewScreenshot(entry.server.serverId, tabId),
        signal,
        MAX_BROWSER_ACTION_MS,
        () => view.webContents.stop(),
      );
      if (!screenshot) {
        const currentUrl = view.webContents.getURL() || tab.initialUrl;
        throw new Error(
          `Could not capture built-in browser tab ${tabId}. The tab exists, is ${tab.loading ? "still loading" : "loaded"}, and is currently at ${currentUrl || "about:blank"}. Wait for loading to finish and retry screenshot; browser_read_page can still inspect its current DOM.`,
        );
      }
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
        if (!isAllowedLaunchRuntime(executable, Boolean(program))) return [];
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
    this.#diagnostics?.record(
      "preview",
      "server.start.requested",
      {
        cwd: typeof cwd === "string" ? path.resolve(cwd) : null,
        name: typeof name === "string" ? name : null,
        sessionId: typeof sessionId === "string" ? sessionId : null,
      },
      "info",
    );
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
    const launchSignature = JSON.stringify({
      command: selected.command,
      args: launchArgs,
      cwd: selectedCwd,
      port: selected.port,
      autoPort: selected.autoPort,
      env: Object.entries(selected.env).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    });
    const launchKey = `${root}\0${selected.name.toLowerCase()}`;
    const pending = this.#pendingLaunches.get(launchKey);
    if (pending) return pending;
    const operation = this.#startConfiguredService(
      root,
      selected,
      selectedCwd,
      launchArgs,
      launchSignature,
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
    launchSignature: string,
    sessionId: unknown,
    portAttempt = 0,
  ): Promise<JsonObject> {
    const existing = [...this.#entries.values()].find(
      (entry) =>
        entry.server.cwd === root &&
        entry.server.name.toLowerCase() === selected.name.toLowerCase() &&
        ["starting", "running"].includes(entry.server.status),
    );
    if (existing?.server.launchSignature === launchSignature)
      return {
        serverId: existing.server.serverId,
        previewId: existing.server.serverId,
        status: existing.server.status,
        url: existing.initialUrl,
        logs: existing.logs.slice(-20),
      };
    if (existing) await this.destroyPreview(existing.server.serverId);

    const port =
      selected.autoPort &&
      (portAttempt > 0 || !(await isPortAvailable(selected.port)))
        ? await unusedPort()
        : selected.port;
    if (!(await isPortAvailable(port)))
      return {
        error: `Port ${port} is already in use`,
        errorCode: "PORT_IN_USE",
      };
    if (this.#disposed) return { error: "Launch preview is shutting down" };
    if (
      [...this.#entries.values()].some(
        (entry) =>
          entry.server.port === port &&
          ["starting", "running"].includes(entry.server.status),
      )
    )
      return {
        error: `Port ${port} is already in use`,
        errorCode: "PORT_IN_USE",
      };
    const child = crossSpawn(selected.command, launchArgs, {
      cwd: selectedCwd,
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
      env: childEnvironment({
        ...selected.env,
        PORT: String(port),
      }),
      stdio: ["ignore", "pipe", "pipe"],
    }) as ChildProcess;
    this.#diagnostics?.record(
      "preview",
      "server.process.spawned",
      {
        name: selected.name,
        cwd: selectedCwd,
        port,
        pid: child.pid ?? null,
        argumentCount: launchArgs.length,
      },
      "info",
    );
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
        launchSignature,
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
      this.#diagnostics?.record(
        "preview",
        "server.process.error",
        {
          serverId: entry.server.serverId,
          name: selected.name,
          error: diagnosticError(error),
        },
        "error",
      );
    });
    child.once("exit", (code) => {
      appendLogs(`Process exited with code ${String(code)}`);
      if (entry.server.status !== "stopped") entry.server.status = "stopped";
      if (this.#entries.has(entry.server.serverId)) this.#emitChange();
      this.#diagnostics?.record(
        "preview",
        "server.process.exit",
        {
          serverId: entry.server.serverId,
          name: selected.name,
          code,
          status: entry.server.status,
        },
        code === 0 || entry.server.status === "stopped" ? "info" : "error",
      );
    });
    await this.#waitUntilReady(entry);
    if (entry.server.status !== "running") {
      const portCollision =
        entry.logs.some((log) =>
          /(?:EADDRINUSE|address already in use|port .* already in use)/i.test(
            String(log.line),
          ),
        ) || !(await isPortAvailable(port));
      if (selected.autoPort && portCollision && portAttempt < 3) {
        this.#diagnostics?.record(
          "preview",
          "server.port-collision.retry",
          {
            name: selected.name,
            port,
            attempt: portAttempt + 1,
          },
          "warn",
        );
        await this.destroyPreview(entry.server.serverId);
        return this.#startConfiguredService(
          root,
          selected,
          selectedCwd,
          launchArgs,
          launchSignature,
          sessionId,
          portAttempt + 1,
        );
      }
      return {
        error: `Preview process did not start successfully (status: ${entry.server.status})`,
        ...(portCollision ? { errorCode: "PORT_IN_USE" } : {}),
        serverId: entry.server.serverId,
        status: entry.server.status,
        logs: entry.logs.slice(-20),
      };
    }
    return {
      serverId: entry.server.serverId,
      previewId: entry.server.serverId,
      status: entry.server.status,
      url: entry.initialUrl,
      logs: entry.logs.slice(-20),
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
      const candidates = [
        ...loopbackUrls(entry.server.port),
        ...loggedLoopbackUrls(entry.logs),
      ].filter((candidate, index, all) => all.indexOf(candidate) === index);
      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate, {
            redirect: "manual",
            signal: AbortSignal.timeout(750),
          });
          await response.body?.cancel();
          const previousUrl = entry.initialUrl;
          entry.initialUrl = candidate;
          entry.server.port = Number(new URL(candidate).port);
          for (const tab of entry.tabs.values()) {
            if (tab.initialUrl !== previousUrl) continue;
            tab.initialUrl = candidate;
            tab.origin = new URL(candidate).origin;
            const contents = tab.view?.webContents;
            if (
              contents &&
              !contents.isDestroyed() &&
              contents.getURL() === previousUrl
            )
              void contents.loadURL(candidate).catch(() => undefined);
          }
          entry.server.status = "running";
          this.#emitChange();
          this.#emitTabs(entry);
          return;
        } catch {
          // Try the other loopback family before declaring the managed server
          // unavailable. Do not fall through to public interfaces.
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
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
    this.#diagnostics?.record(
      "preview",
      "server.stop.requested",
      {
        serverId: entry.server.serverId,
        name: entry.server.name,
        status: entry.server.status,
      },
      "info",
    );
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
    this.#diagnostics?.record(
      "preview",
      "destroy.requested",
      {
        serverId: entry.server.serverId,
        name: entry.server.name,
        tabs: entry.tabs.size,
        status: entry.server.status,
      },
      "info",
    );
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
    const proxy =
      this.#browserProxy ??
      (await this.#browserProxyPromise?.catch(() => null)) ??
      null;
    await this.#browserSession
      .setProxy({ mode: "direct" })
      .catch(() => undefined);
    await proxy?.close().catch(() => undefined);
    this.#browserProxy = null;
    this.#session.webRequest.onBeforeRequest(null);
    this.#browserSession.webRequest.onBeforeRequest(null);
    await this.#session.protocol.unhandle("claude-local-launch");
  }
}
