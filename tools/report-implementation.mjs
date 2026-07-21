import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contract = JSON.parse(
  await readFile("analysis/ipc-contract.json", "utf8"),
);
const signatures = JSON.parse(
  await readFile("analysis/ipc-signatures.json", "utf8"),
);
const serviceSource = await readFile("src/main/services.ts", "utf8");
const explicitKeys = [
  ...new Set(
    [...serviceSource.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(
      (match) => match[1],
    ),
  ),
]
  .filter((key) => Object.hasOwn(contract.services, key))
  .sort();
const explicitSet = new Set(explicitKeys);
// These services are event-only at the preload boundary, so they do not need
// a dispatcher switch. Their events are produced by the window/deep-link
// lifecycle in index.ts and services.ts.
const eventBackedKeys = ["claude.web.DeepLink", "claude.web.MenuEvents"].filter(
  (key) => Object.hasOwn(contract.services, key),
);
const eventBackedSet = new Set(eventBackedKeys);

function serviceEntry(key) {
  const service = contract.services[key];
  return {
    service: key,
    methodCount: service?.methods?.length ?? 0,
  };
}

const serviceSpecificDispatch = explicitKeys.map(serviceEntry);
const eventBackedDispatch = eventBackedKeys.sort().map(serviceEntry);
const fallbackDispatch = Object.keys(contract.services)
  .filter((key) => !explicitSet.has(key) && !eventBackedSet.has(key))
  .sort()
  .map(serviceEntry);
const sumMethods = (entries) =>
  entries.reduce((total, entry) => total + entry.methodCount, 0);
const report = {
  contract: {
    channelCount: contract.channelCount,
    serviceCount: contract.serviceCount,
    channelsWithGeneratedValidation: signatures.channelsWithValidation,
    namedArgumentCount: signatures.channels.reduce(
      (count, channel) => count + channel.arguments.length,
      0,
    ),
    validatedResultCount: signatures.channels.filter(
      (channel) => channel.result,
    ).length,
  },
  serviceSpecificDispatch: {
    serviceCount: serviceSpecificDispatch.length,
    methodCount: sumMethods(serviceSpecificDispatch),
    services: serviceSpecificDispatch,
  },
  eventBackedDispatch: {
    serviceCount: eventBackedDispatch.length,
    methodCount: sumMethods(eventBackedDispatch),
    services: eventBackedDispatch,
  },
  safeFallbackDispatch: {
    serviceCount: fallbackDispatch.length,
    methodCount: sumMethods(fallbackDispatch),
    services: fallbackDispatch,
  },
  qualification:
    "A service-specific or event-backed branch is not a claim of full semantic parity. See docs/coverage.md and docs/product-boundary.md for functional, compatibility, and trimmed surfaces.",
};

const output = path.resolve("analysis/implementation-coverage.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Generated ${output}\n`);
