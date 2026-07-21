// Refresh the bundled, account-independent plugin directory from Anthropic's
// public GitHub marketplaces. This is a maintainer action only: the desktop
// app reads the generated snapshot and never polls a directory service.

import { writeFile } from "node:fs/promises";
import path from "node:path";

const MARKETPLACES = [
  {
    name: "claude-plugins-official",
    repository: "anthropics/claude-plugins-official",
    ref: "main",
  },
  {
    name: "knowledge-work-plugins",
    repository: "anthropics/knowledge-work-plugins",
    ref: "main",
  },
];

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "Open-Claude-Catalog-Snapshot",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function json(url) {
  const response = await fetch(url, { headers, redirect: "error" });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

function githubRepository(url) {
  const match = String(url ?? "").match(
    /^https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?\/?$/u,
  );
  return match ? `${match[1]}/${match[2]}` : null;
}

function normalizedSource(plugin, marketplace, commit) {
  const source = plugin.source;
  if (typeof source === "string") {
    return {
      repository: marketplace.repository,
      commit,
      path: source.replace(/^\.\//u, ""),
      skills: Array.isArray(plugin.skills) ? plugin.skills : undefined,
    };
  }
  if (!source || typeof source !== "object") return null;
  if (source.source === "github") {
    if (typeof source.repo !== "string" || typeof source.commit !== "string")
      return null;
    return {
      repository: source.repo,
      commit: source.commit,
      path: typeof source.path === "string" ? source.path : undefined,
      skills: Array.isArray(plugin.skills) ? plugin.skills : undefined,
    };
  }
  const repository = githubRepository(source.url);
  const sourceCommit = source.sha ?? source.commit ?? source.ref;
  if (!repository || typeof sourceCommit !== "string") return null;
  return {
    repository,
    commit: sourceCommit,
    path: typeof source.path === "string" ? source.path : undefined,
    skills: Array.isArray(plugin.skills) ? plugin.skills : undefined,
  };
}

const UPPERCASE_WORDS = new Set([
  "ai",
  "api",
  "aws",
  "ci",
  "cli",
  "crm",
  "db",
  "gcp",
  "iam",
  "mcp",
  "pdf",
  "pr",
  "sdk",
  "seo",
  "sql",
  "sso",
  "ui",
  "ux",
]);

function displayName(name) {
  return name
    .split("-")
    .map((part) =>
      UPPERCASE_WORDS.has(part.toLowerCase())
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

const capturedAt = new Date().toISOString();
const sources = [];
const byName = new Map();
for (const marketplace of MARKETPLACES) {
  const revision = await json(
    `https://api.github.com/repos/${marketplace.repository}/commits/${marketplace.ref}`,
  );
  if (typeof revision.sha !== "string")
    throw new Error(`Could not resolve ${marketplace.repository}`);
  const manifest = await json(
    `https://raw.githubusercontent.com/${marketplace.repository}/${revision.sha}/.claude-plugin/marketplace.json`,
  );
  sources.push({
    name: marketplace.name,
    repository: marketplace.repository,
    commit: revision.sha,
  });
  for (const plugin of Array.isArray(manifest.plugins)
    ? manifest.plugins
    : []) {
    if (
      !plugin ||
      typeof plugin !== "object" ||
      typeof plugin.name !== "string"
    )
      continue;
    const source = normalizedSource(plugin, marketplace, revision.sha);
    if (!source || byName.has(plugin.name)) continue;
    byName.set(plugin.name, {
      id: plugin.name,
      displayName:
        typeof plugin.displayName === "string"
          ? plugin.displayName
          : displayName(plugin.name),
      description:
        typeof plugin.description === "string" ? plugin.description : "",
      author:
        typeof plugin.author === "object" && plugin.author
          ? plugin.author.name
          : typeof plugin.author === "string"
            ? plugin.author
            : undefined,
      category:
        typeof plugin.category === "string" ? plugin.category : undefined,
      homepage:
        typeof plugin.homepage === "string" ? plugin.homepage : undefined,
      marketplace: marketplace.name,
      source,
    });
  }
}

const snapshot = {
  schemaVersion: 1,
  capturedAt,
  sources,
  plugins: [...byName.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  ),
};
const destination = path.resolve("src/shared/plugin-directory-snapshot.json");
await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(
  `Captured ${snapshot.plugins.length} plugins from ${sources.length} public marketplaces in ${path.relative(process.cwd(), destination)}.`,
);
