// A minimal MCP (Model Context Protocol) client for chat mode: spawns the
// user's configured stdio servers, speaks newline-delimited JSON-RPC, and
// exposes their tools to the local chat loop as OpenAI-style functions.

import { ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
// cross-spawn resolves Windows .cmd shims and shebangs without shell:true.
// The package does not ship TypeScript declarations.
// @ts-expect-error -- untyped CommonJS dependency
import crossSpawn from "cross-spawn";
import { childEnvironment } from "./child-environment";

type JsonObject = Record<string, unknown>;

export interface McpToolDefinition {
  server: string;
  name: string;
  qualifiedName: string;
  description: string;
  inputSchema: JsonObject;
}

interface PendingRequest {
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const PROTOCOL_VERSION = "2024-11-05";
const REQUEST_TIMEOUT_MS = 60_000;
const TOOLS_CACHE_MS = 30_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const MAX_STDIO_WRITE_BUFFER_BYTES = 16 * 1024 * 1024;
const MAX_TOOL_PAGES = 100;
const MAX_TOOLS_PER_SERVER = 5_000;
const MAX_TOOL_SCHEMA_BYTES = 1024 * 1024;
const MAX_TOOL_CATALOG_BYTES = 32 * 1024 * 1024;
const MAX_AGGREGATED_TOOLS = 10_000;
const MAX_CONFIGURED_SERVERS = 1_000;
const MAX_COMMAND_CHARS = 8_192;
const MAX_SERVER_ARGS = 128;
const MAX_SERVER_ENVIRONMENT = 256;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedRemoteMcpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.hash
    )
      return null;
    return url.toString();
  } catch {
    return null;
  }
}

function expandEnvironment(value: string): string {
  return value.replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/gu,
    (match, name: string) => process.env[name] ?? match,
  );
}

function remoteHeaders(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const reserved = new Set([
    "accept",
    "content-length",
    "content-type",
    "host",
    "mcp-session-id",
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] =>
          /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/u.test(entry[0]) &&
          !reserved.has(entry[0].toLowerCase()) &&
          typeof entry[1] === "string" &&
          entry[1].length <= 32_768 &&
          !/[\r\n\0]/u.test(entry[1]),
      )
      .slice(0, MAX_SERVER_ENVIRONMENT)
      .map(([name, header]) => [name, expandEnvironment(header)]),
  );
}

export function qualifiedToolName(server: string, tool: string): string {
  const clean = (value: string, maxLength: number) => {
    const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (
      normalized === value &&
      !normalized.includes("__") &&
      normalized.length <= maxLength
    )
      return normalized;
    const hash = createHash("sha256").update(value).digest("hex").slice(0, 10);
    const prefix = normalized.slice(
      0,
      Math.max(1, maxLength - hash.length - 1),
    );
    return `${prefix || "_"}_${hash}`;
  };
  // OpenAI-compatible function names are limited to 64 characters. Hash any
  // lossy/truncated component so distinct MCP names can never alias merely
  // because punctuation was sanitized.
  return `mcp__${clean(server, 24)}__${clean(tool, 32)}`;
}

function terminateChild(child: ChildProcess | null): void {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn(
      "taskkill.exe",
      ["/pid", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" },
    );
    killer.once("error", () => child.kill());
    return;
  }
  child.kill();
}

function toolDefinitions(
  serverName: string,
  rawTools: unknown,
): McpToolDefinition[] {
  return (Array.isArray(rawTools) ? rawTools : [])
    .filter(isObject)
    .flatMap((tool) => {
      const name = typeof tool.name === "string" ? tool.name : "";
      if (!name || name.length > 512) return [];
      const inputSchema = isObject(tool.inputSchema)
        ? tool.inputSchema
        : { type: "object", properties: {} };
      let schemaBytes: number;
      try {
        schemaBytes = Buffer.byteLength(JSON.stringify(inputSchema), "utf8");
      } catch {
        return [];
      }
      if (schemaBytes > MAX_TOOL_SCHEMA_BYTES) return [];
      return [
        {
          server: serverName,
          name,
          qualifiedName: qualifiedToolName(serverName, name),
          description:
            typeof tool.description === "string"
              ? tool.description.slice(0, 20_000)
              : "",
          inputSchema,
        },
      ];
    });
}

