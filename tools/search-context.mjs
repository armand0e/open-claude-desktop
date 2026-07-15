import { readFile } from "node:fs/promises";
import process from "node:process";

const [file, pattern, rawRadius = "500", rawLimit = "20"] =
  process.argv.slice(2);
if (!file || !pattern) {
  process.stderr.write(
    "Usage: node tools/search-context.mjs <file> <regex> [radius] [limit]\n",
  );
  process.exit(2);
}

const text = await readFile(file, "utf8");
const expression = new RegExp(pattern, "giu");
const radius = Number.parseInt(rawRadius, 10);
const limit = Number.parseInt(rawLimit, 10);
let count = 0;

for (const match of text.matchAll(expression)) {
  if (count >= limit) break;
  const before = text.slice(Math.max(0, match.index - radius), match.index);
  const after = text.slice(
    match.index + match[0].length,
    match.index + match[0].length + radius,
  );
  process.stdout.write(
    `\n--- match ${count + 1} at ${match.index} ---\n${before}[[${match[0]}]]${after}\n`,
  );
  count += 1;
}

process.stdout.write(`\n${count} match context(s) shown\n`);
