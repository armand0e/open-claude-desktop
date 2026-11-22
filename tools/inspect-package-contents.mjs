import { listPackage } from "@electron/asar";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const candidates = (
  process.argv[2]
    ? [process.argv[2]]
    : [
        "release/win-unpacked/resources/app.asar",
        "release/linux-unpacked/resources/app.asar",
      ]
).map((candidate) => path.resolve(candidate));
const archives = [];
for (const candidate of candidates)
  if ((await stat(candidate).catch(() => null))?.isFile())
    archives.push(candidate);
if (archives.length === 0)
  throw new Error(
    "No packaged app.asar was found; pass its path or build an unpacked target first",
  );
for (const archive of archives) {
  const entries = listPackage(archive).map((entry) =>
    entry.replaceAll("\\", "/").replace(/^\/+/, ""),
  );
  const forbidden = entries.filter(
    (entry) =>
      /(?:^|\/)node_modules\/.*\/(?:test|tests|__tests__|coverage|docs?|examples?|fixtures)\//i.test(
        entry,
      ) ||
      /(?:^|\/)(?:ADVISORY|SECURITY|CONTRIBUTING)(?:\.[^/]*)?$/i.test(entry) ||
      /\.map$/i.test(entry),
  );
  if (forbidden.length)
    throw new Error(
      `${archive} contains non-runtime baggage: ${JSON.stringify(forbidden.slice(0, 100))}`,
    );
  const details = await stat(archive);
  process.stdout.write(
    `Verified ${archive}: ${entries.length} ASAR entries (${details.size} bytes) with no test, advisory, documentation, fixture, coverage, or source-map baggage.\n`,
  );
}
