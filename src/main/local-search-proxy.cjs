"use strict";

const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns").promises;
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Search providers aggressively challenge stock automation fingerprints. The
// proxy intentionally keeps one persistent Chrome profile and applies the
// stealth evasions before any context is launched.
chromium.use(StealthPlugin());

const parsedPort = Number.parseInt(process.env.PORT || "3456", 10);
const PORT =
  Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65_535
    ? parsedPort
    : 3456;
const PROFILE_DIR =
  process.env.PROFILE_DIR || path.join(__dirname, "search-profile");
const CHANNEL = process.env.CHANNEL || "chrome";
const HEADFUL = process.env.HEADFUL === "1";
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const MAX_CONTENT = 24_000;
const NAVIGATION_TIMEOUT = 30_000;
const PROXY_CONNECT_TIMEOUT = 30_000;
const BLOCKED_HOSTS = new Set([
  "doubleclick.net",
  "googlesyndication.com",
  "google-analytics.com",
  "googletagmanager.com",
  "adnxs.com",
  "amazon-adsystem.com",
  "facebook.net",
  "scorecardresearch.com",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "hotjar.com",
  "mixpanel.com",
]);

let contextPromise;
let networkProxyPromise;
let blockedRequests = 0;

function isBlockedHost(hostname) {
  const parts = String(hostname || "")
    .toLowerCase()
    .split(".");
  for (let index = 0; index < parts.length; index += 1) {
    if (BLOCKED_HOSTS.has(parts.slice(index).join("."))) return true;
  }
  return false;
}

function isPrivateAddress(address) {
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
  let dottedWords = [];
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
  const parseHalf = (value) =>
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
  if (mappedV4) return isPrivateAddress(embeddedV4);
  if (leadingZero) return true;
  if ((words[0] & 0xe000) !== 0x2000) return true;
  return (
    words[0] === 0x2002 ||
    (words[0] === 0x2001 && words[1] <= 0x01ff) ||
    (words[0] === 0x2001 && words[1] === 0x0db8) ||
    (words[0] === 0x3fff && words[1] <= 0x0fff)
  );
}

async function resolvePublicHttpUrl(raw) {
  if (!raw || raw.length > 8_192) throw new Error("URL is empty or too long");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only HTTP and HTTPS URLs can be visited");
  if (url.username || url.password)
    throw new Error("URL credentials are not allowed");
  const hostname = url.hostname.replace(/^\[|\]$/gu, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost"))
    throw new Error("Local network URLs are not available to model tools");
  const addresses = await dns.lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isPrivateAddress(entry.address))
  )
    throw new Error(
      "Private and local network URLs are not available to model tools",
    );
  return { url, address: addresses[0].address, family: addresses[0].family };
}

async function publicHttpUrl(raw) {
  return (await resolvePublicHttpUrl(raw)).url;
}

function proxyAuthorized(request, expected) {
  return request.headers["proxy-authorization"] === expected;
}

function proxyHeaders(request, target) {
  const headers = { ...request.headers };
  delete headers["proxy-authorization"];
  delete headers["proxy-connection"];
  headers.host = target.host;
  headers.connection = "close";
  return headers;
}

