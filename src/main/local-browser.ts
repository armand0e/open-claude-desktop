// Browser use: a headed, persistent Chromium context Claude drives through
// chat tools (navigate/read/click/type/screenshot). Headed on purpose — the
// user can watch and interrupt everything the model does. One page per
// conversation; the profile lives beside the search-proxy profile.

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright-core";

type JsonObject = Record<string, unknown>;

const NAVIGATION_TIMEOUT_MS = 30_000;
const ACTION_TIMEOUT_MS = 8_000;
const MAX_PAGE_TEXT = 16_000;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function conversationKey(conversationUuid: string): string {
  const key = conversationUuid.toLowerCase();
  if (!/^[0-9a-f][0-9a-f-]{0,63}$/.test(key))
    throw new Error("Invalid browser conversation id");
  return key;
}

export class LocalBrowserUse {
  readonly #profileDir: string;
  readonly #shotsRoot: string;
  #context: BrowserContext | null = null;
  #contextPromise: Promise<BrowserContext> | null = null;
  readonly #pages = new Map<string, Page>();
  #shotCounter = 0;

  constructor(userDataPath: string) {
    this.#profileDir = path.join(userDataPath, "browser-use-profile");
    this.#shotsRoot = path.join(userDataPath, "browser-use", "shots");
  }

  async #ensureContext(): Promise<BrowserContext> {
    if (this.#context) return this.#context;
    if (this.#contextPromise) return this.#contextPromise;
    this.#contextPromise = (async () => {
      const { chromium } = await import("playwright-core");
      const context = await chromium.launchPersistentContext(this.#profileDir, {
        channel: "chrome",
        headless: false,
        viewport: { width: 1200, height: 800 },
      });
      context.on("close", () => {
        this.#context = null;
        this.#pages.clear();
      });
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
    const context = await this.#ensureContext();
    const existing = this.#pages.get(key);
    if (existing && !existing.isClosed()) return existing;
    const page = await context.newPage();
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    this.#pages.set(key, page);
    return page;
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
    page.bringToFront().catch(() => undefined);
    switch (name) {
      case "browser_navigate": {
        const url = text(input.url);
        if (!/^https?:\/\//i.test(url))
          throw new Error("browser_navigate requires an http(s) URL");
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return { output: await this.#pageSummary(page) };
      }
      case "browser_read_page": {
        const body = (
          (await page
            .locator("body")
            .innerText({ timeout: ACTION_TIMEOUT_MS })
            .catch(() => "")) ?? ""
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
        // Visible text first (what the model read); CSS selector fallback.
        const byText = page.getByText(target, { exact: false }).first();
        try {
          await byText.click({ timeout: ACTION_TIMEOUT_MS });
        } catch {
          await page.locator(target).first().click({
            timeout: ACTION_TIMEOUT_MS,
          });
        }
        await page
          .waitForLoadState("domcontentloaded", { timeout: 5_000 })
          .catch(() => undefined);
        return {
          output: `Clicked “${target}”. ${await this.#pageSummary(page)}`,
        };
      }
      case "browser_type": {
        const value = text(input.text);
        if (!value) throw new Error("browser_type requires text");
        const selector = text(input.selector);
        if (selector)
          await page.locator(selector).first().fill(value, {
            timeout: ACTION_TIMEOUT_MS,
          });
        else await page.keyboard.type(value);
        if (input.press_enter === true) {
          await page.keyboard.press("Enter");
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
        await page.screenshot({
          path: path.join(directory, fileName),
          fullPage: false,
        });
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
      const info = await stat(absolutePath);
      return info.isFile() ? { absolutePath, size_bytes: info.size } : null;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.#context?.close().catch(() => undefined);
    this.#context = null;
    this.#pages.clear();
  }
}
