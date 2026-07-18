// Bridges the renderer's in-page MCP client to stdio server processes. The
// retained client owns its own MCP connections for the Connectors surface:
// it asks the shell to connect a configured server and receives a transferred
// MessagePort speaking raw JSON-RPC message objects, while the server child
// speaks newline-delimited JSON-RPC over stdio. This bridge pumps between
// the two, one child per server name per renderer.

import { ChildProcess, spawn } from "node:child_process";
import { MessageChannelMain, MessagePortMain, WebContents } from "electron";

interface BridgeEntry {
  child: ChildProcess;
  port: MessagePortMain;
}

function trace(direction: string, name: string, payload: unknown): void {
  if (process.env.CLAUDE_TRACE_MCP_BRIDGE === "1")
    console.error(
      `[mcp-bridge:${direction}] ${name} ${JSON.stringify(payload).slice(0, 400)}`,
    );
}

export class LocalMcpPortBridge {
  #bridges = new Map<string, BridgeEntry>();

  constructor(
    private readonly readConfigs: () => Record<string, unknown>,
  ) {}

  connect(target: WebContents, name: string): void {
    const raw = this.readConfigs()?.[name];
    if (!raw || typeof raw !== "object")
      throw new Error(`Unknown MCP server "${name}"`);
    const config = raw as Record<string, unknown>;
    const command = typeof config.command === "string" ? config.command : "";
    if (!command) throw new Error(`MCP server "${name}" has no command`);
    if (config.disabled === true || config.enabled === false)
      throw new Error(`MCP server "${name}" is disabled`);
    // A reconnect for the same server replaces the previous child so the
    // renderer's new transport is the only consumer.
    this.#dispose(name);
    const args = Array.isArray(config.args)
      ? config.args.filter((entry): entry is string => typeof entry === "string")
      : [];
    const env =
      config.env && typeof config.env === "object"
        ? Object.fromEntries(
            Object.entries(config.env as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {};
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const { port1, port2 } = new MessageChannelMain();
    let buffer = "";
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!line) continue;
        try {
          const message: unknown = JSON.parse(line);
          trace("server->renderer", name, message);
          port1.postMessage(message);
        } catch {
          // Non-JSON stdout lines (logging) are ignored.
        }
      }
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => trace("stderr", name, chunk));
    child.on("spawn", () => trace("spawned", name, { pid: child.pid }));
    port1.on("message", (event) => {
      trace("renderer->server", name, event.data);
      child.stdin?.write(`${JSON.stringify(event.data)}\n`);
    });
    port1.on("close", () => this.#dispose(name));
    child.on("exit", (code, signal) => {
      trace("exit", name, { code, signal });
      const entry = this.#bridges.get(name);
      if (entry?.child === child) {
        this.#bridges.delete(name);
        entry.port.close();
      }
    });
    child.on("error", () => {
      const entry = this.#bridges.get(name);
      if (entry?.child === child) {
        this.#bridges.delete(name);
        entry.port.close();
      }
    });
    port1.start();
    this.#bridges.set(name, { child, port: port1 });
    target.postMessage(
      "mcp-server-connected",
      { serverName: name, uuid: name },
      [port2],
    );
  }

  #dispose(name: string): void {
    const entry = this.#bridges.get(name);
    if (!entry) return;
    this.#bridges.delete(name);
    entry.port.close();
    entry.child.kill();
  }

  disposeAll(): void {
    for (const name of [...this.#bridges.keys()]) this.#dispose(name);
  }
}
