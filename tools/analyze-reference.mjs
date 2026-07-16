import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { referencePaths } from "./reference-paths.mjs";

const { referenceRoot, installedResources } = await referencePaths();
const asarRoot = path.join(referenceRoot, "app.asar.extracted");
const ionRoot = path.join(referenceRoot, "ion-dist");
const effectiveIonRoot = (await exists(ionRoot))
  ? ionRoot
  : path.join(installedResources, "ion-dist");
const reportRoot = path.resolve("analysis");

async function exists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    try {
      await readdir(file);
      return true;
    } catch {
      return false;
    }
  }
}

async function walk(root) {
  const output = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) output.push(absolute);
    }
  }
  await visit(root);
  return output;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function matches(text, expression, group = 0) {
  return [...text.matchAll(expression)].map((match) => match[group]);
}

function parseChannel(channel) {
  const match = channel.match(
    /^\$eipc_(message|event)\$_([^_]+)_\$_(.+?)_\$_([^_]+)_\$_(.+)$/,
  );
  if (!match) return { channel, kind: "unknown" };
  return {
    channel,
    kind: match[1],
    generatorId: match[2],
    namespace: match[3],
    service: match[4],
    method: match[5],
  };
}

function safeOrigin(candidate) {
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

const roots = [
  { name: "asar", root: asarRoot },
  { name: "ion", root: effectiveIonRoot },
];
const fileManifest = [];
const channels = [];
const bridgeNames = [];
const requires = [];
const sourceMapHints = [];
const urlCandidates = [];
const environmentKeys = [];

for (const source of roots) {
  if (!(await exists(source.root))) continue;
  for (const absolute of await walk(source.root)) {
    const buffer = await readFile(absolute);
    const relative = path.relative(source.root, absolute).replaceAll("\\", "/");
    fileManifest.push({
      source: source.name,
      path: relative,
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    });
    if (!/\.(?:[cm]?js|html)$/i.test(relative)) continue;
    const text = buffer.toString("utf8");
    channels.push(
      ...matches(text, /\$eipc_(?:message|event)\$_[^"'`\s),;]+/g).map(
        (value) => value.replace(/[}\]]+$/, ""),
      ),
    );
    bridgeNames.push(
      ...matches(text, /exposeInMainWorld\(\s*["']([^"']+)["']/g, 1),
    );
    requires.push(...matches(text, /\brequire\(\s*["']([^"']+)["']\s*\)/g, 1));
    environmentKeys.push(
      ...matches(text, /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g, 1),
      ...matches(text, /\bprocess\.env\[["']([A-Z][A-Z0-9_]*)["']\]/g, 1),
    );
    sourceMapHints.push(
      ...matches(text, /\/\/# sourceMappingURL=([^\s]+)/g, 1).map((map) => ({
        source: source.name,
        file: relative,
        map,
      })),
    );
    urlCandidates.push(
      ...matches(
        text,
        /https?:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*/g,
      ),
    );
  }
}

const parsedChannels = uniqueSorted(channels).map(parseChannel);
const services = {};
for (const entry of parsedChannels) {
  const key = `${entry.namespace ?? "unknown"}.${entry.service ?? "unknown"}`;
  services[key] ??= {
    namespace: entry.namespace,
    service: entry.service,
    methods: [],
  };
  services[key].methods.push({
    kind: entry.kind,
    method: entry.method,
    channel: entry.channel,
  });
}
for (const service of Object.values(services)) {
  service.methods.sort((left, right) =>
    left.method.localeCompare(right.method),
  );
}

const origins = uniqueSorted(urlCandidates.map(safeOrigin).filter(Boolean));
fileManifest.sort(
  (left, right) =>
    left.source.localeCompare(right.source) ||
    left.path.localeCompare(right.path),
);

await mkdir(reportRoot, { recursive: true });
const reports = {
  "file-manifest.json": fileManifest,
  "ipc-contract.json": {
    channelCount: parsedChannels.length,
    serviceCount: Object.keys(services).length,
    services: Object.fromEntries(
      Object.entries(services).sort(([a], [b]) => a.localeCompare(b)),
    ),
  },
  "runtime-surface.json": {
    contextBridgeGlobals: uniqueSorted(bridgeNames),
    requires: uniqueSorted(requires),
    environmentKeys: uniqueSorted(environmentKeys),
    networkOrigins: origins,
    sourceMapHints,
  },
};

for (const [name, report] of Object.entries(reports)) {
  await writeFile(
    path.join(reportRoot, name),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      referenceRoot,
      ionRoot: effectiveIonRoot,
      files: fileManifest.length,
      ipcChannels: parsedChannels.length,
      ipcServices: Object.keys(services).length,
      bridgeGlobals: uniqueSorted(bridgeNames).length,
      networkOrigins: origins.length,
      sourceMapHints: sourceMapHints.length,
    },
    null,
    2,
  )}\n`,
);
