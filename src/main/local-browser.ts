// Browser use: a headed, persistent Chromium context Claude drives through
// chat tools (navigate/read/click/type/screenshot). Headed on purpose — the
// user can watch and interrupt everything the model does. One page per
// conversation; the profile lives beside the search-proxy profile.

import { lookup } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import { request as httpsRequest } from "node:https";
import net from "node:net";
import { lstat, mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright-core";

type JsonObject = Record<string, unknown>;

const NAVIGATION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 8_000;
const MAX_PAGE_TEXT = 16_000;
const MAX_URL_LENGTH = 8_192;
const MAX_SELECTOR_LENGTH = 4_096;
const MAX_TYPED_TEXT = 1024 * 1024;
const MAX_SAVED_SHOTS = 100;
const PROXY_CONNECT_TIMEOUT_MS = 30_000;

interface PublicTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

interface PublicNetworkProxy {
  server: string;
  username: string;
  password: string;
  close(): Promise<void>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function conversationKey(conversationUuid: string): string {
  const key = conversationUuid.toLowerCase();
  if (!/^[0-9a-f][0-9a-f-]{0,63}$/.test(key))
    throw new Error("Invalid browser conversation id");
  return key;
}

function privateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b, c] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase();
  const dottedIndex = normalized.lastIndexOf(":");
  let source = normalized;
  let dottedWords: number[] = [];
  if (dottedIndex >= 0 && net.isIPv4(normalized.slice(dottedIndex + 1))) {
    const octets = normalized
      .slice(dottedIndex + 1)
      .split(".")
      .map(Number);
    dottedWords = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    source = normalized.slice(0, dottedIndex);
  }
  const halves = source.split("::");
  if (halves.length > 2) return true;
  const parseHalf = (value: string) =>
    value
      ? value
          .split(":")
          .map((word) =>
            /^[0-9a-f]{1,4}$/u.test(word) ? Number.parseInt(word, 16) : -1,
          )
      : [];
  const left = parseHalf(halves[0]);
  const right = halves.length === 2 ? parseHalf(halves[1]) : [];
  if ([...left, ...right].some((word) => word < 0)) return true;
  const missing = 8 - dottedWords.length - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return true;
  const words = [...left, ...Array(missing).fill(0), ...right, ...dottedWords];
  if (words.length !== 8) return true;
  const embeddedV4 = `${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
  const leadingZero = words.slice(0, 6).every((word) => word === 0);
  const mappedV4 =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mappedV4) return privateAddress(embeddedV4);
  if (leadingZero) return true;
  // Only globally routable 2000::/3 destinations are browser-reachable.
  if ((words[0] & 0xe000) !== 0x2000) return true;
  return (
    words[0] === 0x2002 ||
    (words[0] === 0x2001 && words[1] <= 0x01ff) ||
    (words[0] === 0x2001 && words[1] === 0x0db8) ||
    (words[0] === 0x3fff && words[1] <= 0x0fff)
  );
}

async function resolvePublicBrowserUrl(raw: string): Promise<PublicTarget> {
  if (!raw || raw.length > MAX_URL_LENGTH)
    throw new Error("Browser URL is empty or too long");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only HTTP and HTTPS URLs can be visited");
  if (url.username || url.password)
    throw new Error("URL credentials are not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost"))
    throw new Error("Private and local network URLs are unavailable");
  const addresses = await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) => privateAddress(entry.address))
  )
    throw new Error("Private and local network URLs are unavailable");
  const selected = addresses[0];
  return {
    url,
    address: selected.address,
    family: selected.family === 6 ? 6 : 4,
  };
}

export async function publicBrowserUrl(raw: string): Promise<URL> {
  return (await resolvePublicBrowserUrl(raw)).url;
}

function proxyAuthorized(request: IncomingMessage, expected: string): boolean {
  const supplied = request.headers["proxy-authorization"];
  return typeof supplied === "string" && supplied === expected;
}

function requireProxyAuthorization(
  request: IncomingMessage,
  response: ServerResponse,
  expected: string,
): boolean {
  if (proxyAuthorized(request, expected)) return true;
  response.writeHead(407, {
    "Content-Type": "text/plain; charset=utf-8",
    "Proxy-Authenticate": 'Basic realm="Open-Claude"',
    Connection: "close",
  });
  response.end("Proxy authentication required");
  return false;
}

function proxyHeaders(
  request: IncomingMessage,
  target: URL,
): Record<string, string | string[] | undefined> {
  const headers = { ...request.headers };
  delete headers["proxy-authorization"];
  delete headers["proxy-connection"];
  headers.host = target.host;
  headers.connection = "close";
  return headers;
}

async function startPublicNetworkProxy(): Promise<PublicNetworkProxy> {
  const username = "open-claude";
  const password = randomBytes(24).toString("hex");
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const sockets = new Set<net.Socket>();
  let server!: HttpServer;

  server = createHttpServer(async (request, response) => {
    if (!requireProxyAuthorization(request, response, expected)) return;
    try {
      const target = await resolvePublicBrowserUrl(request.url ?? "");
      const requestFn =
        target.url.protocol === "https:" ? httpsRequest : httpRequest;
      const upstream = requestFn(
        {
          host: target.address,
          family: target.family,
          port:
            target.url.port || (target.url.protocol === "https:" ? 443 : 80),
          method: request.method,
          path: `${target.url.pathname}${target.url.search}`,
          headers: proxyHeaders(request, target.url),
          ...(target.url.protocol === "https:"
            ? { servername: target.url.hostname.replace(/^\[|\]$/gu, "") }
            : {}),
        },
        (upstreamResponse) => {
          const headers = { ...upstreamResponse.headers };
          delete headers["proxy-authenticate"];
          delete headers["proxy-authorization"];
          response.writeHead(upstreamResponse.statusCode ?? 502, headers);
          upstreamResponse.pipe(response);
        },
      );
      upstream.setTimeout(PROXY_CONNECT_TIMEOUT_MS, () =>
        upstream.destroy(new Error("Public proxy request timed out")),
      );
      upstream.once("error", () => {
        if (!response.headersSent)
          response.writeHead(502, { "Content-Type": "text/plain" });
        response.end("Public proxy request failed");
      });
      request.once("aborted", () => upstream.destroy());
      request.pipe(upstream);
    } catch {
      response.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8",
        Connection: "close",
      });
      response.end("Private or invalid destination blocked");
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
  });
  server.on("connect", async (request, clientSocket, head) => {
    let upstream: net.Socket | undefined;
    let clientClosed = false;
    clientSocket.on("error", () => undefined);
    clientSocket.once("close", () => {
      clientClosed = true;
      upstream?.destroy();
    });
    if (!proxyAuthorized(request, expected)) {
      clientSocket.end(
        'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Open-Claude"\r\nConnection: close\r\n\r\n',
      );
      return;
    }
    try {
      const authority = request.url ?? "";
      if (
        !authority ||
        authority.length > MAX_URL_LENGTH ||
        authority.includes("/")
      )
        throw new Error("Invalid CONNECT authority");
      const parsed = new URL(`https://${authority}`);
      if (parsed.username || parsed.password)
        throw new Error("Credentials are unavailable");
      const target = await resolvePublicBrowserUrl(parsed.toString());
      if (clientClosed) return;
      const port = parsed.port ? Number.parseInt(parsed.port, 10) : 443;
      if (!Number.isInteger(port) || port < 1 || port > 65_535)
        throw new Error("Invalid CONNECT port");
      const connected = net.connect({
        host: target.address,
        family: target.family,
        port,
      });
      upstream = connected;
      sockets.add(connected);
      connected.setTimeout(PROXY_CONNECT_TIMEOUT_MS, () => connected.destroy());
      connected.once("connect", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) connected.write(head);
        clientSocket.pipe(connected);
        connected.pipe(clientSocket);
      });
      connected.once("close", () => sockets.delete(connected));
      connected.once("error", () => clientSocket.destroy());
    } catch {
      clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });
  server.on("clientError", (_error, socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not start the public browser proxy");
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    username,
    password,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export async function withAbort<T>(
  signal: AbortSignal,
  page: Page,
  action: () => Promise<T>,
): Promise<T> {
  if (signal.aborted) throw new Error("The browser action was cancelled");
  let rejectAbort: ((error: Error) => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    // Closing the page terminates click/type/fill work as well as navigation.
    // window.stop() only stops document loading and can leave a mutating input
    // action running after the caller has already been told it was cancelled.
    void page
      .close({ runBeforeUnload: false })
      .catch(() => undefined)
      .finally(() =>
        rejectAbort?.(new Error("The browser action was cancelled")),
      );
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const result = await Promise.race([action(), aborted]);
    if (signal.aborted) throw new Error("The browser action was cancelled");
    return result;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export class LocalBrowserUse {
  readonly #profileDir: string;
  readonly #shotsRoot: string;
  #context: BrowserContext | null = null;
  #contextPromise: Promise<BrowserContext> | null = null;
  #networkProxy: PublicNetworkProxy | null = null;
  #networkProxyPromise: Promise<PublicNetworkProxy> | null = null;
  readonly #pages = new Map<string, Page>();
  readonly #pagePromises = new Map<string, Promise<Page>>();
  readonly #pageGeneration = new Map<string, number>();
  #shotCounter = 0;
  #disposed = false;

  constructor(userDataPath: string) {
    this.#profileDir = path.join(userDataPath, "browser-use-profile");
    this.#shotsRoot = path.join(userDataPath, "browser-use", "shots");
  }

  async #ensureNetworkProxy(): Promise<PublicNetworkProxy> {
    if (this.#disposed) throw new Error("Browser use is shutting down");
    if (this.#networkProxy) return this.#networkProxy;
    if (!this.#networkProxyPromise)
      this.#networkProxyPromise = startPublicNetworkProxy();
    try {
      const proxy = await this.#networkProxyPromise;
      if (this.#disposed) {
        await proxy.close().catch(() => undefined);
        throw new Error("Browser use is shutting down");
      }
      this.#networkProxy = proxy;
      return proxy;
    } finally {
      this.#networkProxyPromise = null;
    }
  }

  async #ensureContext(): Promise<BrowserContext> {
    if (this.#disposed) throw new Error("Browser use is shutting down");
    if (this.#context) return this.#context;
    if (this.#contextPromise) return this.#contextPromise;
    this.#contextPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const proxy = await this.#ensureNetworkProxy();
      const context = await chromium.launchPersistentContext(this.#profileDir, {
        channel: "chrome",
        headless: false,
        viewport: { width: 1200, height: 800 },
        proxy: {
          server: proxy.server,
          username: proxy.username,
          password: proxy.password,
        },
      });
      await context.route("**/*", async (route) => {
        try {
          const requestUrl = new URL(route.request().url());
          if (
            requestUrl.protocol === "http:" ||
            requestUrl.protocol === "https:"
          )
            await publicBrowserUrl(requestUrl.toString());
          else if (
            !new Set(["about:", "blob:", "data:"]).has(requestUrl.protocol)
          )
            throw new Error("Unsupported browser URL");
          await route.continue();
        } catch {
          await route.abort("blockedbyclient");
        }
      });
      context.on("close", () => {
        if (this.#context !== context) return;
        this.#context = null;
        this.#pages.clear();
        this.#pagePromises.clear();
      });
      if (this.#disposed) {
        await context.close().catch(() => undefined);
        throw new Error("Browser use is shutting down");
      }
      this.#context = context;
      return context;
    })();
    try {
      return await this.#contextPromise;
    } finally {
      this.#contextPromise = null;
    }
  }

  async #page(conversationUuid: string): Promise<Page> {
    const key = conversationKey(conversationUuid);
    const existing = this.#pages.get(key);
    if (existing && !existing.isClosed()) return existing;
    const pending = this.#pagePromises.get(key);
    if (pending) return pending;
    const generation = this.#pageGeneration.get(key) ?? 0;
    const creation = (async () => {
      const context = await this.#ensureContext();
      const page = await context.newPage();
      if (
        this.#disposed ||
        (this.#pageGeneration.get(key) ?? 0) !== generation
      ) {
        await page.close().catch(() => undefined);
        throw new Error("Browser conversation was removed");
      }
      page.setDefaultTimeout(ACTION_TIMEOUT_MS);
      page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
      this.#pages.set(key, page);
      return page;
    })();
    this.#pagePromises.set(key, creation);
    try {
      return await creation;
    } finally {
      if (this.#pagePromises.get(key) === creation)
        this.#pagePromises.delete(key);
    }
  }

  async #pageSummary(page: Page): Promise<string> {
    const title = await page.title().catch(() => "");
    return `Now on: ${title || "(untitled)"} — ${page.url()}`;
  }

  async run(
    conversationUuid: string,
    name: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<{ output: string }> {
    if (signal.aborted) throw new Error("The browser action was cancelled");
    const page = await this.#page(conversationUuid);
    if (signal.aborted) throw new Error("The browser action was cancelled");
    await withAbort(signal, page, () => page.bringToFront());
    switch (name) {
      case "browser_navigate": {
        const url = text(input.url);
        const target = await publicBrowserUrl(url);
        await withAbort(signal, page, () =>
          page.goto(target.toString(), { waitUntil: "domcontentloaded" }),
        );
        return { output: await this.#pageSummary(page) };
      }
      case "browser_read_page": {
        const body = (
          (await withAbort(signal, page, () =>
            page
              .locator("body")
              .innerText({ timeout: ACTION_TIMEOUT_MS })
              .catch(() => ""),
          )) ?? ""
        )
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        const clipped =
          body.length > MAX_PAGE_TEXT
            ? `${body.slice(0, MAX_PAGE_TEXT)}\n… page text truncated`
            : body || "(the page has no readable text)";
        return {
          output: `${await this.#pageSummary(page)}\n\n${clipped}`,
        };
      }
      case "browser_click": {
        const target = text(input.target);
        if (!target) throw new Error("browser_click requires a target");
        if (target.length > MAX_SELECTOR_LENGTH)
          throw new Error("browser_click target is too long");
        // Visible text first (what the model read); CSS selector fallback.
        const matchingText = page.getByText(target, { exact: false });
        if ((await matchingText.count()) > 0) {
          await withAbort(signal, page, () =>
            matchingText.first().click({ timeout: ACTION_TIMEOUT_MS }),
          );
        } else {
          await withAbort(signal, page, () =>
            page.locator(target).first().click({
              timeout: ACTION_TIMEOUT_MS,
            }),
          );
        }
        await page
          .waitForLoadState("domcontentloaded", { timeout: 5_000 })
          .catch(() => undefined);
        return {
          output: `Clicked “${target}”. ${await this.#pageSummary(page)}`,
        };
      }
      case "browser_type": {
        const value = typeof input.text === "string" ? input.text : "";
        if (!value) throw new Error("browser_type requires text");
        if (value.length > MAX_TYPED_TEXT)
          throw new Error("browser_type text exceeds 1,048,576 characters");
        const selector = text(input.selector);
        if (selector.length > MAX_SELECTOR_LENGTH)
          throw new Error("browser_type selector is too long");
        if (selector)
          await withAbort(signal, page, () =>
            page.locator(selector).first().fill(value, {
              timeout: ACTION_TIMEOUT_MS,
            }),
          );
        else await withAbort(signal, page, () => page.keyboard.type(value));
        if (input.press_enter === true) {
          await withAbort(signal, page, () => page.keyboard.press("Enter"));
          await page
            .waitForLoadState("domcontentloaded", { timeout: 10_000 })
            .catch(() => undefined);
        }
        return { output: `Typed the text. ${await this.#pageSummary(page)}` };
      }
      case "browser_screenshot": {
        const key = conversationKey(conversationUuid);
        const directory = path.join(this.#shotsRoot, key);
        await mkdir(directory, { recursive: true });
        this.#shotCounter += 1;
        const fileName = `shot-${Date.now()}-${this.#shotCounter}.png`;
        await withAbort(signal, page, () =>
          page.screenshot({
            path: path.join(directory, fileName),
            fullPage: false,
          }),
        );
        const shots = (await readdir(directory)).filter((entry) =>
          /^shot-[0-9]+-[0-9]+\.png$/.test(entry),
        );
        for (const old of shots.sort().slice(0, -MAX_SAVED_SHOTS))
          await rm(path.join(directory, old), { force: true }).catch(
            () => undefined,
          );
        return {
          output: `Screenshot saved. Show it to the user with this markdown: ![screenshot](/api/local/browser/shots/${key}/${fileName})\n${await this.#pageSummary(page)}`,
        };
      }
      default:
        throw new Error(`Unknown browser tool: ${name}`);
    }
  }

  // Resolve a saved screenshot for the local endpoint; null when the path
  // escapes the shots directory or does not exist.
  async shotFile(
    conversationUuid: string,
    fileName: string,
  ): Promise<{ absolutePath: string; size_bytes: number } | null> {
    if (!/^shot-[0-9]+-[0-9]+\.png$/.test(fileName)) return null;
    let key: string;
    try {
      key = conversationKey(conversationUuid);
    } catch {
      return null;
    }
    const absolutePath = path.join(this.#shotsRoot, key, fileName);
    try {
      const candidate = await lstat(absolutePath);
      if (candidate.isSymbolicLink()) return null;
      const root = await realpath(path.join(this.#shotsRoot, key));
      const resolved = await realpath(absolutePath);
      const relative = path.relative(root, resolved);
      if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
      const info = await stat(resolved);
      return info.isFile()
        ? { absolutePath: resolved, size_bytes: info.size }
        : null;
    } catch {
      return null;
    }
  }

  async removeConversation(conversationUuid: string): Promise<void> {
    const key = conversationKey(conversationUuid);
    this.#pageGeneration.set(key, (this.#pageGeneration.get(key) ?? 0) + 1);
    const page = this.#pages.get(key);
    const pending = this.#pagePromises.get(key);
    this.#pages.delete(key);
    await page?.close().catch(() => undefined);
    await pending?.then((created) => created.close()).catch(() => undefined);
    await rm(path.join(this.#shotsRoot, key), {
      recursive: true,
      force: true,
    }).catch(() => undefined);
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const pending = this.#contextPromise;
    const context = this.#context ?? (await pending?.catch(() => null)) ?? null;
    await context?.close().catch(() => undefined);
    await Promise.allSettled(this.#pagePromises.values());
    const proxy =
      this.#networkProxy ??
      (await this.#networkProxyPromise?.catch(() => null)) ??
      null;
    await proxy?.close().catch(() => undefined);
    this.#context = null;
    this.#networkProxy = null;
    this.#pages.clear();
    this.#pagePromises.clear();
    this.#pageGeneration.clear();
  }
}
