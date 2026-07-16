import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export async function referencePaths() {
  const metadataPath = path.resolve(
    process.env.CLAUDE_REFERENCE_METADATA ??
      "analysis/reference-metadata.json",
  );
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const version = process.env.CLAUDE_DESKTOP_VERSION ?? metadata.version;
  if (!version) throw new Error(`Missing version in ${metadataPath}`);

  const referenceRoot = path.resolve(
    process.env.CLAUDE_REFERENCE_ROOT ?? `reference/claude-${version}`,
  );
  const installedResources = path.resolve(
    process.env.CLAUDE_RESOURCES_ROOT ?? metadata.installResources,
  );

  return {
    version,
    metadataPath,
    referenceRoot,
    installedResources,
  };
}
