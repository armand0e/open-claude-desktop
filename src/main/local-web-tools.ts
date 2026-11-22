import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readResponseJson } from "./bounded-response";
import { childEnvironment } from "./child-environment";

type JsonObject = Record<string, unknown>;
const MAX_HEALTH_RESPONSE_BYTES = 64 * 1024;
const MAX_TOOL_RESPONSE_BYTES = 1024 * 1024;
const MAX_QUERY_LENGTH = 2_048;
const MAX_URL_LENGTH = 8_192;

export interface WebToolRunner {
  execute(
    name: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<string>;
}

export const WEB_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the live web through the private local Chromium proxy. Results include source type, reliability, URL, snippet, and search date. Prefer primary and official sources and only make claims supported by returned sources.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "visit_website",
      description:
        "Read a public HTTP or HTTPS page through private local Chromium. Returns cleaned page text, publication date, source reliability, section headings, and temporal warnings.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string" },
          query: {
            type: "string",
            description:
              "Optional topic used to select the most relevant page window.",
          },
        },
      },
    },
  },
] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactJson(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length <= 24_000
    ? serialized
    : `${serialized.slice(0, 24_000)}\n… output truncated`;
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted)
    return Promise.reject(new Error("Web tool was cancelled"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("Web tool was cancelled"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function forceTerminate(child: ChildProcess): Promise<void> {
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
      killer.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return;
  }
  child.kill("SIGKILL");
}

export class LocalWebTools implements WebToolRunner {
  readonly #userDataPath: string;
  readonly #proxyScript: string;
  #child: ChildProcess | null = null;
  #baseUrl = "";
  #startPromise: Promise<string> | null = null;
  readonly #authToken = randomUUID();
  #disposed = false;

  constructor(userDataPath: string, appPath: string) {
    this.#userDataPath = userDataPath;
    this.#proxyScript = path.join(
      appPath,
      "src",
      "main",
      "local-search-proxy.cjs",
    );
  }

  async #start(): Promise<string> {
    if (this.#disposed) throw new Error("Local web tools are shutting down");
    if (this.#baseUrl) return this.#baseUrl;
    if (this.#startPromise) return this.#startPromise;
    this.#startPromise = (async () => {
      if (this.#disposed) throw new Error("Local web tools are shutting down");
      let baseUrl = "";
      const child = spawn(process.execPath, [this.#proxyScript], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: childEnvironment({
          ELECTRON_RUN_AS_NODE: "1",
          // Let the child keep the ephemeral listener reservation. Selecting
          // a port in the parent and closing it before spawn leaves a race in
          // which another process can claim that port.
          PORT: "0",
          CHANNEL: process.env.CLAUDE_LOCAL_SEARCH_CHANNEL || "chrome",
          PROFILE_DIR: path.join(this.#userDataPath, "search-browser-profile"),
          AUTH_TOKEN: this.#authToken,
        }),
      });
      this.#child = child;
      let spawnError = "";
      let stdout = "";
      child.once("error", (error) => {
        spawnError = error.message;
        if (this.#child === child) this.#child = null;
      });
      child.once("exit", () => {
        if (this.#child !== child) return;
        this.#child = null;
        this.#baseUrl = "";
      });
      let stderr = "";
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        stdout = `${stdout}${chunk}`.slice(-4_000);
        const match = stdout.match(
          /claude-local-search-proxy (http:\/\/127\.0\.0\.1:[0-9]{1,5})/,
        );
        if (match) baseUrl = match[1];
      });
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-4_000);
      });
      try {
        const deadline = Date.now() + 20_000;
        while (Date.now() < deadline) {
          if (this.#disposed)
            throw new Error("Local web tools are shutting down");
          if (spawnError)
            throw new Error(
              `Local search proxy failed to start: ${spawnError}`,
            );
          if (this.#child !== child || child.exitCode !== null)
            throw new Error(
              `Local search proxy exited (${String(child.exitCode)})${stderr ? `: ${stderr.trim()}` : ""}`,
            );
          try {
            if (!baseUrl) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              continue;
            }
            const response = await fetch(`${baseUrl}/health`, {
              signal: AbortSignal.timeout(1_000),
              headers: { Authorization: `Bearer ${this.#authToken}` },
            });
            const body = await readResponseJson(
              response,
              MAX_HEALTH_RESPONSE_BYTES,
              "Local search health response",
            );
            if (
              response.ok &&
              typeof body === "object" &&
              body !== null &&
              (body as JsonObject).success === true
            ) {
              if (this.#disposed || this.#child !== child)
                throw new Error("Local web tools are shutting down");
              this.#baseUrl = baseUrl;
              return baseUrl;
            }
          } catch (error) {
            if (this.#disposed || spawnError || this.#child !== child)
              throw error;
            // Child binds after Chromium dependencies initialize.
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(
          `Timed out starting the local search proxy${stderr ? `: ${stderr.trim()}` : ""}`,
        );
      } catch (error) {
        await forceTerminate(child);
        if (this.#child === child) this.#child = null;
        throw error;
      }
    })();
    try {
      return await this.#startPromise;
    } finally {
      this.#startPromise = null;
    }
  }

  async execute(
    name: string,
    input: JsonObject,
    signal: AbortSignal,
  ): Promise<string> {
    if (this.#disposed) throw new Error("Local web tools are shutting down");
    const baseUrl = await withAbort(this.#start(), signal);
    let endpoint: URL;
    if (name === "web_search") {
      const query = text(input.query);
      if (!query) throw new Error("web_search requires a query");
      if (query.length > MAX_QUERY_LENGTH)
        throw new Error(
          `web_search query exceeds ${MAX_QUERY_LENGTH} characters`,
        );
      endpoint = new URL("/search", baseUrl);
      endpoint.searchParams.set("q", query);
    } else if (name === "visit_website") {
      const url = text(input.url);
      if (!url) throw new Error("visit_website requires a URL");
      if (url.length > MAX_URL_LENGTH)
        throw new Error(
          `visit_website URL exceeds ${MAX_URL_LENGTH} characters`,
        );
      endpoint = new URL("/fetch", baseUrl);
      endpoint.searchParams.set("url", url);
      const query = text(input.query);
      if (query.length > MAX_QUERY_LENGTH)
        throw new Error(
          `visit_website query exceeds ${MAX_QUERY_LENGTH} characters`,
        );
      if (query) endpoint.searchParams.set("q", query);
    } else {
      throw new Error(`Unknown web tool: ${name}`);
    }
    const response = await fetch(endpoint, {
      signal,
      headers: { Authorization: `Bearer ${this.#authToken}` },
    });
    const body = await readResponseJson(
      response,
      MAX_TOOL_RESPONSE_BYTES,
      "Local search proxy response",
    );
    if (!response.ok || typeof body !== "object" || body === null)
      throw new Error(`Local search proxy returned HTTP ${response.status}`);
    const result = body as JsonObject;
    if (result.success !== true)
      throw new Error(
        text(result.error) || "Local search proxy request failed",
      );
    return compactJson({
      ...result,
      searched_on: new Date().toISOString().slice(0, 10),
    });
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const child = this.#child;
    child?.kill();
    await this.#startPromise?.catch(() => undefined);
    if (child && child.exitCode === null && child.signalCode === null)
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 5_000);
        timer.unref?.();
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    if (child) await forceTerminate(child);
    this.#child = null;
    this.#baseUrl = "";
  }
}
