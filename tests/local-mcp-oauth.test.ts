import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMcpManager } from "../src/main/local-mcp";
import {
  CONNECTOR_OAUTH_PRESETS,
  LocalMcpOAuthManager,
  type ConnectorOAuthPreset,
} from "../src/main/local-mcp-oauth";

const temporaryDirectories: string[] = [];
const oauthManagers: LocalMcpOAuthManager[] = [];
const mcpManagers: LocalMcpManager[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const manager of mcpManagers.splice(0)) manager.disposeAll();
  for (const manager of oauthManagers.splice(0)) manager.dispose();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const codec = {
  seal: (value: string) =>
    Buffer.from(`sealed:${value}`, "utf8").toString("base64"),
  open: (value: string) => {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    if (!decoded.startsWith("sealed:")) throw new Error("Invalid seal");
    return decoded.slice(7);
  },
};

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mcp-oauth-"));
  temporaryDirectories.push(directory);
  return directory;
}

function testPreset(id: "gmail" | "slack"): ConnectorOAuthPreset {
  const base = CONNECTOR_OAUTH_PRESETS.find((preset) => preset.id === id)!;
  return {
    ...base,
    serverUrl: `https://${id}.connector.test/mcp`,
    authorizationEndpoint: `https://${id}.accounts.test/authorize`,
    tokenEndpoint: `https://${id}.accounts.test/token`,
  };
}

