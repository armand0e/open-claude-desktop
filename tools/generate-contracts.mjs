import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const contract = JSON.parse(
  await readFile("analysis/ipc-contract.json", "utf8"),
);
const preload = JSON.parse(await readFile("analysis/preload-api.json", "utf8"));
const signatures = JSON.parse(
  await readFile("analysis/ipc-signatures.json", "utf8"),
);
const output = path.resolve("src/generated/ipc-contract.ts");
const validationOutput = path.resolve("src/generated/ipc-validation.ts");
const apiOutput = path.resolve("src/generated/desktop-api.d.ts");
await mkdir(path.dirname(output), { recursive: true });

const lines = [
  "// Generated from the locally installed Claude Desktop bundle.",
  "// Re-run `npm run reference:generate` after `npm run reference:analyze`.",
  "",
  'export type IpcMethodKind = "message" | "event" | "unknown";',
  "",
  "export interface IpcMethodContract {",
  "  readonly kind: IpcMethodKind;",
  "  readonly method: string;",
  "  readonly channel: string;",
  "}",
  "",
  "export interface IpcServiceContract {",
  "  readonly namespace?: string;",
  "  readonly service?: string;",
  "  readonly methods: readonly IpcMethodContract[];",
  "}",
  "",
  `export const IPC_CHANNEL_COUNT = ${contract.channelCount} as const;`,
  `export const IPC_SERVICE_COUNT = ${contract.serviceCount} as const;`,
  "",
  `export const IPC_SERVICES = ${JSON.stringify(contract.services, null, 2)} as const satisfies Record<string, IpcServiceContract>;`,
  "",
  "export type IpcServiceName = keyof typeof IPC_SERVICES;",
  "",
  "export interface PreloadChannelContract {",
  "  readonly channel: string;",
  "  readonly files: readonly string[];",
  "  readonly rendererOperations: readonly string[];",
  "  readonly publicPaths: readonly string[];",
  "}",
  "",
  `export const PRELOAD_CHANNELS = ${JSON.stringify(preload.channels, null, 2)} as const satisfies readonly PreloadChannelContract[];`,
  "",
];

await writeFile(output, `${lines.join("\n")}\n`);
const validation = Object.fromEntries(
  signatures.channels
    .filter((entry) => entry.generatedValidationObserved)
    .map((entry) => [
      entry.channel,
      {
        arguments: entry.arguments.map(({ name, position, validation }) => ({
          name,
          position,
          validation,
        })),
        result: entry.result ? { validation: entry.result.validation } : null,
      },
    ]),
);
await writeFile(
  validationOutput,
  [
    "// Generated from validation guards in the locally installed bundle.",
    "export interface ValueValidation { readonly validation: string; }",
    "export interface ArgumentValidation extends ValueValidation { readonly name: string; readonly position: number; }",
    "export interface ChannelValidation { readonly arguments: readonly ArgumentValidation[]; readonly result: ValueValidation | null; }",
    `export const IPC_VALIDATION = ${JSON.stringify(validation, null, 2)} as const satisfies Record<string, ChannelValidation>;`,
    "",
  ].join("\n"),
);

function typeFromValidation(summary) {
  if (!summary) return "unknown";
  const mapped = summary.split("|").map((part) => {
    const value = part.trim();
    if (
      ["undefined", "null", "string", "boolean", "number", "bigint"].includes(
        value,
      )
    )
      return value;
    if (value === "object") return "Record<string, unknown>";
    if (value === "function") return "(...args: unknown[]) => unknown";
    if (value === "string[]") return "readonly string[]";
    if (value === "number[]") return "readonly number[]";
    if (value.startsWith("array")) return "readonly unknown[]";
    return "unknown";
  });
  return [...new Set(mapped)].join(" | ");
}

function safeParameterName(name, position) {
  const candidate = String(name ?? `arg${position}`).replace(
    /[^A-Za-z0-9_$]/g,
    "_",
  );
  return /^[A-Za-z_$]/.test(candidate) ? candidate : `arg${position}`;
}

function parameterList(signature) {
  if (!signature?.generatedValidationObserved) return "...args: unknown[]";
  return signature.arguments
    .map((argument) => {
      const parts = argument.validation.split("|").map((part) => part.trim());
      const optional = parts.includes("undefined");
      const type =
        parts
          .filter((part) => part !== "undefined")
          .map(typeFromValidation)
          .filter((part, index, all) => all.indexOf(part) === index)
          .join(" | ") || "undefined";
      return `${safeParameterName(argument.name, argument.position)}${optional ? "?" : ""}: ${type}`;
    })
    .join(", ");
}

function callableType(entry, signature) {
  const operations = new Set(entry.rendererOperations);
  const parameters = parameterList(signature);
  const result = signature?.result
    ? typeFromValidation(signature.result.validation)
    : signature?.generatedValidationObserved
      ? "void"
      : "unknown";
  if (operations.has("on")) {
    const callbackParameters = parameters || "...args: unknown[]";
    return `(callback: (${callbackParameters}) => void) => () => void`;
  }
  if (operations.has("sendSync")) return `(${parameters}) => ${result}`;
  return `(${parameters}) => Promise<${result}>`;
}

function addTreeValue(root, segments, value) {
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current[segment] ??= {};
    current = current[segment];
  }
  current[segments.at(-1)] = value;
}

function renderTypeTree(node, indent = 0) {
  const pad = "  ".repeat(indent);
  const childPad = "  ".repeat(indent + 1);
  const lines = ["{"];
  for (const [key, value] of Object.entries(node).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    lines.push(
      `${childPad}${JSON.stringify(key)}: ${typeof value === "string" ? value : renderTypeTree(value, indent + 1)};`,
    );
  }
  lines.push(`${pad}}`);
  return lines.join("\n");
}

const signatureByChannel = new Map(
  signatures.channels.map((entry) => [entry.channel, entry]),
);
const apiTree = {};
for (const entry of preload.channels) {
  const signature = signatureByChannel.get(entry.channel);
  if (!signature?.namespace || !signature.service || !entry.publicPaths[0])
    continue;
  apiTree[signature.namespace] ??= {};
  apiTree[signature.namespace][signature.service] ??= {};
  addTreeValue(
    apiTree[signature.namespace][signature.service],
    entry.publicPaths[0].split("."),
    callableType(entry, signature),
  );
}
const namespaceKeys = Object.keys(apiTree).sort();
await writeFile(
  apiOutput,
  [
    "// Generated clean-room declarations for the observed desktop preload API.",
    "// Custom structural schemas are represented as unknown rather than guessed.",
    `export interface RecoveredDesktopNamespaces ${renderTypeTree(apiTree)}`,
    "export type RecoveredDesktopNamespace = keyof RecoveredDesktopNamespaces;",
    "declare global {",
    "  interface Window {",
    ...namespaceKeys.map(
      (namespace) =>
        `    ${JSON.stringify(namespace)}: RecoveredDesktopNamespaces[${JSON.stringify(namespace)}];`,
    ),
    "  }",
    "}",
    "export {};",
    "",
  ].join("\n"),
);
process.stdout.write(
  `Generated ${output} (${contract.channelCount} channels)\n`,
);
process.stdout.write(
  `Generated ${validationOutput} (${Object.keys(validation).length} validated channels)\n`,
);
process.stdout.write(
  `Generated ${apiOutput} (${namespaceKeys.length} namespaces)\n`,
);