async function startPublicNetworkProxy() {
  if (!AUTH_TOKEN) throw new Error("The search proxy auth token is missing");
  const username = "open-claude";
  const expected = `Basic ${Buffer.from(`${username}:${AUTH_TOKEN}`).toString("base64")}`;
  const sockets = new Set();
  const proxy = http.createServer(async (request, response) => {
    if (!proxyAuthorized(request, expected)) {
      response.writeHead(407, {
        "Content-Type": "text/plain; charset=utf-8",
        "Proxy-Authenticate": 'Basic realm="Open-Claude"',
        Connection: "close",
      });
      response.end("Proxy authentication required");
      return;
    }
    try {
      const target = await resolvePublicHttpUrl(request.url || "");
      const requestFn =
        target.url.protocol === "https:" ? https.request : http.request;
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
          response.writeHead(upstreamResponse.statusCode || 502, headers);
          upstreamResponse.pipe(response);
        },
      );
      upstream.setTimeout(PROXY_CONNECT_TIMEOUT, () =>
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
      blockedRequests += 1;
      response.writeHead(403, {
        "Content-Type": "text/plain; charset=utf-8",
        Connection: "close",
      });
      response.end("Private or invalid destination blocked");
    }
  });
  proxy.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    // CONNECT clients commonly reset speculative Chromium tunnels while DNS
    // validation is still awaiting. Without a listener that reset is an
    // uncaught Socket error that terminates the entire proxy process.
    socket.on("error", () => undefined);
  });
  proxy.on("connect", async (request, clientSocket, head) => {
    let upstream;
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
      const authority = request.url || "";
      if (!authority || authority.length > 8_192 || authority.includes("/"))
        throw new Error("Invalid CONNECT authority");
      const parsed = new URL(`https://${authority}`);
      if (parsed.username || parsed.password)
        throw new Error("URL credentials are unavailable");
      const target = await resolvePublicHttpUrl(parsed.toString());
      if (clientClosed) return;
      const port = parsed.port ? Number.parseInt(parsed.port, 10) : 443;
      if (!Number.isInteger(port) || port < 1 || port > 65_535)
        throw new Error("Invalid CONNECT port");
      upstream = net.connect({
        host: target.address,
        family: target.family,
        port,
      });
      sockets.add(upstream);
      upstream.setTimeout(PROXY_CONNECT_TIMEOUT, () => upstream.destroy());
      upstream.once("connect", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        clientSocket.pipe(upstream);
        upstream.pipe(clientSocket);
      });
      upstream.once("close", () => sockets.delete(upstream));
      upstream.once("error", () => clientSocket.destroy());
    } catch {
      blockedRequests += 1;
      clientSocket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    }
  });
  proxy.on("clientError", (_error, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", () => {
      proxy.off("error", reject);
      resolve();
    });
  });
  const address = proxy.address();
  if (!address || typeof address === "string") {
    proxy.close();
    throw new Error("Could not start the public network proxy");
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    username,
    password: AUTH_TOKEN,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => proxy.close(() => resolve()));
    },
  };
}

async function networkProxy() {
  if (!networkProxyPromise) {
    const starting = startPublicNetworkProxy();
    networkProxyPromise = starting;
    void starting.catch(() => {
      if (networkProxyPromise === starting) networkProxyPromise = undefined;
    });
  }
  return await networkProxyPromise;
}

async function context() {
  if (!contextPromise) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    // Resolve the shared promise only after the network guard is installed.
    // Otherwise a concurrent caller can create a page during browser launch
    // and navigate before the route policy exists.
    const initializing = (async () => {
      const publicProxy = await networkProxy();
      const browserContext = await chromium.launchPersistentContext(
        PROFILE_DIR,
        {
          headless: !HEADFUL,
          channel: CHANNEL || undefined,
          viewport: { width: 1280, height: 900 },
          locale: "en-US",
          args: ["--disable-blink-features=AutomationControlled"],
          proxy: {
            server: publicProxy.server,
            username: publicProxy.username,
            password: publicProxy.password,
          },
        },
      );
      try {
        await browserContext.route("**/*", async (route) => {
          try {
            const requestUrl = new URL(route.request().url());
            if (isBlockedHost(requestUrl.hostname)) {
              blockedRequests += 1;
              await route.abort("blockedbyclient");
              return;
            }
            if (
              requestUrl.protocol === "http:" ||
              requestUrl.protocol === "https:"
            )
              await publicHttpUrl(requestUrl.toString());
            else if (
              !["data:", "blob:", "about:"].includes(requestUrl.protocol)
            )
              throw new Error("Unsupported browser request protocol");
            await route.continue();
          } catch {
            blockedRequests += 1;
            await route.abort("blockedbyclient");
          }
        });
        return browserContext;
      } catch (error) {
        await browserContext.close().catch(() => undefined);
        throw error;
      }
    })();
    contextPromise = initializing;
    void initializing.catch(() => {
      if (contextPromise === initializing) contextPromise = undefined;
    });
  }
  return await contextPromise;
}

async function withPage(callback) {
  const page = await (await context()).newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT);
  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

function classifySource(raw) {
  let host;
  try {
    host = new URL(raw).hostname
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");
  } catch {
    return {};
  }
  const isHostOrSubdomain = (domain) =>
    host === domain || host.endsWith(`.${domain}`);
  if (
    host.endsWith(".gov") ||
    host.endsWith(".edu") ||
    ["gov.uk", "gov.au", "gov.ca", "edu.au"].some(isHostOrSubdomain)
  )
    return { source_type: "official", reliability: "high" };
  if (isHostOrSubdomain("reddit.com"))
    return { source_type: "forum", reliability: "low" };
  if (
    ["stackoverflow.com", "stackexchange.com", "news.ycombinator.com"].some(
      isHostOrSubdomain,
    )
  )
    return { source_type: "forum", reliability: "medium" };
  if (isHostOrSubdomain("wikipedia.org"))
    return { source_type: "reference", reliability: "medium" };
  if (
    [
      "reuters.com",
      "apnews.com",
      "bbc.com",
      "bbc.co.uk",
      "bloomberg.com",
      "ft.com",
    ].some(isHostOrSubdomain)
  )
    return { source_type: "news", reliability: "high" };
  return {};
}

