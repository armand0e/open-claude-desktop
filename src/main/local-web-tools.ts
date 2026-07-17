import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";

type JsonObject = Record<string, unknown>;

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

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) =>
    server.listen(0, "127.0.0.1", resolve).once("error", reject),
  );
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (!port) throw new Error("Could not reserve a local search-proxy port");
  return port;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactJson(value: unknown): string {
  const serialized = JSON.stringify(value, null, 2);
  return serialized.length <= 24_000
    ? serialized
    : `${serialized.slice(0, 24_000)}\n… output truncated`;
}

export class LocalWebTools implements WebToolRunner {
  readonly #userDataPath: string;
  readonly #proxyScript: string;
  #child: ChildProcess | null = null;
  #baseUrl = "";
  #startPromise: Promise<string> | null = null;

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
    if (this.#baseUrl) return this.#baseUrl;
    if (this.#startPromise) return this.#startPromise;
    this.#startPromise = (async () => {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const child = spawn(process.execPath, [this.#proxyScript], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          PORT: String(port),
          CHANNEL: process.env.CLAUDE_LOCAL_SEARCH_CHANNEL || "chrome",
          PROFILE_DIR: path.join(this.#userDataPath, "search-browser-profile"),
        },
      });
      this.#child = child;
      let stderr = "";
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-4_000);
      });
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (child.exitCode !== null)
          throw new Error(
            `Local search proxy exited (${child.exitCode})${stderr ? `: ${stderr.trim()}` : ""}`,
          );
        try {
          const response = await fetch(`${baseUrl}/health`);
          const body: unknown = await response.json();
          if (
            response.ok &&
            typeof body === "object" &&
            body !== null &&
            (body as JsonObject).success === true
          ) {
            this.#baseUrl = baseUrl;
            return baseUrl;
          }
        } catch {
          // Child binds after Chromium dependencies initialize.
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      child.kill();
      throw new Error(
        `Timed out starting the local search proxy${stderr ? `: ${stderr.trim()}` : ""}`,
      );
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
    const baseUrl = await this.#start();
    let endpoint: URL;
    if (name === "web_search") {
      const query = text(input.query);
      if (!query) throw new Error("web_search requires a query");
      endpoint = new URL("/search", baseUrl);
      endpoint.searchParams.set("q", query);
    } else if (name === "visit_website") {
      const url = text(input.url);
      if (!url) throw new Error("visit_website requires a URL");
      endpoint = new URL("/fetch", baseUrl);
      endpoint.searchParams.set("url", url);
      const query = text(input.query);
      if (query) endpoint.searchParams.set("q", query);
    } else {
      throw new Error(`Unknown web tool: ${name}`);
    }
    const response = await fetch(endpoint, { signal });
    const body: unknown = await response.json();
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

  dispose(): void {
    this.#child?.kill();
    this.#child = null;
    this.#baseUrl = "";
  }
}
