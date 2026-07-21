import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  BrowserWindow,
  session as electronSession,
  WebContentsView,
  type Rectangle,
} from "electron";
import { isPathInside } from "./file-access";
import type { LocalCodeSessionManager } from "./local-code";

type JsonObject = Record<string, unknown>;

const PREVIEW_EXTENSIONS = new Set([".html", ".htm", ".svg", ".pdf"]);
const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
const MAX_SCREENSHOT_BASE64 = 4 * 1024 * 1024;
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
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

function rectangle(value: unknown): Rectangle | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as JsonObject;
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

function previewUrl(token: string, relativePath: string): string {
  const encoded = relativePath
    .split(path.sep)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `claude-local-preview://${token}/${encoded}`;
}

export class LocalFilePreview {
  readonly #window: () => BrowserWindow | null;
  readonly #codeSessions: LocalCodeSessionManager;
  readonly #session = electronSession.fromPartition(
    `claude-local-preview-${randomUUID()}`,
  );
  readonly #roots = new Map<string, string>();
  #view: WebContentsView | null = null;
  #attached = false;
  #consumerId: string | undefined;
  #token = "";
  #generation = 0;
  #disposed = false;

  constructor(
    window: () => BrowserWindow | null,
    codeSessions: LocalCodeSessionManager,
  ) {
    this.#window = window;
    this.#codeSessions = codeSessions;
    this.#session.webRequest.onBeforeRequest((details, callback) => {
      try {
        const url = new URL(details.url);
        const allowed =
          (url.protocol === "claude-local-preview:" &&
            this.#roots.has(url.hostname)) ||
          ["data:", "blob:", "about:", "chrome-extension:"].includes(
            url.protocol,
          );
        callback({ cancel: !allowed });
      } catch {
        callback({ cancel: true });
      }
    });
    this.#session.protocol.handle("claude-local-preview", (request) =>
      this.#handle(request),
    );
  }

  async #handle(request: Request): Promise<Response> {
    try {
      if (request.method !== "GET" && request.method !== "HEAD")
        return new Response(null, { status: 405 });
      const url = new URL(request.url);
      const root = this.#roots.get(url.hostname);
      if (!root) return new Response("Preview expired", { status: 404 });
      const relative = decodeURIComponent(url.pathname.slice(1));
      const candidate = path.resolve(root, relative);
      if (!isPathInside(root, candidate))
        return new Response("Path outside preview root", { status: 403 });
      const resolved = await realpath(candidate);
      if (!isPathInside(root, resolved))
        return new Response("Path outside preview root", { status: 403 });
      // Read through a verified file descriptor. A path-level realpath/stat
      // followed by readFile can be redirected through a symlink swap between
      // validation and the read, exposing a file outside the session root.
      const descriptor = await open(
        resolved,
        constants.O_RDONLY |
          (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
      );
      try {
        const info = await descriptor.stat();
        if (!info.isFile() || info.size > MAX_PREVIEW_BYTES)
          return new Response("Preview file unavailable", { status: 404 });
        const confirmed = await realpath(resolved);
        if (!isPathInside(root, confirmed))
          return new Response("Path outside preview root", { status: 403 });
        const confirmedInfo = await stat(confirmed);
        if (confirmedInfo.dev !== info.dev || confirmedInfo.ino !== info.ino)
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
            "Content-Security-Policy": [
              "default-src 'self' data: blob:",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "media-src 'self' data: blob:",
              "connect-src 'none'",
              "frame-src 'self' data: blob:",
              "object-src 'none'",
              "base-uri 'none'",
              "form-action 'none'",
            ].join("; "),
            "X-Content-Type-Options": "nosniff",
            "Content-Length": String(content?.byteLength ?? info.size),
          },
        });
      } finally {
        await descriptor.close();
      }
    } catch {
      return new Response("Preview file unavailable", { status: 404 });
    }
  }

  #ensureView(): WebContentsView {
    if (this.#view && !this.#view.webContents.isDestroyed()) return this.#view;
    const view = new WebContentsView({
      webPreferences: {
        session: this.#session,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        plugins: true,
      },
    });
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    view.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith(`claude-local-preview://${this.#token}/`))
        event.preventDefault();
    });
    view.webContents.on("will-redirect", (event, url) => {
      if (!url.startsWith(`claude-local-preview://${this.#token}/`))
        event.preventDefault();
    });
    this.#view = view;
    return view;
  }

  #setBounds(bounds: Rectangle): void {
    const owner = this.#window();
    const view = this.#view;
    if (!owner || owner.isDestroyed() || !view) return;
    const [windowWidth, windowHeight] = owner.getContentSize();
    view.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: Math.min(bounds.width, Math.max(1, windowWidth - bounds.x)),
      height: Math.min(bounds.height, Math.max(1, windowHeight - bounds.y)),
    });
    view.setBorderRadius(8);
  }

  async show(
    sessionId: unknown,
    filePath: unknown,
    rawBounds: unknown,
    consumerId?: unknown,
  ): Promise<{ ok: boolean; declineReason?: string }> {
    if (
      this.#disposed ||
      typeof sessionId !== "string" ||
      typeof filePath !== "string"
    )
      return { ok: false, declineReason: "invalid_path" };
    const bounds = rectangle(rawBounds);
    if (!bounds) return { ok: false, declineReason: "invalid_bounds" };
    const requestedConsumer =
      typeof consumerId === "string" ? consumerId : undefined;
    if (
      requestedConsumer &&
      this.#consumerId &&
      requestedConsumer !== this.#consumerId
    )
      return { ok: false, declineReason: "preview_busy" };
    const generation = ++this.#generation;
    const resolved = await this.#codeSessions.invoke("resolveSessionFile", [
      sessionId,
      filePath,
    ]);
    if (
      this.#disposed ||
      generation !== this.#generation ||
      typeof resolved !== "string"
    )
      return { ok: false, declineReason: "invalid_path" };
    const extension = path.extname(resolved).toLowerCase();
    if (!PREVIEW_EXTENSIONS.has(extension))
      return { ok: false, declineReason: "unsupported_extension" };
    const info = await stat(resolved).catch(() => null);
    if (!info?.isFile() || info.size > MAX_PREVIEW_BYTES)
      return { ok: false, declineReason: "invalid_path" };
    const root = await realpath(path.dirname(resolved)).catch(() => null);
    if (this.#disposed || generation !== this.#generation || !root)
      return { ok: false, declineReason: "invalid_path" };
    const owner = this.#window();
    if (!owner || owner.isDestroyed())
      return { ok: false, declineReason: "no_parent_window" };
    const token = randomUUID();
    this.#roots.clear();
    this.#roots.set(token, root);
    this.#token = token;
    this.#consumerId = requestedConsumer;
    const view = this.#ensureView();
    if (!this.#attached) {
      owner.contentView.addChildView(view);
      this.#attached = true;
    }
    this.#setBounds(bounds);
    view.setVisible(true);
    try {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          view.webContents.loadURL(previewUrl(token, path.basename(resolved))),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              if (!view.webContents.isDestroyed()) view.webContents.stop();
              reject(new Error("File preview load timed out"));
            }, 15_000);
            timer.unref?.();
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch {
      if (generation === this.#generation) this.hide(requestedConsumer);
      return { ok: false, declineReason: "preview_load_failed" };
    }
    if (this.#disposed || generation !== this.#generation)
      return { ok: false, declineReason: "preview_load_failed" };
    return { ok: true };
  }

  hide(consumerId?: unknown): boolean {
    if (
      typeof consumerId === "string" &&
      this.#consumerId &&
      consumerId !== this.#consumerId
    )
      return false;
    this.#generation += 1;
    const owner = this.#window();
    if (this.#view) this.#view.setVisible(false);
    if (owner && !owner.isDestroyed() && this.#view && this.#attached) {
      owner.contentView.removeChildView(this.#view);
      this.#attached = false;
    }
    this.#consumerId = undefined;
    this.#roots.clear();
    this.#token = "";
    return true;
  }

  async parkAndCapture(
    rawBounds: unknown,
    consumerId?: unknown,
  ): Promise<string | null> {
    if (
      typeof consumerId === "string" &&
      this.#consumerId &&
      consumerId !== this.#consumerId
    )
      return null;
    const bounds = rectangle(rawBounds);
    if (bounds) this.#setBounds(bounds);
    if (!this.#view || this.#view.webContents.isDestroyed()) return null;
    try {
      const screenshot = (await this.#view.webContents.capturePage())
        .toPNG()
        .toString("base64");
      return screenshot.length <= MAX_SCREENSHOT_BASE64 ? screenshot : null;
    } catch {
      return null;
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.hide();
    if (this.#view && !this.#view.webContents.isDestroyed())
      this.#view.webContents.close();
    this.#view = null;
    await this.#session.protocol.unhandle("claude-local-preview");
  }
}