function normalizeSearchResultUrl(raw) {
  try {
    const parsed = new URL(raw);
    const duckDuckGoTarget = parsed.searchParams.get("uddg");
    if (
      duckDuckGoTarget &&
      (parsed.hostname === "duckduckgo.com" ||
        parsed.hostname.endsWith(".duckduckgo.com"))
    ) {
      const decoded = decodeURIComponent(duckDuckGoTarget);
      if (/^https?:\/\//u.test(decoded)) return decoded;
    }

    const bingTarget = parsed.searchParams.get("u");
    if (
      bingTarget?.startsWith("a1") &&
      (parsed.hostname === "bing.com" || parsed.hostname.endsWith(".bing.com"))
    ) {
      const decoded = Buffer.from(bingTarget.slice(2), "base64url").toString(
        "utf8",
      );
      if (/^https?:\/\//u.test(decoded)) return decoded;
    }
  } catch {}
  return raw;
}

const ENGINES = [
  {
    name: "duckduckgo",
    url: (query) =>
      `https://html.duckduckgo.com/html/?kl=us-en&q=${encodeURIComponent(query)}`,
    parse: () =>
      [...document.querySelectorAll(".result")]
        .flatMap((element) => {
          if (element.classList.contains("result--ad")) return [];
          const anchor = element.querySelector(".result__a");
          if (!anchor) return [];
          let url = anchor.getAttribute("href") || "";
          const redirect = url.match(/[?&]uddg=([^&]+)/);
          if (redirect) {
            try {
              url = decodeURIComponent(redirect[1]);
            } catch {}
          }
          if (url.startsWith("//")) url = `https:${url}`;
          if (!/^https?:/.test(url)) return [];
          return [
            {
              title: anchor.textContent.trim(),
              url,
              snippet:
                element
                  .querySelector(".result__snippet")
                  ?.textContent?.trim() || "",
            },
          ];
        })
        .slice(0, 8),
  },
  {
    name: "bing",
    url: (query) =>
      `https://www.bing.com/search?setmkt=en-US&q=${encodeURIComponent(query)}`,
    parse: () =>
      [...document.querySelectorAll("li.b_algo")]
        .flatMap((element) => {
          const anchor = element.querySelector("h2 a");
          if (!anchor || !/^https?:/.test(anchor.href)) return [];
          return [
            {
              title: anchor.textContent.trim(),
              url: anchor.href,
              snippet:
                element
                  .querySelector(".b_caption p, .b_algoSlug, p")
                  ?.textContent?.trim() || "",
            },
          ];
        })
        .slice(0, 8),
  },
  {
    name: "brave",
    url: (query) =>
      `https://search.brave.com/search?source=web&q=${encodeURIComponent(query)}`,
    parse: () =>
      [
        ...document.querySelectorAll(
          '#results [data-type="web"], #results .snippet',
        ),
      ]
        .flatMap((element) => {
          const anchor = element.querySelector('a[href^="http"]');
          if (!anchor) return [];
          return [
            {
              title: (
                element.querySelector(".title, .snippet-title") || anchor
              ).textContent.trim(),
              url: anchor.href,
              snippet:
                element
                  .querySelector(".snippet-description, .snippet-content")
                  ?.textContent?.trim() || "",
            },
          ];
        })
        .filter((entry) => entry.title)
        .slice(0, 8),
  },
];

async function navigateSearchPage(page, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  } catch (error) {
    // Chromium can report ERR_ABORTED when a provider replaces its initial
    // document during redirect. Continue only when a public document really
    // committed; an about:blank abort remains a genuine failure.
    if (
      !/net::ERR_ABORTED/u.test(String(error)) ||
      page.url() === "about:blank"
    )
      throw error;
    await page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .catch(() => undefined);
  }
  await publicHttpUrl(page.url());
}

async function searchWithEngine(engine, query) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await withPage(async (page) => {
        await navigateSearchPage(page, engine.url(query));
        await page.waitForTimeout(600);
        const html = await page.content();
        if (
          /unusual traffic|are you a robot|captcha-delivery|\/sorry\/index/i.test(
            html,
          )
        )
          throw new Error(`${engine.name} returned a challenge page`);
        const results = await page.evaluate(engine.parse);
        if (!results.length)
          throw new Error(`${engine.name} returned no results`);
        return results.map((entry) => {
          const url = normalizeSearchResultUrl(entry.url);
          return { ...entry, url, ...classifySource(url) };
        });
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${engine.name} failed`);
}

async function search(query) {
  const failures = [];
  for (const engine of ENGINES) {
    try {
      return await searchWithEngine(engine, query);
    } catch (error) {
      failures.push(
        `${engine.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  throw new Error(`All search engines failed (${failures.join("; ")})`);
}

function relevanceWindow(content, query) {
  if (content.length <= MAX_CONTENT) return content;
  const words = String(query || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  const lower = content.toLowerCase();
  const index =
    words
      .map((word) => lower.indexOf(word))
      .find((position) => position >= 0) ?? 0;
  const start = Math.max(0, index - 2_000);
  return content.slice(start, start + MAX_CONTENT);
}

async function visit(raw, query) {
  const target = await publicHttpUrl(raw);
  return withPage(async (page) => {
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    const finalUrl = await publicHttpUrl(page.url());
    await page.waitForTimeout(700);
    const extracted = await page.evaluate(() => {
      const clone = document.cloneNode(true);
      clone
        .querySelectorAll(
          "script,style,noscript,svg,iframe,nav,footer,form,aside,[aria-hidden='true']",
        )
        .forEach((element) => element.remove());
      const root =
        clone.querySelector("main,article,[role='main']") || clone.body;
      const content = (root?.innerText || root?.textContent || "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const date =
        document
          .querySelector(
            "meta[property='article:published_time'],meta[name='date'],time[datetime]",
          )
          ?.getAttribute("content") ||
        document.querySelector("time[datetime]")?.getAttribute("datetime") ||
        "";
      const outline = [...document.querySelectorAll("h1,h2,h3")]
        .slice(0, 80)
        .map((heading) => ({
          level: Number(heading.tagName.slice(1)),
          heading: heading.textContent.trim(),
        }))
        .filter((entry) => entry.heading);
      return { title: document.title, date, content, outline };
    });
    const dates = [
      ...new Set(
        extracted.content.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || [],
      ),
    ].slice(0, 20);
    return {
      url: finalUrl.toString(),
      title: extracted.title,
      date: extracted.date || undefined,
      content: relevanceWindow(extracted.content, query),
      _section_outline: extracted.outline.length
        ? extracted.outline
        : undefined,
      ...(dates.length > 2
        ? { _temporal_warning: { dates_found: dates } }
        : {}),
      ...classifySource(finalUrl.toString()),
    };
  });
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer(async (request, response) => {
  if (!AUTH_TOKEN || request.headers.authorization !== `Bearer ${AUTH_TOKEN}`)
    return send(response, 403, { success: false, error: "Forbidden" });
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, {
      success: false,
      error: "Method not allowed",
    });
  }
  let url;
  try {
    url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  } catch {
    return send(response, 400, {
      success: false,
      error: "Invalid request URL",
    });
  }
  try {
    if (url.pathname === "/health")
      return send(response, 200, {
        success: true,
        service: "claude-local-search-proxy",
        mode: HEADFUL ? "headful+stealth" : "headless+stealth",
        blocked_requests: blockedRequests,
      });
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query)
        return send(response, 400, { success: false, error: "Missing query" });
      if (query.length > 2_048)
        return send(response, 413, {
          success: false,
          error: "Query is too long",
        });
      return send(response, 200, {
        success: true,
        results: await search(query),
      });
    }
    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url");
      if (!target)
        return send(response, 400, { success: false, error: "Missing URL" });
      if (
        target.length > 8_192 ||
        (url.searchParams.get("q") || "").length > 2_048
      )
        return send(response, 413, {
          success: false,
          error: "Request is too long",
        });
      return send(response, 200, {
        success: true,
        ...(await visit(target, url.searchParams.get("q") || "")),
      });
    }
    return send(response, 404, { success: false, error: "Not found" });
  } catch (error) {
    return send(response, 200, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.on("connection", (socket) => socket.on("error", () => undefined));
server.on("clientError", (_error, socket) => socket.destroy());

async function close() {
  server.close();
  const browserContext = await contextPromise?.catch(() => undefined);
  await browserContext?.close().catch(() => undefined);
  const publicProxy = await networkProxyPromise?.catch(() => undefined);
  await publicProxy?.close().catch(() => undefined);
  process.exit(0);
}

if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    process.stdout.write(
      `claude-local-search-proxy http://127.0.0.1:${port}\n`,
    );
  });
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

module.exports = { classifySource, normalizeSearchResultUrl };
