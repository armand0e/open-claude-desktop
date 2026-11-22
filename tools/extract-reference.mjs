import { createHash } from "node:crypto";
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { extractAll } from "@electron/asar";

const defaultInstallRoot = path.join(
  process.env.ProgramData ?? "C:\\ProgramData",
  process.env.USERNAME ?? "",
  "AnthropicClaude",
);

const installRoot = path.resolve(
  process.env.CLAUDE_INSTALL_ROOT ?? defaultInstallRoot,
);
const requestedVersion = process.env.CLAUDE_DESKTOP_VERSION;
const metadataOutput = path.resolve(
  process.env.CLAUDE_REFERENCE_METADATA_OUTPUT ??
    "analysis/reference-metadata.json",
);

async function installedVersions() {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(installRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && /^app-\d/.test(entry.name))
    .map((entry) => entry.name.slice(4))
    .sort((left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

const versions = await installedVersions();
const version = requestedVersion ?? versions.at(-1);
if (!version) {
  throw new Error(`No Claude Desktop installation found under ${installRoot}`);
}

const resources = path.join(installRoot, `app-${version}`, "resources");
const asarPath = path.join(resources, "app.asar");
const outputRoot = path.resolve("reference", `claude-${version}`);
const extracted = path.join(outputRoot, "app.asar.extracted");
const ionOutput = path.join(outputRoot, "ion-dist");

await stat(asarPath);
await mkdir(outputRoot, { recursive: true });

if (!existsSync(path.join(extracted, "package.json"))) {
  extractAll(asarPath, extracted);
}

if (process.env.CLAUDE_COPY_ION_DIST === "1" && !existsSync(ionOutput)) {
  await cp(path.join(resources, "ion-dist"), ionOutput, {
    recursive: true,
    preserveTimestamps: true,
  });
}

const packageJson = JSON.parse(
  await readFile(path.join(extracted, "package.json"), "utf8"),
);
const asarBuffer = await readFile(asarPath);
const bootstrapSource = await readFile(
  path.join(extracted, packageJson.main),
  "utf8",
);
const sentryRelease =
  bootstrapSource.match(/SENTRY_RELEASE=\{id:["']([0-9a-f]{40})["']\}/)?.[1] ??
  null;
const metadata = {
  productName: packageJson.productName,
  packageName: packageJson.name,
  version: packageJson.version,
  author: packageJson.author,
  main: packageJson.main,
  sentryRelease,
  appAsar: {
    bytes: asarBuffer.length,
    sha256: createHash("sha256").update(asarBuffer).digest("hex"),
  },
  installResources: resources,
};
await mkdir(path.dirname(metadataOutput), { recursive: true });
await writeFile(metadataOutput, `${JSON.stringify(metadata, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      version: packageJson.version,
      source: resources,
      asar: extracted,
      ionDist:
        process.env.CLAUDE_COPY_ION_DIST === "1"
          ? ionOutput
          : path.join(resources, "ion-dist"),
      metadata,
      metadataOutput,
    },
    null,
    2,
  )}\n`,
);
