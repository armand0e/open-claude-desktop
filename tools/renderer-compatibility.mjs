import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { treeDigest } from "./renderer-utils.mjs";

const workspace = path.resolve(process.cwd());
const manifestPath = path.join(
  workspace,
  "analysis",
  "renderer-compatibility.json",
);
const packageMetadata = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
const rendererVersion =
  packageMetadata.openClaude?.rendererCompatibilityVersion;
const contractVersion = packageMetadata.openClaude?.contractReferenceVersion;
if (!rendererVersion || !contractVersion || rendererVersion !== contractVersion)
  throw new Error(
    `Renderer and contract versions must be identical: ${JSON.stringify({ rendererVersion, contractVersion })}`,
  );

const referenceRoot = path.join(
  workspace,
  "reference",
  `claude-${rendererVersion}`,
);
const renderer = await treeDigest(path.join(referenceRoot, "ion-dist"));
const contract = await treeDigest(
  path.join(referenceRoot, "app.asar.extracted"),
);
const patchSourceSha256 = createHash("sha256")
  .update(
    await readFile(path.join(workspace, "src", "main", "client-patches.ts")),
  )
  .digest("hex");
const observed = {
  schemaVersion: 1,
  rendererCompatibilityVersion: rendererVersion,
  contractReferenceVersion: contractVersion,
  referenceRoot: `reference/claude-${rendererVersion}`,
  renderer,
  contract,
  patchSourceSha256,
};

if (process.argv.includes("--write"))
  await writeFile(manifestPath, `${JSON.stringify(observed, null, 2)}\n`);

const expected = JSON.parse(await readFile(manifestPath, "utf8"));
if (JSON.stringify(observed) !== JSON.stringify(expected))
  throw new Error(
    "The retained renderer, contract snapshot, or patch source differs from analysis/renderer-compatibility.json",
  );
const stagedRoot = path.join(workspace, ".package-assets", "ion-dist");
if ((await stat(stagedRoot).catch(() => null))?.isDirectory()) {
  const staged = await treeDigest(stagedRoot);
  if (JSON.stringify(staged) !== JSON.stringify(renderer))
    throw new Error(
      "The staged renderer does not match the retained snapshot manifest",
    );
}
process.stdout.write(
  `Verified renderer/contract ${rendererVersion}: ${renderer.fileCount} UI files, ${contract.fileCount} contract files.\n`,
);
