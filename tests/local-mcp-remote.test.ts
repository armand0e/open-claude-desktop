import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalMcpManager, qualifiedToolName } from "../src/main/local-mcp";
import { growthbookFeatureKey } from "../src/shared/growthbook";

type JsonRecord = Record<string, unknown>;

interface FakeRemoteMcpOptions {
  sse?: boolean;
  requireSession?: boolean;
  status?: number;
  toolIsError?: boolean;
  paginate?: boolean;
  crlf?: boolean;
  keepSseOpen?: boolean;
  wrongId?: boolean;
  stallSse?: boolean;
}

interface FakeRemoteMcp {
  url: string;
  seenMethods: string[];
  sessionHeaders: Array<string | null>;
  close: () => Promise<void>;
}

const servers: FakeRemoteMcp[] = [];
const managers: LocalMcpManager[] = [];

afterEach(async () => {
  for (const manager of managers.splice(0)) manager.disposeAll();
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function fakeRemoteMcp(
  options: FakeRemoteMcpOptions = {},
): Promise<FakeRemoteMcp> {
  const seenMethods: string[] = [];
  const sessionHeaders: Array<string | null> = [];
  const httpServer: Server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    let message: JsonRecord = {};
    try {
      message = JSON.parse(body) as JsonRecord;
    } catch {
      // fall through — treated as unknown method below
    }
    seenMethods.push(String(message.method));
    sessionHeaders.push(request.headers["mcp-session-id"]?.toString() ?? null);
    if (options.status) {
      response.writeHead(options.status).end();
      return;
    }
    const reply = (result: JsonRecord) => {
      const payload = JSON.stringify({
        jsonrpc: "2.0",
        id: options.wrongId ? Number(message.id) + 1 : message.id,
        result,
      });
      if (options.sse) {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Mcp-Session-Id": "session-123",
        });
        // A ping frame first, then the JSON-RPC response frame.
        const newline = options.crlf ? "\r\n" : "\n";
        const frames = options.stallSse
          ? `: keepalive${newline}${newline}`
          : `: keepalive${newline}${newline}event: message${newline}data: ${payload}${newline}${newline}`;
        if (options.keepSseOpen) response.write(frames);
        else response.end(frames);
      } else {
        response.writeHead(200, {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "session-123",
        });
        response.end(payload);
      }
    };
    switch (message.method) {
      case "initialize":
        reply({
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "fake", version: "1.0.0" },
        });
        return;
      case "notifications/initialized":
        response.writeHead(202).end();
        return;
      case "tools/list":
        if (
          options.paginate &&
          (message.params as JsonRecord | undefined)?.cursor === "page-2"
        ) {
          reply({
            tools: [
              {
                name: "second",
                description: "Second page",
                inputSchema: { type: "object", properties: {} },
              },
            ],
          });
        } else {
          reply({
            tools: [
              {
                name: "echo",
                description: "Echo a string",
                inputSchema: {
                  type: "object",
                  properties: { text: { type: "string" } },
                },
              },
              { description: "nameless tool is skipped" },
            ],
            ...(options.paginate ? { nextCursor: "page-2" } : {}),
          });
        }
        return;
      case "tools/call":
        reply(
          options.toolIsError
            ? { content: [{ type: "text", text: "boom" }], isError: true }
            : {
                content: [
                  {
                    type: "text",
                    text: `echo ${String(
                      (message.params as JsonRecord | undefined)?.arguments &&
                        ((message.params as JsonRecord).arguments as JsonRecord)
                          .text,
                    )}`,
                  },
                ],
              },
        );
        return;
      default:
        response.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve) =>
    httpServer.listen(0, "127.0.0.1", resolve),
  );
  const address = httpServer.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fake MCP address");
  const fake: FakeRemoteMcp = {
    url: `http://127.0.0.1:${address.port}/`,
    seenMethods,
    sessionHeaders,
    close: () =>
      new Promise((resolve) => {
        httpServer.closeAllConnections();
        httpServer.close(() => resolve());
      }),
  };
  servers.push(fake);
  return fake;
}

function managerFor(
  remotes: Array<{ name: string; url: string }>,
): LocalMcpManager {
  const manager = new LocalMcpManager(
    () => ({}),
    () => remotes,
  );
  managers.push(manager);
  return manager;
}

