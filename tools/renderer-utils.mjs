import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export function compareRendererVersions(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export async function retainedRendererVersions(workspace) {
  const referenceRoot = path.join(workspace, "reference");
  return (await readdir(referenceRoot, { withFileTypes: true }).catch(() => []))
    .filter(
      (entry) =>
        entry.isDirectory() && /^claude-\d+\.\d+\.\d+$/u.test(entry.name),
    )
    .map((entry) => entry.name.slice("claude-".length))
    .sort(compareRendererVersions);
}

export async function treeDigest(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await visit(root);
  files.sort((left, right) => left.localeCompare(right));
  const hash = createHash("sha256");
  let bytes = 0;
  for (const absolute of files) {
    const content = await readFile(absolute);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    bytes += content.byteLength;
    hash.update(relative).update("\0").update(content).update("\0");
  }
  return { fileCount: files.length, bytes, treeSha256: hash.digest("hex") };
}
