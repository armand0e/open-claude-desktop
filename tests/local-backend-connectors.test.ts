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