async function protectedMcpServer(): Promise<{
  url: string;
  authorizations: Array<string | undefined>;
}> {
  const authorizations: Array<string | undefined> = [];
  const server = createServer(async (request, response) => {
    authorizations.push(request.headers.authorization);
    if (request.headers.authorization !== "Bearer access-two") {
      response.writeHead(401).end();
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const message = JSON.parse(raw) as Record<string, unknown>;
    if (message.method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    }
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "protected", version: "1" },
          }
        : message.method === "tools/list"
          ? {
              tools: [
                {
                  name: "private_search",
                  description: "Search private data",
                  inputSchema: { type: "object", properties: {} },
                },
              ],
            }
          : { content: [{ type: "text", text: "private result" }] };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return { url: `http://127.0.0.1:${address.port}/mcp`, authorizations };
}

describe("local MCP OAuth", () => {
  it("completes PKCE locally, encrypts credentials, refreshes on 401, and calls MCP", async () => {
    const directory = await temporaryDirectory();
    const preset = testPreset("gmail");
    const tokenForms: URLSearchParams[] = [];
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const form = new URLSearchParams(String(init?.body ?? ""));
      tokenForms.push(form);
      return Response.json(
        form.get("grant_type") === "refresh_token"
          ? { access_token: "access-two", expires_in: 3600 }
          : {
              access_token: "access-one",
              refresh_token: "refresh-secret",
              expires_in: 3600,
              token_type: "Bearer",
            },
      );
    }) as typeof fetch;
    const oauth = await LocalMcpOAuthManager.create(directory, codec, {
      presets: [preset],
      fetcher,
    });
    oauthManagers.push(oauth);
    const connector = {
      uuid: "gmail-connector",
      name: "Gmail",
      url: preset.serverUrl,
      preset: "gmail",
    };
    const started = await oauth.start(connector, {
      preset: "gmail",
      clientId: "desktop-client-id",
      clientSecret: "client-secret",
      access: "read",
    });
    const authorization = new URL(String(started.authorizationUrl));
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorization.searchParams.get("scope")).toContain("gmail.readonly");
    const callback = new URL(String(started.redirectUri));
    callback.searchParams.set("code", "provider-code");
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("state")!,
    );
    expect((await fetch(callback)).status).toBe(200);
    expect(oauth.stateFor(connector.uuid)).toMatchObject({
      authenticated: true,
      pending: false,
      access: "read",
    });
    expect(tokenForms[0].get("code_verifier")).toBeTruthy();
    expect(tokenForms[0].get("client_secret")).toBe("client-secret");

    const stored = await readFile(
      path.join(directory, "local-mcp-oauth.json"),
      "utf8",
    );
    expect(stored).not.toContain("access-one");
    expect(stored).not.toContain("refresh-secret");
    expect(stored).not.toContain("client-secret");

    const protectedServer = await protectedMcpServer();
    const mcp = new LocalMcpManager(
      () => ({}),
      () => [
        {
          uuid: connector.uuid,
          name: connector.name,
          url: protectedServer.url,
        },
      ],
      (uuid, forceRefresh) => oauth.authorizationFor(uuid, forceRefresh),
    );
    mcpManagers.push(mcp);
    await expect(mcp.listTools()).resolves.toEqual([
      expect.objectContaining({
        qualifiedName: "mcp__Gmail__private_search",
      }),
    ]);
    expect(protectedServer.authorizations.slice(0, 2)).toEqual([
      "Bearer access-one",
      "Bearer access-two",
    ]);
    expect(tokenForms.at(-1)?.get("grant_type")).toBe("refresh_token");
    await expect(mcp.callTool("mcp__Gmail__private_search", {})).resolves.toBe(
      "private result",
    );
  });

  it("rejects a callback with the wrong state and never stores a token", async () => {
    const directory = await temporaryDirectory();
    const preset = testPreset("gmail");
    let tokenRequests = 0;
    const oauth = await LocalMcpOAuthManager.create(directory, codec, {
      presets: [preset],
      fetcher: (async () => {
        tokenRequests += 1;
        return Response.json({ access_token: "access-after-valid-state" });
      }) as typeof fetch,
    });
    oauthManagers.push(oauth);
    const started = await oauth.start(
      {
        uuid: "wrong-state",
        name: "Gmail",
        url: preset.serverUrl,
        preset: "gmail",
      },
      { preset: "gmail", clientId: "client-id" },
    );
    const callback = new URL(String(started.redirectUri));
    callback.searchParams.set("code", "provider-code");
    callback.searchParams.set("state", "attacker-state");
    expect((await fetch(callback)).status).toBe(400);
    expect(tokenRequests).toBe(0);
    expect(await oauth.authorizationFor("wrong-state")).toBeNull();
    expect(oauth.stateFor("wrong-state")).toMatchObject({
      authenticated: false,
      pending: true,
      error: null,
    });
    const authorization = new URL(String(started.authorizationUrl));
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("state")!,
    );
    expect((await fetch(callback)).status).toBe(200);
    expect(tokenRequests).toBe(1);
    expect(await oauth.authorizationFor("wrong-state")).toBe(
      "access-after-valid-state",
    );
  });

  it("uses Slack's user scopes and completes through the app deep link", async () => {
    const directory = await temporaryDirectory();
    const preset = testPreset("slack");
    const oauth = await LocalMcpOAuthManager.create(directory, codec, {
      presets: [preset],
      fetcher: (async () =>
        Response.json({
          ok: true,
          authed_user: {
            access_token: "slack-user-token",
            refresh_token: "slack-refresh-token",
            expires_in: 3600,
          },
        })) as typeof fetch,
    });
    oauthManagers.push(oauth);
    const started = await oauth.start(
      {
        uuid: "slack-connector",
        name: "Slack",
        url: preset.serverUrl,
        preset: "slack",
      },
      { preset: "slack", clientId: "slack-client", access: "read-write" },
    );
    const authorization = new URL(String(started.authorizationUrl));
    expect(authorization.searchParams.get("user_scope")).toContain(
      "chat:write",
    );
    expect(started.redirectUri).toBe("open-claude://oauth/slack");
    const callback = new URL(String(started.redirectUri));
    callback.searchParams.set("code", "slack-code");
    callback.searchParams.set(
      "state",
      authorization.searchParams.get("state")!,
    );
    await expect(oauth.handleCallbackUrl(callback.toString())).resolves.toBe(
      true,
    );
    expect(await oauth.authorizationFor("slack-connector")).toBe(
      "slack-user-token",
    );
  });

  it("fails closed when operating-system credential encryption is unavailable", async () => {
    const preset = testPreset("gmail");
    const oauth = await LocalMcpOAuthManager.create(
      await temporaryDirectory(),
      undefined,
      { presets: [preset] },
    );
    oauthManagers.push(oauth);
    await expect(
      oauth.start(
        {
          uuid: "no-crypto",
          name: "Gmail",
          url: preset.serverUrl,
          preset: "gmail",
        },
        { preset: "gmail", clientId: "client-id" },
      ),
    ).rejects.toThrow(/credential storage is unavailable/i);
  });
});
