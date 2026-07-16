"use strict";

const http = require("node:http");
const dns = require("node:dns").promises;
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());

const PORT = Number.parseInt(process.env.PORT || "3456", 10);
const PROFILE_DIR = process.env.PROFILE_DIR || path.join(__dirname, "search-profile");
const CHANNEL = process.env.CHANNEL || "chrome";
const HEADFUL = process.env.HEADFUL === "1";
const MAX_CONTENT = 24_000;
const NAVIGATION_TIMEOUT = 30_000;
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
let blockedRequests = 0;

function isBlockedHost(hostname) {
  const parts = String(hostname || "").toLowerCase().split(".");
  for (let index = 0; index < parts.length; index += 1) {
    if (BLOCKED_HOSTS.has(parts.slice(index).join("."))) return true;
  }
  return false;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.")
  );
}

async function publicHttpUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only HTTP and HTTPS URLs can be visited");
  if (url.username || url.password) throw new Error("URL credentials are not allowed");
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost"))
    throw new Error("Local network URLs are not available to model tools");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address)))
    throw new Error("Private and local network URLs are not available to model tools");
  return url;
}

async function context() {
  if (!contextPromise) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    contextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
      headless: !HEADFUL,
      channel: CHANNEL || undefined,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      args: ["--disable-blink-features=AutomationControlled"],
    });
    const browserContext = await contextPromise;
    await browserContext.route("**/*", async (route) => {
      let hostname = "";
      try {
        hostname = new URL(route.request().url()).hostname;
      } catch {
        // Chromium will reject malformed URLs itself.
      }
      if (isBlockedHost(hostname)) {
        blockedRequests += 1;
        await route.abort("blockedbyclient");
      } else {
        await route.continue();
      }
    });
  }
  return contextPromise;
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
    host = new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return {};
  }
  if (/\.gov$|\.gov\.|\.edu$|\.edu\./.test(host))
    return { source_type: "official", reliability: "high" };
  if (host === "reddit.com" || host.endsWith(".reddit.com"))
    return { source_type: "forum", reliability: "low" };
  if (/stackoverflow\.com|stackexchange\.com|news\.ycombinator\.com/.test(host))
    return { source_type: "forum", reliability: "medium" };
  if (host === "wikipedia.org" || host.endsWith(".wikipedia.org"))
    return { source_type: "reference", reliability: "medium" };
  if (/reuters\.com|apnews\.com|bbc\.(com|co\.uk)|bloomberg\.com|ft\.com/.test(host))
    return { source_type: "news", reliability: "high" };
  return {};
}

const ENGINES = [
  {
    name: "duckduckgo",
    url: (query) => `https://html.duckduckgo.com/html/?kl=us-en&q=${encodeURIComponent(query)}`,
    parse: () =>
      [...document.querySelectorAll(".result")].flatMap((element) => {
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
        return [{
          title: anchor.textContent.trim(),
          url,
          snippet: element.querySelector(".result__snippet")?.textContent?.trim() || "",
        }];
      }).slice(0, 8),
  },
  {
    name: "bing",
    url: (query) => `https://www.bing.com/search?setmkt=en-US&q=${encodeURIComponent(query)}`,
    parse: () =>
      [...document.querySelectorAll("li.b_algo")].flatMap((element) => {
        const anchor = element.querySelector("h2 a");
        if (!anchor || !/^https?:/.test(anchor.href)) return [];
        return [{
          title: anchor.textContent.trim(),
          url: anchor.href,
          snippet: element.querySelector(".b_caption p, .b_algoSlug, p")?.textContent?.trim() || "",
        }];
      }).slice(0, 8),
  },
  {
    name: "brave",
    url: (query) => `https://search.brave.com/search?source=web&q=${encodeURIComponent(query)}`,
    parse: () =>
      [...document.querySelectorAll('#results [data-type="web"], #results .snippet')].flatMap((element) => {
        const anchor = element.querySelector('a[href^="http"]');
        if (!anchor) return [];
        return [{
          title: (element.querySelector(".title, .snippet-title") || anchor).textContent.trim(),
          url: anchor.href,
          snippet: element.querySelector(".snippet-description, .snippet-content")?.textContent?.trim() || "",
        }];
      }).filter((entry) => entry.title).slice(0, 8),
  },
];

async function search(query) {
  return withPage(async (page) => {
    let lastError;
    for (const engine of ENGINES) {
      try {
        await page.goto(engine.url(query), { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(600);
        const html = await page.content();
        if (/unusual traffic|are you a robot|captcha-delivery|\/sorry\/index/i.test(html))
          throw new Error(`${engine.name} returned a challenge page`);
        const results = await page.evaluate(engine.parse);
        if (results.length)
          return results.map((entry) => ({ ...entry, ...classifySource(entry.url) }));
        throw new Error(`${engine.name} returned no results`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("All search engines failed");
  });
}

function relevanceWindow(content, query) {
  if (content.length <= MAX_CONTENT) return content;
  const words = String(query || "").toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const lower = content.toLowerCase();
  const index = words.map((word) => lower.indexOf(word)).find((position) => position >= 0) ?? 0;
  const start = Math.max(0, index - 2_000);
  return content.slice(start, start + MAX_CONTENT);
}

async function visit(raw, query) {
  const target = await publicHttpUrl(raw);
  return withPage(async (page) => {
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    const extracted = await page.evaluate(() => {
      const clone = document.cloneNode(true);
      clone.querySelectorAll("script,style,noscript,svg,iframe,nav,footer,form,aside,[aria-hidden='true']")
        .forEach((element) => element.remove());
      const root = clone.querySelector("main,article,[role='main']") || clone.body;
      const content = (root?.innerText || root?.textContent || "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const date = document.querySelector("meta[property='article:published_time'],meta[name='date'],time[datetime]")
        ?.getAttribute("content") || document.querySelector("time[datetime]")?.getAttribute("datetime") || "";
      const outline = [...document.querySelectorAll("h1,h2,h3")].slice(0, 80).map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        heading: heading.textContent.trim(),
      })).filter((entry) => entry.heading);
      return { title: document.title, date, content, outline };
    });
    const dates = [...new Set(extracted.content.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || [])].slice(0, 20);
    return {
      url: target.toString(),
      title: extracted.title,
      date: extracted.date || undefined,
      content: relevanceWindow(extracted.content, query),
      _section_outline: extracted.outline.length ? extracted.outline : undefined,
      ...(dates.length > 2 ? { _temporal_warning: { dates_found: dates } } : {}),
      ...classifySource(target.toString()),
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
  let url;
  try {
    url = new URL(request.url, `http://127.0.0.1:${PORT}`);
  } catch {
    return send(response, 400, { success: false, error: "Invalid request URL" });
  }
  try {
    if (url.pathname === "/health")
      return send(response, 200, {
        success: true,
        service: "claude-local-search-proxy",
        mode: HEADFUL ? "headful" : "headless+stealth",
        blocked_requests: blockedRequests,
      });
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q")?.trim();
      if (!query) return send(response, 400, { success: false, error: "Missing query" });
      return send(response, 200, { success: true, results: await search(query) });
    }
    if (url.pathname === "/fetch") {
      const target = url.searchParams.get("url");
      if (!target) return send(response, 400, { success: false, error: "Missing URL" });
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

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`claude-local-search-proxy http://127.0.0.1:${PORT}\n`);
});

async function close() {
  server.close();
  const browserContext = await contextPromise?.catch(() => undefined);
  await browserContext?.close().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", close);
process.on("SIGTERM", close);
