// Greps the staged renderer snapshot for a literal string and prints
// byte-offset context windows — the workhorse for re-deriving client patch
// find-strings after a snapshot upgrade.
// usage: node tools/find-in-snapshot.mjs "<literal>" [before] [after]
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const needle = process.argv[2];
const before = Number(process.argv[3] ?? 200);
const after = Number(process.argv[4] ?? 300);
if (!needle) throw new Error("usage: find-in-snapshot.mjs <literal> [before] [after]");

const root = path.resolve(".package-assets", "ion-dist");
const files = [];
for (const dir of ["assets", path.join("assets", "v1"), "i18n", "_frame-rt"]) {
  const entries = await readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
  for (const entry of entries)
    if (entry.isFile() && /\.(js|json|html)$/.test(entry.name))
      files.push(path.join(root, dir, entry.name));
}
files.push(path.join(root, "index.html"));

let total = 0;
for (const file of files) {
  const source = await readFile(file, "utf8").catch(() => null);
  if (!source) continue;
  let index = source.indexOf(needle);
  while (index >= 0 && total < 8) {
    total += 1;
    console.log(`\n=== ${path.relative(root, file)} @ ${index}`);
    console.log(source.slice(Math.max(0, index - before), index + needle.length + after));
    index = source.indexOf(needle, index + 1);
  }
  if (total >= 8) break;
}
console.log(`\ntotal matches shown: ${total}${total >= 8 ? " (capped)" : ""}`);
