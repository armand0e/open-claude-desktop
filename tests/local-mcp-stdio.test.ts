import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMcpManager } from "../src/main/local-mcp";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("LocalMcpManager stdio transport", () => {
  it("initializes, lists tools, calls a tool, and disposes its child", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-mcp-stdio-"));
    temporaryDirectories.push(directory);
    const serverPath = path.join(directory, "server.cjs");
    await writeFile(
      serverPath,
      `const readline = require("node:readline");
const input = readline.createInterface({ input: process.stdin });
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  let result = {};
  if (message.method === "initialize") {
    result = { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fixture", version: "1" } };
  } else if (message.method === "tools/list") {
    result = { tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] };
  } else if (message.method === "tools/call") {
    result = { content: [{ type: "text", text: "echo:" + message.params.arguments.text }] };
  }
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");
});
`,
      "utf8",
    );
    const manager = new LocalMcpManager(() => ({
      fixture: { command: process.execPath, args: [serverPath] },
    }));
    try {
      const tools = await manager.listTools();
      expect(tools).toEqual([
        expect.objectContaining({
          server: "fixture",
          name: "echo",
          qualifiedName: "mcp__fixture__echo",
        }),
      ]);
      await expect(
        manager.callTool("mcp__fixture__echo", { text: "proof" }),
      ).resolves.toBe("echo:proof");
      expect(manager.statusFor("fixture")).toBe("connected");
    } finally {
      manager.disposeAll();
    }
  });
});
