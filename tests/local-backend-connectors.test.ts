import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalBackend } from "../src/main/local-backend";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function call(
  backend: LocalBackend,
  pathName: string,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(`app://localhost${pathName}`);
  const response = await backend.handle(new Request(url, init), url);
  if (!response) throw new Error(`Unhandled route: ${pathName}`);
  return response;
}

async function backendInTemp(): Promise<LocalBackend> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "connectors-"));
  temporaryDirectories.push(directory);
  return LocalBackend.create(directory);
}

const BASE = "/api/organizations/local/mcp/remote_servers";

describe("remote MCP connector endpoints", () => {
  it("serves native Directory connector and skill contracts locally", async () => {
    const backend = await backendInTemp();
    backend.setSkillSource({
      list: async () => [
        {
          name: "skill-creator",
          description: "Create and improve reusable skills.",
        },
      ],
      read: async () => "# Skill Creator",
    });

    const connectorResponse = await call(
      backend,
      "/mcp-registry/v0/servers?version=latest&limit=4",
    );
    const connectorPayload = (await connectorResponse.json()) as {
      servers: Array<Record<string, unknown>>;
      metadata: Record<string, unknown>;
    };
    expect(connectorPayload.servers).toHaveLength(4);
    expect(connectorPayload.servers[0]).toMatchObject({
      server: {
        name: "local.open-claude/gmail",
        title: "Gmail",
        remotes: [
          {
            type: "streamable-http",
            url: "https://gmailmcp.googleapis.com/mcp/v1",
          },
        ],
      },
      _meta: {
        "com.anthropic.api/mcp-registry": {
          type: "remote",
          worksWith: expect.arrayContaining(["claude-code"]),
        },
      },
    });
    expect(connectorPayload.servers[3]).toMatchObject({
      server: { title: expect.any(String), remotes: expect.any(Array) },
      _meta: {
        "com.anthropic.api/mcp-registry": {
          type: "remote",
          source_feed: "official-mcp-registry",
        },
      },
    });
    expect(connectorPayload.metadata.nextCursor).toEqual(expect.any(String));

    const skillResponse = await call(
      backend,
      "/api/organizations/test-org/skills/list-skills?include_wiggle_skills=true",
    );
    expect(await skillResponse.json()).toEqual({ skills: [] });
  });

  it("creates, lists, updates, and deletes RAe-shaped records", async () => {
    const backend = await backendInTemp();
    const changed: string[] = [];
    backend.setRemoteMcpHooks({
      status: () => "connected",
      changed: () => changed.push("changed"),
    });

    const created = (await (
      await call(backend, BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "docs", url: "http://127.0.0.1:9999/" }),
      })
    ).json()) as Record<string, unknown>;
    expect(created.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe("docs");
    // RAe requires strict ISO datetimes.
    expect(String(created.created_at)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
    expect(created.is_authenticated).toBe(false);
    expect(changed).toEqual(["changed"]);

    const listed = (await (await call(backend, BASE)).json()) as Array<
      Record<string, unknown>
    >;
    expect(listed).toHaveLength(1);
    expect(listed[0].uuid).toBe(created.uuid);
    // The plain list omits connection fields; with_connection includes them.
    expect("connection_state" in listed[0]).toBe(false);
    const withConnection = (await (
      await call(backend, `${BASE}_with_connection`)
    ).json()) as Array<Record<string, unknown>>;
    expect(withConnection[0].connection_state).toBe("connected");
    expect(withConnection[0]).toHaveProperty("connection_auth_type", null);

    const updated = (await (
      await call(backend, `${BASE}/${created.uuid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "docs-2" }),
      })
    ).json()) as Record<string, unknown>;
    expect(updated.name).toBe("docs-2");
    expect(backend.remoteMcpServers()).toEqual([
      expect.objectContaining({ name: "docs-2" }),
    ]);
    expect(changed).toEqual(["changed", "changed"]);

    const removed = await call(backend, `${BASE}/${created.uuid}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(204);
    expect(backend.remoteMcpServers()).toEqual([]);
    expect(changed).toEqual(["changed", "changed", "changed"]);
    const gone = await call(backend, `${BASE}/${created.uuid}`);
    expect(gone.status).toBe(404);
  });

  it("rejects invalid connector URLs and incomplete payloads", async () => {
    const backend = await backendInTemp();
    for (const body of [
      { name: "x" },
      { url: "http://127.0.0.1/" },
      { name: "x", url: "file:///etc/passwd" },
      { name: "x", url: "not a url" },
      { name: "x", url: "https://user:secret@example.com/mcp" },
    ]) {
      const response = await call(backend, BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(backend.remoteMcpServers()).toEqual([]);
  });

  it("rejects duplicate names and invalid updates without partial mutation", async () => {
    const backend = await backendInTemp();
    const first = (await (
      await call(backend, BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "one", url: "http://127.0.0.1:9001" }),
      })
    ).json()) as Record<string, unknown>;
    expect(
      (
        await call(backend, BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "one", url: "http://127.0.0.1:9002" }),
        })
      ).status,
    ).toBe(409);
    const invalidUpdate = await call(backend, `${BASE}/${first.uuid}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "partially changed", url: "file:///bad" }),
    });
    expect(invalidUpdate.status).toBe(400);
    expect(backend.remoteMcpServers()).toEqual([
      expect.objectContaining({
        name: "one",
        url: "http://127.0.0.1:9001/",
      }),
    ]);
  });

  it("locks OAuth presets to official endpoints and exposes local auth state", async () => {
    const backend = await backendInTemp();
    backend.setRemoteMcpHooks({
      status: () => null,
      changed: () => undefined,
      authentication: () => ({
        preset: "gmail",
        clientId: "local-client-id",
        authenticated: true,
        pending: false,
        access: "read",
        error: null,
      }),
    });
    const wrongEndpoint = await call(backend, BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "phish",
        url: "https://example.com/mcp",
        preset: "gmail",
      }),
    });
    expect(wrongEndpoint.status).toBe(400);

    const created = (await (
      await call(backend, BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Gmail",
          url: "https://gmailmcp.googleapis.com/mcp/v1",
        }),
      })
    ).json()) as Record<string, unknown>;
    expect(created).toMatchObject({ preset: "gmail" });
    const connected = (await (
      await call(backend, `${BASE}_with_connection`)
    ).json()) as Array<Record<string, unknown>>;
    expect(connected[0]).toMatchObject({
      is_authenticated: true,
      custom_oauth_client_id: "local-client-id",
      oauth_access: "read",
      connection_auth_type: "oauth",
    });
  });

  it("defaults connection_state to initiated before the first listing", async () => {
    const backend = await backendInTemp();
    await call(backend, BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "warm", url: "http://127.0.0.1:9998/" }),
    });
    const withConnection = (await (
      await call(backend, `${BASE}_with_connection`)
    ).json()) as Array<Record<string, unknown>>;
    expect(withConnection[0].connection_state).toBe("initiated");
  });

  it("persists connectors across backend restarts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "connectors-"));
    temporaryDirectories.push(directory);
    const backend = await LocalBackend.create(directory);
    await call(backend, BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sticky", url: "http://127.0.0.1:9997/" }),
    });
    const reloaded = await LocalBackend.create(directory);
    expect(reloaded.remoteMcpServers()).toEqual([
      expect.objectContaining({ name: "sticky" }),
    ]);
  });
});
