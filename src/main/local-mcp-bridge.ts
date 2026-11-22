// Bridges the renderer's in-page MCP client to stdio server processes. The
// retained client owns its own MCP connections for the Connectors surface:
// it asks the shell to connect a configured server and receives a transferred
// MessagePort speaking raw JSON-RPC message objects, while the server child
// speaks newline-delimited JSON-RPC over stdio. This bridge pumps between
// the two, one child per server name per renderer.

import { ChildProcess, spawn } from "node:child_process";
import { MessageChannelMain, MessagePortMain, WebContents } from "electron";
// @ts-expect-error -- untyped CommonJS dependency
import crossSpawn from "cross-spawn";
import { childEnvironment } from "./child-environment";

interface BridgeEntry {
  child: ChildProcess;
  port: MessagePortMain;
}

const MAX_BRIDGE_MESSAGE_BYTES = 8 * 1024 * 1024;
const MAX_BRIDGE_QUEUED_BYTES = 16 * 1024 * 1024;

function terminateChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
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

function trace(direction: string, name: string, payload: unknown): void {
  if (process.env.CLAUDE_TRACE_MCP_BRIDGE === "1") {
    const encoded = JSON.stringify(payload);
    console.error(
      `[mcp-bridge:${direction}] ${name} ${String(encoded ?? payload).slice(0, 400)}`,
    );
  }
}

export class LocalMcpPortBridge {
  #bridges = new Map<string, BridgeEntry>();

  constructor(private readonly readConfigs: () => Record<string, unknown>) {}

  connect(target: WebContents, name: string): void {
    if (!name || name.length > 256 || name.includes("\0"))
      throw new Error("Invalid MCP server name");
    const configs = this.readConfigs();
    const raw = Object.prototype.hasOwnProperty.call(configs, name)
      ? configs[name]
      : undefined;
    if (!raw || typeof raw !== "object")
      throw new Error(`Unknown MCP server "${name}"`);
    const config = raw as Record<string, unknown>;
    const command =
      typeof config.command === "string" &&
      config.command.length <= 8_192 &&
      !config.command.includes("\0")
        ? config.command
        : "";
    if (!command) throw new Error(`MCP server "${name}" has no command`);
    if (config.disabled === true || config.enabled === false)
      throw new Error(`MCP server "${name}" is disabled`);
    // A reconnect replaces only this renderer's previous child. Other app
    // windows have independent MessagePorts and must not evict one another.
    const bridgeKey = `${target.id}:${name}`;
    this.#dispose(bridgeKey);
    const args = Array.isArray(config.args)
      ? config.args
          .filter(
            (entry): entry is string =>
              typeof entry === "string" &&
              entry.length <= 8_192 &&
              !entry.includes("\0"),
          )
          .slice(0, 128)
      : [];
    const env =
      config.env && typeof config.env === "object"
        ? Object.fromEntries(
            Object.entries(config.env as Record<string, unknown>)
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
          )
        : {};
    const child = crossSpawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnvironment(env),
      windowsHide: true,
    }) as ChildProcess;
    const { port1, port2 } = new MessageChannelMain();
    let buffer = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const rawLine = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (Buffer.byteLength(rawLine, "utf8") > MAX_BRIDGE_MESSAGE_BYTES) {
          trace("error", name, "stdout message exceeded safety limit");
          this.#dispose(bridgeKey);
          return;
        }
        const line = rawLine.trim();
        if (!line) continue;
        try {
          const message: unknown = JSON.parse(line);
          trace("server->renderer", name, message);
          port1.postMessage(message);
        } catch {
          // Non-JSON stdout lines (logging) are ignored.
        }
      }
      if (Buffer.byteLength(buffer, "utf8") > MAX_BRIDGE_MESSAGE_BYTES) {
        trace("error", name, "stdout message exceeded safety limit");
        this.#dispose(bridgeKey);
      }
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => trace("stderr", name, chunk));
    child.stdin?.on("error", (error) => {
      trace("error", name, error);
      if (this.#bridges.get(bridgeKey)?.child === child)
        this.#dispose(bridgeKey);
    });
    child.on("spawn", () => trace("spawned", name, { pid: child.pid }));
    port1.on("message", (event) => {
      try {
        const serialized = JSON.stringify(event.data);
        if (serialized === undefined)
          throw new Error("MCP bridge message is not JSON serializable");
        const messageBytes = Buffer.byteLength(serialized, "utf8");
        if (messageBytes > MAX_BRIDGE_MESSAGE_BYTES)
          throw new Error("MCP bridge message exceeded safety limit");
        if (
          (child.stdin?.writableLength ?? 0) + messageBytes >
          MAX_BRIDGE_QUEUED_BYTES
        )
          throw new Error("MCP bridge input queue exceeded safety limit");
        trace("renderer->server", name, event.data);
        if (!child.stdin?.writable)
          throw new Error("MCP bridge server input is not writable");
        child.stdin.write(`${serialized}\n`, (error) => {
          if (!error || this.#bridges.get(bridgeKey)?.child !== child) return;
          trace("error", name, error);
          this.#dispose(bridgeKey);
        });
      } catch (error) {
        trace("error", name, error);
        this.#dispose(bridgeKey);
      }
    });
    port1.on("close", () => this.#dispose(bridgeKey));
    child.on("exit", (code, signal) => {
      trace("exit", name, { code, signal });
      const entry = this.#bridges.get(bridgeKey);
      if (entry?.child === child) {
        this.#bridges.delete(bridgeKey);
        entry.port.close();
      }
    });
    child.on("error", () => {
      const entry = this.#bridges.get(bridgeKey);
      if (entry?.child === child) {
        this.#bridges.delete(bridgeKey);
        entry.port.close();
      }
    });
    port1.start();
    this.#bridges.set(bridgeKey, { child, port: port1 });
    try {
      target.postMessage(
        "mcp-server-connected",
        { serverName: name, uuid: name },
        [port2],
      );
    } catch (error) {
      this.#dispose(bridgeKey);
      port2.close();
      throw error;
    }
  }

  #dispose(key: string): void {
    const entry = this.#bridges.get(key);
    if (!entry) return;
    this.#bridges.delete(key);
    entry.port.close();
    terminateChild(entry.child);
  }

  disposeAll(): void {
    for (const key of [...this.#bridges.keys()]) this.#dispose(key);
  }
}
