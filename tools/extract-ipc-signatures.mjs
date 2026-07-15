import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse } from "@babel/parser";

const referenceRoot = path.resolve(
  process.env.CLAUDE_REFERENCE_ROOT ?? "reference/claude-1.21459.0",
);
const buildRoot = path.join(
  referenceRoot,
  "app.asar.extracted",
  ".vite",
  "build",
);
const preloadReport = JSON.parse(
  await readFile(path.resolve("analysis/preload-api.json"), "utf8"),
);
const output = path.resolve("analysis/ipc-signatures.json");

function parseChannel(channel) {
  const match = channel.match(
    /^\$eipc_(message|event)\$_([^_]+)_\$_(.+?)_\$_([^_]+)_\$_(.+)$/,
  );
  return match
    ? {
        kind: match[1],
        namespace: match[3],
        service: match[4],
        method: match[5],
      }
    : null;
}

const buildFiles = (await readdir(buildRoot)).filter((name) =>
  name.endsWith(".js"),
);
let selectedFile = null;
let selectedSource = "";
let bestScore = -1;
for (const name of buildFiles) {
  const source = await readFile(path.join(buildRoot, name), "utf8");
  const score = source.split('Argument "').length - 1;
  if (score > bestScore) {
    bestScore = score;
    selectedFile = name;
    selectedSource = source;
  }
}
if (!selectedFile || bestScore <= 0)
  throw new Error("Could not locate generated IPC validation code");

function validationSummary(expression) {
  const optional =
    /===\s*void 0|typeof\s+\w+\s*[!=]==?\s*["']undefined["']/.test(expression);
  const nullable = /===\s*null/.test(expression);
  const primitive = [
    ...expression.matchAll(
      /typeof\s+[^=!&|,)]+\s*[!=]==?\s*["'](string|boolean|number|object|function|bigint)["']/g,
    ),
  ].map((match) => match[1]);
  let core;
  if (/Array\.isArray/.test(expression)) {
    if (/\.every[\s\S]*typeof[\s\S]*["']string["']/.test(expression))
      core = "string[]";
    else if (/\.every[\s\S]*typeof[\s\S]*["']number["']/.test(expression))
      core = "number[]";
    else core = "array (item schema validated)";
  } else if (primitive.length) {
    core = [...new Set(primitive)].join(" | ");
  } else if (/safeParse|parse\(/.test(expression)) {
    core = "schema validated";
  } else if (/instanceof/.test(expression)) {
    core = "instance validated";
  } else {
    core = "custom schema validated";
  }
  return [optional ? "undefined" : null, nullable ? "null" : null, core]
    .filter(Boolean)
    .join(" | ");
}

const ast = parse(selectedSource, {
  sourceType: "script",
  allowReturnOutsideFunction: true,
  errorRecovery: true,
  plugins: ["dynamicImport", "importMeta", "topLevelAwait"],
});

const observed = new Map();
const errorPattern =
  /^(Argument|Result)(?: "([^"]+)" at position (\d+))? (?:to|from) (method|event) "([^"]+)" in interface "([^"]+)" failed to pass validation$/;

function visit(node, ancestors = []) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, ancestors);
    return;
  }
  if (node.type === "StringLiteral") {
    const match = errorPattern.exec(node.value);
    if (match) {
      const [
        ,
        direction,
        argumentName,
        rawPosition,
        memberKind,
        member,
        service,
      ] = match;
      const ifStatement = [...ancestors]
        .reverse()
        .find((candidate) => candidate.type === "IfStatement");
      const expression =
        ifStatement?.test?.start != null && ifStatement?.test?.end != null
          ? selectedSource.slice(ifStatement.test.start, ifStatement.test.end)
          : "";
      const key = `${service}.${member}`;
      const record = observed.get(key) ?? { arguments: [], result: null };
      const validation = {
        validation: expression
          ? validationSummary(expression)
          : "generated validator",
        validationHash: expression
          ? createHash("sha256").update(expression).digest("hex")
          : null,
      };
      if (direction === "Argument") {
        record.arguments.push({
          name: argumentName,
          position: Number(rawPosition),
          ...validation,
        });
      } else {
        record.result = validation;
      }
      record.memberKind = memberKind;
      observed.set(key, record);
    }
  }
  const nextAncestors = [...ancestors, node];
  for (const [key, child] of Object.entries(node)) {
    if (
      ["loc", "start", "end", "extra", "errors", "comments", "tokens"].includes(
        key,
      )
    )
      continue;
    visit(child, nextAncestors);
  }
}
visit(ast.program);

const signatures = preloadReport.channels.map((entry) => {
  const parsed = parseChannel(entry.channel);
  const publicPath = entry.publicPaths[0] ?? null;
  const publicMember = publicPath?.split(".").at(-1) ?? parsed?.method;
  const candidates = [parsed?.method, publicMember]
    .filter(Boolean)
    .map((member) => observed.get(`${parsed?.service}.${member}`))
    .filter(Boolean);
  const signature = candidates[0] ?? null;
  return {
    channel: entry.channel,
    kind: parsed?.kind ?? "unknown",
    namespace: parsed?.namespace ?? null,
    service: parsed?.service ?? null,
    method: parsed?.method ?? null,
    publicPath,
    files: entry.files,
    rendererOperations: entry.rendererOperations,
    arguments: signature
      ? [
          ...new Map(
            signature.arguments.map((argument) => [
              argument.position,
              argument,
            ]),
          ).values(),
        ].sort((a, b) => a.position - b.position)
      : [],
    result: signature?.result ?? null,
    generatedValidationObserved: Boolean(signature),
  };
});

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      sourceBundle: selectedFile,
      validationMessageCount: [...observed.values()].reduce(
        (count, signature) =>
          count + signature.arguments.length + (signature.result ? 1 : 0),
        0,
      ),
      channelCount: signatures.length,
      channelsWithValidation: signatures.filter(
        (signature) => signature.generatedValidationObserved,
      ).length,
      channels: signatures,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Recovered generated validation signatures for ${signatures.filter((entry) => entry.generatedValidationObserved).length}/${signatures.length} channels into ${output}\n`,
);
