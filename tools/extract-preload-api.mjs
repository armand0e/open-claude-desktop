import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "@babel/parser";
import { referencePaths } from "./reference-paths.mjs";

const { referenceRoot } = await referencePaths();
const buildRoot = path.join(
  referenceRoot,
  "app.asar.extracted",
  ".vite",
  "build",
);
const output = path.resolve("analysis/preload-api.json");
const preloadFiles = [
  "aboutWindow.js",
  "buddy.js",
  "claudePagePreview.js",
  "computerUseTeach.js",
  "coworkArtifact.js",
  "findInPage.js",
  "mainView.js",
  "mainWindow.js",
  "quickWindow.js",
];

function keyName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "StringLiteral" || node.type === "NumericLiteral")
    return String(node.value);
  return null;
}

function isIpcRendererMember(node) {
  return (
    node?.type === "MemberExpression" &&
    !node.computed &&
    keyName(node.property) === "ipcRenderer"
  );
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

const channels = new Map();

function record(channel, operation, publicPath, file) {
  const current = channels.get(channel) ?? {
    channel,
    files: [],
    rendererOperations: [],
    publicPaths: [],
  };
  current.files.push(file);
  current.rendererOperations.push(operation);
  if (publicPath) current.publicPaths.push(publicPath);
  channels.set(channel, current);
}

function visit(node, context) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) visit(child, context);
    return;
  }

  if (node.type === "ObjectMethod") {
    const name = keyName(node.key);
    const publicPath = name
      ? [...context.objectPath, name].join(".")
      : context.publicPath;
    visit(node.body, { ...context, publicPath });
    return;
  }

  if (node.type === "ObjectProperty") {
    const name = keyName(node.key);
    if (name && node.value?.type === "ObjectExpression") {
      visit(node.value, {
        ...context,
        objectPath: [...context.objectPath, name],
      });
      return;
    }
    if (
      name &&
      (node.value?.type === "ArrowFunctionExpression" ||
        node.value?.type === "FunctionExpression")
    ) {
      visit(node.value.body, {
        ...context,
        publicPath: [...context.objectPath, name].join("."),
      });
      return;
    }
  }

  if (
    node.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    isIpcRendererMember(node.callee.object)
  ) {
    const operation = keyName(node.callee.property);
    const channel = node.arguments?.[0];
    if (
      operation &&
      channel?.type === "StringLiteral" &&
      channel.value.startsWith("$eipc_")
    ) {
      record(channel.value, operation, context.publicPath, context.file);
    }
  }

  for (const [key, child] of Object.entries(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "extra")
      continue;
    visit(child, context);
  }
}

for (const file of preloadFiles) {
  const absolute = path.join(buildRoot, file);
  const source = await readFile(absolute, "utf8");
  const ast = parse(source, {
    sourceType: "script",
    allowReturnOutsideFunction: true,
    plugins: ["dynamicImport", "importMeta", "topLevelAwait"],
  });
  visit(ast.program, { file, objectPath: [], publicPath: null });
}

const entries = [...channels.values()]
  .map((entry) => ({
    ...entry,
    files: uniqueSorted(entry.files),
    rendererOperations: uniqueSorted(entry.rendererOperations),
    publicPaths: uniqueSorted(entry.publicPaths),
  }))
  .sort((left, right) => left.channel.localeCompare(right.channel));

await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      preloads: preloadFiles,
      channelCount: entries.length,
      channels: entries,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Recovered ${entries.length} preload channel bindings into ${output}\n`,
);