describe("remote MCP connectors", () => {
  it("aborts a pending SSE body when the connector is disposed", async () => {
    const remote = await fakeRemoteMcp({
      sse: true,
      keepSseOpen: true,
      stallSse: true,
    });
    const manager = managerFor([{ name: "stalled-sse", url: remote.url }]);
    const listing = manager.listTools();
    await vi.waitFor(() => expect(remote.seenMethods).toContain("initialize"));
    manager.disposeAll();
    await expect(listing).resolves.toEqual([]);
  }, 1500);

  it("loads plugin-provided HTTP MCP configs through the shared tool source", async () => {
    const remote = await fakeRemoteMcp();
    const manager = new LocalMcpManager(
      () => ({}),
      () => [],
      async () => null,
      async () => ({
        "demo-plugin:remote": { type: "http", url: remote.url },
      }),
    );
    managers.push(manager);

    const tools = await manager.listTools();
    expect(tools).toEqual([
      expect.objectContaining({
        server: "demo-plugin:remote",
        name: "echo",
      }),
    ]);
    await expect(
      manager.callTool(tools[0].qualifiedName, { text: "plugin" }),
    ).resolves.toBe("echo plugin");
  });

  it("initializes, lists qualified tools, and round-trips a call", async () => {
    const remote = await fakeRemoteMcp();
    const manager = managerFor([{ name: "probe-connector", url: remote.url }]);

    const tools = await manager.listTools();
    expect(tools.map((tool) => tool.qualifiedName)).toEqual([
      "mcp__probe-connector__echo",
    ]);
    expect(manager.statusFor("probe-connector")).toBe("connected");
    expect(remote.seenMethods.slice(0, 2)).toEqual([
      "initialize",
      "notifications/initialized",
    ]);

    const result = await manager.callTool("mcp__probe-connector__echo", {
      text: "hi",
    });
    expect(result).toBe("echo hi");
    // The session id from the first response must be echoed on later calls.
    expect(remote.sessionHeaders.at(-1)).toBe("session-123");
  });

  it("parses JSON-RPC responses delivered as CRLF SSE frames", async () => {
    const remote = await fakeRemoteMcp({ sse: true, crlf: true });
    const manager = managerFor([{ name: "sse-connector", url: remote.url }]);
    const tools = await manager.listTools();
    expect(tools).toHaveLength(1);
    await expect(
      manager.callTool("mcp__sse-connector__echo", { text: "frame" }),
    ).resolves.toBe("echo frame");
  });

  it("returns when a matching SSE response arrives even if the stream stays open", async () => {
    const remote = await fakeRemoteMcp({ sse: true, keepSseOpen: true });
    const manager = managerFor([{ name: "open-sse", url: remote.url }]);
    await expect(manager.listTools()).resolves.toHaveLength(1);
  });

  it("rejects JSON-RPC responses with a different request id", async () => {
    const remote = await fakeRemoteMcp({ wrongId: true });
    const manager = managerFor([{ name: "wrong-id", url: remote.url }]);
    await expect(manager.listTools()).resolves.toEqual([]);
    expect(manager.statusFor("wrong-id")).toBe("error");
  });

  it("loads every page of a remote tool catalog", async () => {
    const remote = await fakeRemoteMcp({ paginate: true });
    const manager = managerFor([{ name: "paged", url: remote.url }]);
    const tools = await manager.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["echo", "second"]);
    expect(
      remote.seenMethods.filter((method) => method === "tools/list"),
    ).toHaveLength(2);
  });

  it("keeps chat alive when one connector is down", async () => {
    const healthy = await fakeRemoteMcp();
    const manager = managerFor([
      { name: "dead", url: "http://127.0.0.1:9/" },
      { name: "alive", url: healthy.url },
    ]);
    const tools = await manager.listTools();
    expect(tools.map((tool) => tool.qualifiedName)).toEqual([
      "mcp__alive__echo",
    ]);
    expect(manager.statusFor("dead")).toBe("error");
    expect(manager.statusFor("alive")).toBe("connected");
  });

  it("surfaces auth-protected servers as errors instead of hanging", async () => {
    const remote = await fakeRemoteMcp({ status: 401 });
    const manager = managerFor([{ name: "authy", url: remote.url }]);
    const tools = await manager.listTools();
    expect(tools).toEqual([]);
    expect(manager.statusFor("authy")).toBe("error");
  });

  it("rejects redirects and malformed remote endpoint URLs", async () => {
    const redirected = await fakeRemoteMcp({ status: 302 });
    const manager = managerFor([
      { name: "redirected", url: redirected.url },
      { name: "credentials", url: "https://user:secret@example.com/mcp" },
      { name: "script", url: "javascript:alert(1)" },
    ]);
    await expect(manager.listTools()).resolves.toEqual([]);
    expect(manager.statusFor("redirected")).toBe("error");
    expect(manager.statusFor("credentials")).toBeNull();
    expect(manager.statusFor("script")).toBeNull();
  });

  it("turns isError tool results into thrown errors", async () => {
    const remote = await fakeRemoteMcp({ toolIsError: true });
    const manager = managerFor([{ name: "flaky", url: remote.url }]);
    await manager.listTools();
    await expect(
      manager.callTool("mcp__flaky__echo", { text: "x" }),
    ).rejects.toThrow("boom");
  });

  it("invalidates stale status when a connector configuration changes", async () => {
    const first = await fakeRemoteMcp();
    let remotes = [{ name: "changing", url: first.url }];
    const manager = new LocalMcpManager(
      () => ({}),
      () => remotes,
    );
    managers.push(manager);
    await manager.listTools();
    expect(manager.statusFor("changing")).toBe("connected");

    remotes = [{ name: "changing", url: "http://127.0.0.1:9/" }];
    expect(manager.statusFor("changing")).toBeNull();
    await manager.listTools();
    expect(manager.statusFor("changing")).toBe("error");
  });
});

describe("MCP tool names", () => {
  it("keeps names within provider limits without sanitization aliases", () => {
    const first = qualifiedToolName("server one", "tool@name");
    const second = qualifiedToolName("server@one", "tool name");
    expect(first).not.toBe(second);
    expect(first.length).toBeLessThanOrEqual(64);
    expect(second.length).toBeLessThanOrEqual(64);
    expect(qualifiedToolName("safe-server", "safe_tool")).toBe(
      "mcp__safe-server__safe_tool",
    );
    expect(qualifiedToolName("a", "b__c")).not.toBe(
      qualifiedToolName("a__b", "c"),
    );
  });
});

describe("growthbook feature keys", () => {
  it("matches the retained client's hashed feature names", () => {
    // Values cross-checked against the bundle's Mf() on 2026-07-18.
    expect(growthbookFeatureKey("chilling_sloth_clocks")).toBe("2971093051");
    expect(growthbookFeatureKey("papi_mcp")).toBe("1121145733");
    expect(growthbookFeatureKey("papi_disable_mcp_ui")).toBe("4179817925");
  });
});
