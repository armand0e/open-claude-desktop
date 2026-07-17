// A minimal MCP (Model Context Protocol) client for chat mode: spawns the
// user's configured stdio servers, speaks newline-delimited JSON-RPC, and
// exposes their tools to the local chat loop as OpenAI-style functions.

import { ChildProcess, spawn } from "node:child_process";

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

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function qualifiedToolName(server: string, tool: string): string {
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mcp__${clean(server)}__${clean(tool)}`;
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
    this.#initialized = (async () => {
      const child = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.env },
        windowsHide: true,
        shell: process.platform === "win32",
      });
      this.#child = child;
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => this.#onData(chunk));
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", () => undefined);
      child.on("exit", () => {
        const error = new Error(
          `MCP server "${this.serverName}" exited unexpectedly`,
        );
        for (const pending of this.#pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        this.#pending.clear();
        this.#child = null;
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
      await spawned;
      await this.#request("initialize", {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "open-claude", version: "0.0.1" },
      });
      this.#notify("notifications/initialized", {});
    })();
    this.#initialized.catch(() => {
      this.#initialized = null;
    });
    return this.#initialized;
  }

  #onData(chunk: string): void {
    this.#buffer += chunk;
    let newline = this.#buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.#buffer.slice(0, newline).trim();
      this.#buffer = this.#buffer.slice(newline + 1);
      newline = this.#buffer.indexOf("\n");
      if (!line) continue;
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

  #write(payload: JsonObject): void {
    this.#child?.stdin?.write(`${JSON.stringify(payload)}\n`);
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
      this.#write({ jsonrpc: "2.0", id, method, params });
    });
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (this.#toolsCache && Date.now() - this.#toolsCache.at < TOOLS_CACHE_MS)
      return this.#toolsCache.tools;
    await this.#ensureStarted();
    const result = await this.#request("tools/list", {});
    const tools = (Array.isArray(result.tools) ? result.tools : [])
      .filter(isObject)
      .flatMap((tool) => {
        const name = typeof tool.name === "string" ? tool.name : "";
        if (!name) return [];
        return [
          {
            server: this.serverName,
            name,
            qualifiedName: qualifiedToolName(this.serverName, name),
            description:
              typeof tool.description === "string" ? tool.description : "",
            inputSchema: isObject(tool.inputSchema)
              ? tool.inputSchema
              : { type: "object", properties: {} },
          },
        ];
      });
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
    this.#child?.kill();
    this.#child = null;
    this.#initialized = null;
    this.#toolsCache = null;
  }
}

export class LocalMcpManager {
  #connections = new Map<string, McpConnection>();

  constructor(private readonly readConfigs: () => Record<string, unknown>) {}

  #sync(): McpConnection[] {
    const configs = this.readConfigs();
    const active: McpConnection[] = [];
    const seen = new Set<string>();
    for (const [name, raw] of Object.entries(configs ?? {})) {
      if (!isObject(raw)) continue;
      const command = typeof raw.command === "string" ? raw.command : "";
      if (!command) continue;
      if (raw.disabled === true || raw.enabled === false) continue;
      const args = Array.isArray(raw.args)
        ? raw.args.filter((entry): entry is string => typeof entry === "string")
        : [];
      const env = isObject(raw.env)
        ? Object.fromEntries(
            Object.entries(raw.env).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
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
      const connection = new McpConnection(name, command, args, env, signature);
      this.#connections.set(name, connection);
      active.push(connection);
    }
    for (const [name, connection] of this.#connections)
      if (!seen.has(name)) {
        connection.dispose();
        this.#connections.delete(name);
      }
    return active;
  }

  // Aggregated tool list; a failing server is skipped so chat never breaks.
  async listTools(): Promise<McpToolDefinition[]> {
    const connections = this.#sync();
    const results = await Promise.allSettled(
      connections.map((connection) => connection.listTools()),
    );
    return results.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
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
  }
}
