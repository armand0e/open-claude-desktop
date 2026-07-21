// Refresh the bundled, account-independent connector directory from the
// official MCP Registry. This is a maintainer action only: the desktop app
// serves the generated snapshot to the retained native Directory and never
// polls a directory service at runtime.

import { writeFile } from "node:fs/promises";
import path from "node:path";

const REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const headers = {
  Accept: "application/json",
  "User-Agent": "Open-Claude-Connector-Snapshot",
};

const servers = [];
let cursor;
for (let page = 0; page < MAX_PAGES; page += 1) {
  const url = new URL(REGISTRY);
  url.searchParams.set("version", "latest");
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetch(url, { headers, redirect: "error" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.servers))
    throw new Error("The official MCP Registry returned an invalid page.");
  for (const entry of payload.servers) {
    const server = entry?.server;
    if (!server || typeof server.name !== "string") continue;
    const remote = Array.isArray(server.remotes)
      ? server.remotes.find(
          (candidate) =>
            candidate &&
            (candidate.type === "streamable-http" ||
              candidate.type === "sse") &&
            typeof candidate.url === "string",
        )
      : undefined;
    if (!remote) continue;
    const repository = server.repository?.url;
    const documentation = server.websiteUrl || repository || remote.url;
    let domain = "";
    try {
      domain = new URL(server.websiteUrl || remote.url).hostname;
    } catch {
      // A valid remote URL is enforced again by the local installer.
    }
    const displayName =
      typeof server.title === "string" && server.title
        ? server.title
        : server.name.split("/").pop() || server.name;
    const description =
      typeof server.description === "string" ? server.description : "";
    servers.push({
      ...entry,
      server: { ...server, title: displayName },
      _meta: {
        ...entry._meta,
        "com.anthropic.api/mcp-registry": {
          uuid: server.name,
          type: "remote",
          oneLiner: description,
          iconUrl: domain
            ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=48`
            : "",
          documentation,
          support: repository || documentation,
          privacyPolicy: server.websiteUrl || documentation,
          author: {
            name: domain || server.name.split("/")[0],
            url: server.websiteUrl || repository || remote.url,
          },
          worksWith: ["claude", "claude-code", "claude-desktop"],
          isAuthless: false,
          slug: server.name,
          createdOn:
            entry._meta?.["io.modelcontextprotocol.registry/official"]
              ?.publishedAt,
          source_feed: "official-mcp-registry",
        },
      },
    });
  }
  const next = payload.metadata?.nextCursor;
  if (typeof next !== "string" || !next || next === cursor) break;
  cursor = next;
}

const snapshot = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  source: REGISTRY,
  servers,
};
const destination = path.resolve(
  "src/shared/connector-directory-snapshot.json",
);
await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Captured ${servers.length} connectors from the official MCP Registry in ${path.relative(process.cwd(), destination)}.`,
);