async function responseText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`MCP response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function sseData(frame: string): string {
  return frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
}

async function sseResponse(
  response: Response,
  expectedId: number,
): Promise<JsonObject> {
  if (!response.body)
    throw new Error("MCP server returned an empty event stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let buffer = "";
  const inspect = (frame: string): JsonObject | undefined => {
    const data = sseData(frame);
    if (!data) return undefined;
    try {
      const message: unknown = JSON.parse(data);
      return isObject(message) && message.id === expectedId
        ? message
        : undefined;
    } catch {
      return undefined;
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        const message = inspect(buffer);
        if (message) return message;
        break;
      }
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`MCP response exceeded ${MAX_RESPONSE_BYTES} bytes`);
      }
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const message = inspect(frame);
        if (message) {
          // Streamable HTTP responses are allowed to stay open after the
          // response event. Stop as soon as our JSON-RPC id arrives.
          await reader.cancel().catch(() => undefined);
          return message;
        }
        separator = buffer.match(/\r?\n\r?\n/);
      }
    }
  } finally {
    reader.releaseLock();
  }
  throw new Error("MCP server streamed no matching JSON-RPC response");
}

class McpConnection {
  readonly serverName: string;
  #child: ChildProcess | null = null;
  #nextId = 1;
  #pending = new Map<number, PendingRequest>();
  #buffer = "";
  #initialized: Promise<void> | null = null;
  #toolsCache: { tools: McpToolDefinition[]; at: number } | null = null;
  readonly configSignature: string;

  constructor(
    serverName: string,
    private readonly command: string,
    private readonly args: string[],
    private readonly env: Record<string, string>,
    configSignature: string,
  ) {
    this.serverName = serverName;
    this.configSignature = configSignature;
  }

  #ensureStarted(): Promise<void> {
    if (this.#initialized) return this.#initialized;
    this.#buffer = "";
    const initialized = (async () => {
      const child = crossSpawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: childEnvironment(this.env),
        windowsHide: true,
      }) as ChildProcess;
      this.#child = child;
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => this.#onData(chunk));
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", () => undefined);
      child.stdin?.on("error", (error) => {
        if (this.#child !== child) return;
        this.#fail(
          new Error(
            `MCP server "${this.serverName}" stopped accepting requests: ${error.message}`,
          ),
        );
      });
      child.on("exit", () => {
        if (this.#child !== child) return;
        const error = new Error(
          `MCP server "${this.serverName}" exited unexpectedly`,
        );
        for (const pending of this.#pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        this.#pending.clear();
        this.#child = null;
        this.#buffer = "";
        this.#initialized = null;
        this.#toolsCache = null;
      });
      const spawned = new Promise<void>((resolve, reject) => {
        child.once("spawn", () => resolve());
        child.once("error", (error) =>
          reject(
            new Error(
              `MCP server "${this.serverName}" failed to start: ${error.message}`,
            ),
          ),
        );
      });
      try {
        await spawned;
        await this.#request("initialize", {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "open-claude", version: "0.2.1" },
        });
        this.#notify("notifications/initialized", {});
      } catch (error) {
        if (this.#child === child) {
          this.#child = null;
          this.#buffer = "";
          this.#toolsCache = null;
          const failure =
            error instanceof Error ? error : new Error(String(error));
          for (const pending of this.#pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(failure);
          }
          this.#pending.clear();
          terminateChild(child);
        }
        throw error;
      }
    })();
    this.#initialized = initialized;
    void initialized.catch(() => {
      if (this.#initialized === initialized) this.#initialized = null;
    });
    return initialized;
  }

  #onData(chunk: string): void {
    this.#buffer += chunk;
    if (Buffer.byteLength(this.#buffer, "utf8") > MAX_RESPONSE_BYTES) {
      this.#fail(
        new Error(
          `MCP server "${this.serverName}" emitted a line exceeding ${MAX_RESPONSE_BYTES} bytes`,
        ),
      );
      return;
    }
    let newline = this.#buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      newline = this.#buffer.indexOf("\n");
      if (!line) continue;
      if (Buffer.byteLength(line, "utf8") > MAX_RESPONSE_BYTES) {
        this.#fail(
          new Error(
            `MCP server "${this.serverName}" emitted a response exceeding ${MAX_RESPONSE_BYTES} bytes`,
          ),
        );
        return;
      }
      try {
        const message: unknown = JSON.parse(line);
        if (!isObject(message) || typeof message.id !== "number") continue;
        const pending = this.#pending.get(message.id);
        if (!pending) continue;
        this.#pending.delete(message.id);
        clearTimeout(pending.timer);
        if (isObject(message.error))
          pending.reject(
            new Error(String(message.error.message ?? "MCP request failed")),
          );
        else pending.resolve(isObject(message.result) ? message.result : {});
      } catch {
        // Non-JSON stdout lines (logging) are ignored.
      }
    }
  }

  #fail(error: Error): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.#pending.clear();
    const child = this.#child;
    this.#child = null;
    this.#buffer = "";
    this.#initialized = null;
    this.#toolsCache = null;
    terminateChild(child);
  }

  #write(payload: JsonObject): void {
    const line = `${JSON.stringify(payload)}\n`;
    if (Buffer.byteLength(line, "utf8") > MAX_RESPONSE_BYTES)
      throw new Error(`MCP request exceeded ${MAX_RESPONSE_BYTES} bytes`);
    const child = this.#child;
    const stdin = child?.stdin;
    if (!stdin?.writable)
      throw new Error(`MCP server "${this.serverName}" is not writable`);
    if (
      stdin.writableLength + Buffer.byteLength(line, "utf8") >
      MAX_STDIO_WRITE_BUFFER_BYTES
    )
      throw new Error(
        `MCP server "${this.serverName}" is not reading requests`,
      );
    stdin.write(line, (error) => {
      if (!error || this.#child !== child) return;
      this.#fail(
        new Error(
          `MCP server "${this.serverName}" stopped accepting requests: ${error.message}`,
        ),
      );
    });
  }

  #notify(method: string, params: JsonObject): void {
    this.#write({ jsonrpc: "2.0", method, params });
  }

  #request(
    method: string,
    params: JsonObject,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<JsonObject> {
    const id = this.#nextId++;
    return new Promise<JsonObject>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(
          new Error(`MCP server "${this.serverName}" timed out on ${method}`),
        );
      }, timeoutMs);
      timer.unref?.();
      this.#pending.set(id, { resolve, reject, timer });
      try {
        this.#write({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (this.#toolsCache && Date.now() - this.#toolsCache.at < TOOLS_CACHE_MS)
      return this.#toolsCache.tools;
    await this.#ensureStarted();
    const byName = new Map<string, McpToolDefinition>();
    let catalogBytes = 0;
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
      const result = await this.#request(
        "tools/list",
        cursor ? { cursor } : {},
      );
      for (const tool of toolDefinitions(this.serverName, result.tools)) {
        if (byName.has(tool.name)) continue;
        catalogBytes += Buffer.byteLength(JSON.stringify(tool), "utf8");
        if (catalogBytes > MAX_TOOL_CATALOG_BYTES)
          throw new Error(
            `MCP server "${this.serverName}" exceeded the ${MAX_TOOL_CATALOG_BYTES}-byte tool catalog limit`,
          );
        byName.set(tool.name, tool);
      }
      if (byName.size > MAX_TOOLS_PER_SERVER)
        throw new Error(
          `MCP server "${this.serverName}" exceeded ${MAX_TOOLS_PER_SERVER} tools`,
        );
      const next =
        typeof result.nextCursor === "string" && result.nextCursor
          ? result.nextCursor
          : undefined;
      if (!next) break;
      if (cursors.has(next))
        throw new Error(`MCP server "${this.serverName}" repeated a cursor`);
      cursors.add(next);
      cursor = next;
      if (page === MAX_TOOL_PAGES - 1)
        throw new Error(
          `MCP server "${this.serverName}" exceeded ${MAX_TOOL_PAGES} tool pages`,
        );
    }
    const tools = [...byName.values()];
    this.#toolsCache = { tools, at: Date.now() };
    return tools;
  }

  async callTool(name: string, args: JsonObject): Promise<string> {
    await this.#ensureStarted();
    const result = await this.#request("tools/call", {
      name,
      arguments: args,
    });
    const parts = (Array.isArray(result.content) ? result.content : [])
      .filter(isObject)
      .map((entry) =>
        typeof entry.text === "string" ? entry.text : JSON.stringify(entry),
      );
    const text = parts.join("\n") || JSON.stringify(result);
    if (result.isError === true)
      throw new Error(text.slice(0, 2_000) || "MCP tool reported an error");
    return text;
  }

  dispose(): void {
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("MCP connection disposed"));
    }
    this.#pending.clear();
    terminateChild(this.#child);
    this.#child = null;
    this.#buffer = "";
    this.#initialized = null;
    this.#toolsCache = null;
  }
}

// Remote MCP over streamable HTTP: JSON-RPC requests POSTed to the server
// URL, responses arriving as plain JSON or a single SSE stream. OAuth bearer
// tokens are supplied just-in-time by the main-process credential manager and
// never become part of connector config or renderer state.
class RemoteMcpConnection {
  readonly serverName: string;
  readonly configSignature: string;
  readonly #url: string;
  #sessionId: string | null = null;
  #nextId = 1;
  #initialized: Promise<void> | null = null;
  #toolsCache: { tools: McpToolDefinition[]; at: number } | null = null;
  readonly #activeControllers = new Set<AbortController>();

  constructor(
    serverName: string,
    url: string,
    configSignature: string,
    private readonly authorization: (
      forceRefresh: boolean,
    ) => Promise<string | null>,
    private readonly configuredHeaders: Record<string, string> = {},
  ) {
    this.serverName = serverName;
    this.#url = url;
    this.configSignature = configSignature;
  }

  async #post(
    payload: JsonObject,
    expectedId?: number,
    allowAuthRetry = true,
  ): Promise<JsonObject | null> {
    const controller = new AbortController();
    this.#activeControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timeout.unref?.();
    try {
      const accessToken = await this.authorization(false);
      if (
        accessToken &&
        (accessToken.length > 65_536 ||
          /[\u0000-\u001f\u007f]/u.test(accessToken))
      )
        throw new Error(
          `MCP server "${this.serverName}" has an invalid local OAuth token`,
        );
      const response = await fetch(this.#url, {
        method: "POST",
        headers: {
          ...this.configuredHeaders,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(this.#sessionId ? { "Mcp-Session-Id": this.#sessionId } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        // A redirect could carry the opaque MCP session id to another
        // origin. Require the configured endpoint to be the final endpoint.
        redirect: "manual",
      });
      const session = response.headers.get("mcp-session-id");
      if (
        session &&
        session.length <= 4_096 &&
        !/[\u0000-\u001f\u007f]/u.test(session)
      )
        this.#sessionId = session;
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(
          `MCP server "${this.serverName}" redirected; configure its final URL directly`,
        );
      }
      if (response.status === 202) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel().catch(() => undefined);
        if (accessToken && allowAuthRetry) {
          const refreshed = await this.authorization(true);
          if (refreshed) {
            this.#sessionId = null;
            return this.#post(payload, expectedId, false);
          }
        }
        throw new Error(
          accessToken
            ? `MCP server "${this.serverName}" rejected the local login; reconnect the account`
            : `MCP server "${this.serverName}" requires authentication; connect the account first`,
        );
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(
          `MCP server "${this.serverName}" returned HTTP ${response.status}`,
        );
      }
      const type = (response.headers.get("content-type") ?? "").toLowerCase();
      if (type.includes("text/event-stream")) {
        if (expectedId === undefined) {
          await response.body?.cancel().catch(() => undefined);
          return null;
        }
        // Keep the deadline and shutdown controller active until the body
        // yields our response, not merely until the HTTP headers arrive.
        return await sseResponse(response, expectedId);
      }
      const text = await responseText(response);
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `MCP server "${this.serverName}" returned invalid JSON`,
        );
      }
      return isObject(body) ? body : {};
    } finally {
      clearTimeout(timeout);
      this.#activeControllers.delete(controller);
    }
  }

  async #request(method: string, params: JsonObject): Promise<JsonObject> {
    const id = this.#nextId++;
    const message = await this.#post(
      {
        jsonrpc: "2.0",
        id,
        method,
        params,
      },
      id,
    );
    if (!message)
      throw new Error(
        `MCP server "${this.serverName}" accepted ${method} without replying`,
      );
    if (message.id !== id)
      throw new Error(
        `MCP server "${this.serverName}" replied with the wrong JSON-RPC id`,
      );
    if (isObject(message.error))
      throw new Error(String(message.error.message ?? "MCP request failed"));
    return isObject(message.result) ? message.result : {};
  }

  #ensureStarted(): Promise<void> {
    if (this.#initialized) return this.#initialized;
    const initialized = (async () => {
      await this.#request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "open-claude", version: "0.2.1" },
      });
      await this.#post({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      }).catch(() => undefined);
    })();
    this.#initialized = initialized;
    void initialized.catch(() => {
      if (this.#initialized === initialized) this.#initialized = null;
    });
    return initialized;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (this.#toolsCache && Date.now() - this.#toolsCache.at < TOOLS_CACHE_MS)
      return this.#toolsCache.tools;
    await this.#ensureStarted();
    const byName = new Map<string, McpToolDefinition>();
    let catalogBytes = 0;
    const cursors = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
      const result = await this.#request(
        "tools/list",
        cursor ? { cursor } : {},
      );
      for (const tool of toolDefinitions(this.serverName, result.tools)) {
        if (byName.has(tool.name)) continue;
        catalogBytes += Buffer.byteLength(JSON.stringify(tool), "utf8");
        if (catalogBytes > MAX_TOOL_CATALOG_BYTES)
          throw new Error(
            `MCP server "${this.serverName}" exceeded the ${MAX_TOOL_CATALOG_BYTES}-byte tool catalog limit`,
          );
        byName.set(tool.name, tool);
      }
      if (byName.size > MAX_TOOLS_PER_SERVER)
        throw new Error(
          `MCP server "${this.serverName}" exceeded ${MAX_TOOLS_PER_SERVER} tools`,
        );
      const next =
        typeof result.nextCursor === "string" && result.nextCursor
          ? result.nextCursor
          : undefined;
      if (!next) break;
      if (cursors.has(next))
        throw new Error(`MCP server "${this.serverName}" repeated a cursor`);
      cursors.add(next);
      cursor = next;
      if (page === MAX_TOOL_PAGES - 1)
        throw new Error(
          `MCP server "${this.serverName}" exceeded ${MAX_TOOL_PAGES} tool pages`,
        );
    }
    const tools = [...byName.values()];
    this.#toolsCache = { tools, at: Date.now() };
    return tools;
  }

  async callTool(name: string, args: JsonObject): Promise<string> {
    await this.#ensureStarted();
    const result = await this.#request("tools/call", {
      name,
      arguments: args,
    });
    const parts = (Array.isArray(result.content) ? result.content : [])
      .filter(isObject)
      .map((entry) =>
        typeof entry.text === "string" ? entry.text : JSON.stringify(entry),
      );
    const text = parts.join("\n") || JSON.stringify(result);
    if (result.isError === true)
      throw new Error(text.slice(0, 2_000) || "MCP tool reported an error");
    return text;
  }

  dispose(): void {
    for (const controller of this.#activeControllers) controller.abort();
    this.#activeControllers.clear();
    this.#sessionId = null;
    this.#initialized = null;
    this.#toolsCache = null;
  }
}

type AnyMcpConnection = McpConnection | RemoteMcpConnection;

export class LocalMcpManager {
  #connections = new Map<string, AnyMcpConnection>();
  readonly #status = new Map<string, "connected" | "error">();
  #additionalConfigs: Record<string, unknown> = {};

  constructor(
    private readonly readConfigs: () => Record<string, unknown>,
    private readonly readRemoteServers: () => Array<{
      uuid?: string;
      name: string;
      url: string;
    }> = () => [],
    private readonly remoteAuthorization: (
      serverUuid: string,
      forceRefresh?: boolean,
    ) => Promise<string | null> = async () => null,
    private readonly readAdditionalConfigs: () => Promise<
      Record<string, unknown>
    > = async () => ({}),
  ) {}

  async #refreshAdditionalConfigs(): Promise<void> {
    try {
      const configs = await this.readAdditionalConfigs();
      this.#additionalConfigs = isObject(configs) ? configs : {};
    } catch {
      this.#additionalConfigs = {};
    }
  }

  // The Connectors page's per-server connection state; null until a listing
  // has been attempted.
  statusFor(name: string): "connected" | "error" | null {
    this.#sync();
    return this.#status.get(name) ?? null;
  }

  // A changed connector list warms connections so status is fresh soon.
  remoteServersChanged(): void {
    void this.listTools().catch(() => undefined);
  }

  #sync(): AnyMcpConnection[] {
    const configs = {
      ...this.#additionalConfigs,
      ...this.readConfigs(),
    };
    const active: AnyMcpConnection[] = [];
    const seen = new Set<string>();
    for (const remote of this.readRemoteServers().slice(
      0,
      MAX_CONFIGURED_SERVERS,
    )) {
      const remoteUrl = normalizedRemoteMcpUrl(remote.url);
      if (
        !remote.name ||
        remote.name.length > 256 ||
        remote.name.includes("\0") ||
        !remote.url ||
        remote.url.length > 8_192 ||
        remote.url.includes("\0") ||
        !remoteUrl ||
        seen.has(remote.name)
      )
        continue;
      const serverUuid = remote.uuid || remote.name;
      const signature = JSON.stringify(["remote", serverUuid, remoteUrl]);
      seen.add(remote.name);
      const existing = this.#connections.get(remote.name);
      if (existing && existing.configSignature === signature) {
        active.push(existing);
        continue;
      }
      existing?.dispose();
      this.#status.delete(remote.name);
      const connection = new RemoteMcpConnection(
        remote.name,
        remoteUrl,
        signature,
        (forceRefresh) => this.remoteAuthorization(serverUuid, forceRefresh),
      );
      this.#connections.set(remote.name, connection);
      active.push(connection);
    }
    for (const [name, raw] of Object.entries(configs ?? {}).slice(
      0,
      MAX_CONFIGURED_SERVERS,
    )) {
      if (
        !name ||
        name.length > 256 ||
        name.includes("\0") ||
        !isObject(raw) ||
        seen.has(name)
      )
        continue;
      const configUrl =
        typeof raw.url === "string" && raw.url.length <= MAX_COMMAND_CHARS
          ? normalizedRemoteMcpUrl(expandEnvironment(raw.url))
          : null;
      if (configUrl && raw.disabled !== true && raw.enabled !== false) {
        const headers = remoteHeaders(raw.headers);
        const signature = JSON.stringify([
          "configured-remote",
          configUrl,
          headers,
        ]);
        seen.add(name);
        const existing = this.#connections.get(name);
        if (existing && existing.configSignature === signature) {
          active.push(existing);
          continue;
        }
        existing?.dispose();
        this.#status.delete(name);
        const connection = new RemoteMcpConnection(
          name,
          configUrl,
          signature,
          async () => null,
          headers,
        );
        this.#connections.set(name, connection);
        active.push(connection);
        continue;
      }
      const command =
        typeof raw.command === "string" &&
        raw.command.length <= MAX_COMMAND_CHARS &&
        !raw.command.includes("\0")
          ? expandEnvironment(raw.command)
          : "";
      if (!command) continue;
      if (raw.disabled === true || raw.enabled === false) continue;
      const args = Array.isArray(raw.args)
        ? raw.args
            .filter(
              (entry): entry is string =>
                typeof entry === "string" &&
                entry.length <= MAX_COMMAND_CHARS &&
                !entry.includes("\0"),
            )
            .slice(0, MAX_SERVER_ARGS)
            .map(expandEnvironment)
        : [];
      const env = isObject(raw.env)
        ? Object.fromEntries(
            Object.entries(raw.env)
              .filter(
                (entry): entry is [string, string] =>
                  Boolean(entry[0]) &&
                  entry[0].length <= 256 &&
                  !entry[0].includes("\0") &&
                  typeof entry[1] === "string" &&
                  entry[1].length <= 32_768 &&
                  !entry[1].includes("\0"),
              )
              .slice(0, MAX_SERVER_ENVIRONMENT)
              .map(([key, value]) => [key, expandEnvironment(value)]),
          )
        : {};
      const signature = JSON.stringify([command, args, env]);
      seen.add(name);
      const existing = this.#connections.get(name);
      if (existing && existing.configSignature === signature) {
        active.push(existing);
        continue;
      }
      existing?.dispose();
      this.#status.delete(name);
      const connection = new McpConnection(name, command, args, env, signature);
      this.#connections.set(name, connection);
      active.push(connection);
    }
    for (const [name, connection] of this.#connections)
      if (!seen.has(name)) {
        connection.dispose();
        this.#connections.delete(name);
        this.#status.delete(name);
      }
    return active;
  }

  // Aggregated tool list; a failing server is skipped so chat never breaks.
  async listTools(): Promise<McpToolDefinition[]> {
    await this.#refreshAdditionalConfigs();
    const connections = this.#sync();
    const results = await Promise.allSettled(
      connections.map((connection) => connection.listTools()),
    );
    results.forEach((result, index) => {
      const connection = connections[index];
      // A configuration refresh can replace a connection while its old
      // listing is still resolving. Never let that stale result overwrite
      // the new server's status.
      if (this.#connections.get(connection.serverName) === connection)
        this.#status.set(
          connection.serverName,
          result.status === "fulfilled" ? "connected" : "error",
        );
    });
    const tools = results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    if (tools.length > MAX_AGGREGATED_TOOLS)
      throw new Error(
        `Configured MCP servers exposed more than ${MAX_AGGREGATED_TOOLS} tools`,
      );
    return tools;
  }

  async callTool(qualifiedName: string, args: JsonObject): Promise<string> {
    const tools = await this.listTools();
    const tool = tools.find((entry) => entry.qualifiedName === qualifiedName);
    if (!tool) throw new Error(`Unknown MCP tool: ${qualifiedName}`);
    const connection = this.#connections.get(tool.server);
    if (!connection) throw new Error(`MCP server "${tool.server}" is gone`);
    return connection.callTool(tool.name, args);
  }

  disposeAll(): void {
    for (const connection of this.#connections.values()) connection.dispose();
    this.#connections.clear();
    this.#status.clear();
  }
}
