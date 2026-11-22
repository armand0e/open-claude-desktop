import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, realpath, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createServer } from "vite";
import { retainedRendererVersions, treeDigest } from "./renderer-utils.mjs";

const workspace = path.resolve(process.cwd());
const argv = process.argv.slice(2);

function flag(name) {
  return argv.includes(name);
}

function option(name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`${name} requires a value`);
  return value;
}

function positionalVersion() {
  const valueOptions = new Set(["--version", "--root", "--report"]);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (valueOptions.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("--")) return value;
  }
  return undefined;
}

async function directoryExists(candidate) {
  return (await stat(candidate).catch(() => null))?.isDirectory() ?? false;
}

async function fileExists(candidate) {
  return (await stat(candidate).catch(() => null))?.isFile() ?? false;
}

async function run(command, args, environment = process.env) {
  // Node 24 no longer reliably spawns .cmd shims directly on Windows and can
  // reject npm.cmd with EINVAL. npm exposes the JavaScript CLI path to child
  // scripts, so keep this shell-free and execute that entrypoint with the
  // current Node runtime.
  const useNpmCli =
    process.platform === "win32" &&
    command === "npm" &&
    typeof process.env.npm_execpath === "string" &&
    process.env.npm_execpath.length > 0;
  const executable = useNpmCli ? process.execPath : command;
  const spawnArgs = useNpmCli ? [process.env.npm_execpath, ...args] : args;
  await new Promise((resolve, reject) => {
    const child = spawn(executable, spawnArgs, {
      cwd: workspace,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} failed (${signal ?? `exit ${code}`})`,
          ),
        );
    });
  });
}

const packagePath = path.join(workspace, "package.json");
const packageMetadata = JSON.parse(await readFile(packagePath, "utf8"));
const fromVersion = packageMetadata.openClaude?.rendererCompatibilityVersion;
if (!fromVersion)
  throw new Error(
    "package.json does not declare a renderer compatibility version",
  );

const versions = await retainedRendererVersions(workspace);
const targetVersion =
  option("--version") ?? positionalVersion() ?? versions.at(-1);
if (!targetVersion || !/^\d+\.\d+\.\d+$/u.test(targetVersion))
  throw new Error(
    "Pass a renderer version such as `npm run renderer:migrate -- 1.24012.0`",
  );

const defaultReferenceRoot = path.join(
  workspace,
  "reference",
  `claude-${targetVersion}`,
);
const suppliedRoot = path.resolve(option("--root") ?? defaultReferenceRoot);
const candidateRoot = (await fileExists(path.join(suppliedRoot, "index.html")))
  ? suppliedRoot
  : path.join(suppliedRoot, "ion-dist");
if (!(await fileExists(path.join(candidateRoot, "index.html"))))
  throw new Error(`Renderer candidate has no index.html: ${candidateRoot}`);

const canonicalCandidateRoot = await realpath(candidateRoot);
const indexHtml = await readFile(
  path.join(canonicalCandidateRoot, "index.html"),
  "utf8",
);
const server = await createServer({
  root: workspace,
  configFile: false,
  appType: "custom",
  logLevel: "error",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
});
let patchModule;
try {
  patchModule = await server.ssrLoadModule("/src/main/client-patches.ts");
} finally {
  await server.close();
}

const { report: patchReport } = await patchModule.applyClientPatchSet(
  canonicalCandidateRoot,
  indexHtml,
  patchModule.LOCAL_CLIENT_PATCHES,
  {
    mode: "compatible",
    scanAllAssets: flag("--deep-scan"),
    rendererVersion: targetVersion,
  },
);
const renderer = await treeDigest(canonicalCandidateRoot);
const referenceRoot = path.dirname(canonicalCandidateRoot);
const contractRoot = path.join(referenceRoot, "app.asar.extracted");
const contract = (await directoryExists(contractRoot))
  ? await treeDigest(contractRoot)
  : null;
const patchSourceSha256 = createHash("sha256")
  .update(
    await readFile(path.join(workspace, "src", "main", "client-patches.ts")),
  )
  .digest("hex");
const statusCounts = Object.fromEntries(
  ["applied", "satisfied", "missing", "ambiguous", "asset-unavailable"].map(
    (status) => [
      status,
      patchReport.results.filter((result) => result.status === status).length,
    ],
  ),
);
const metadata = JSON.parse(
  await readFile(
    path.join(workspace, "analysis", "reference-metadata.json"),
    "utf8",
  ),
);
const expectedReferenceRoot = await realpath(defaultReferenceRoot).catch(
  () => defaultReferenceRoot,
);
const releaseGates = {
  allPatchesCompatible: patchReport.unresolved === 0,
  contractSnapshotPresent: Boolean(contract),
  generatedContractVersionMatches: metadata.version === targetVersion,
  retainedReferenceRoot:
    canonicalCandidateRoot === path.join(expectedReferenceRoot, "ion-dist"),
};
const migration = {
  schemaVersion: 1,
  fromVersion,
  targetVersion,
  candidateRoot: path
    .relative(workspace, canonicalCandidateRoot)
    .replaceAll("\\", "/"),
  deepScan: flag("--deep-scan"),
  renderer,
  contract,
  patchSourceSha256,
  patchCompatibility: {
    total: patchReport.total,
    applied: patchReport.applied,
    satisfied: patchReport.satisfied,
    unresolved: patchReport.unresolved,
    statusCounts,
    results: patchReport.results,
  },
  releaseGates,
  releaseReady: Object.values(releaseGates).every(Boolean),
};

const reportPath = path.resolve(
  option("--report") ??
    path.join(
      workspace,
      "analysis",
      "renderer-migrations",
      `${fromVersion}-to-${targetVersion}.json`,
    ),
);
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(migration, null, 2)}\n`);

process.stdout.write(
  [
    `Renderer ${fromVersion} -> ${targetVersion}`,
    `Patches: ${patchReport.applied} applied, ${patchReport.satisfied} native/retired, ${patchReport.unresolved} unresolved (${patchReport.total} total)`,
    `Report: ${reportPath}`,
  ].join("\n") + "\n",
);

if (flag("--promote")) {
  if (!migration.releaseReady) {
    const failed = Object.entries(releaseGates)
      .filter(([, passed]) => !passed)
      .map(([gate]) => gate)
      .join(", ");
    throw new Error(
      `Refusing to promote renderer ${targetVersion}; failed gates: ${failed}`,
    );
  }
  const compatibilityPath = path.join(
    workspace,
    "analysis",
    "renderer-compatibility.json",
  );
  const originalPackage = await readFile(packagePath, "utf8");
  const originalCompatibility = await readFile(compatibilityPath, "utf8");
  const nextPackage = JSON.parse(originalPackage);
  nextPackage.openClaude = {
    ...nextPackage.openClaude,
    rendererCompatibilityVersion: targetVersion,
    contractReferenceVersion: targetVersion,
  };
  const nextCompatibility = {
    schemaVersion: 1,
    rendererCompatibilityVersion: targetVersion,
    contractReferenceVersion: targetVersion,
    referenceRoot: `reference/claude-${targetVersion}`,
    renderer,
    contract,
    patchSourceSha256,
  };
  try {
    await writeFile(packagePath, `${JSON.stringify(nextPackage, null, 2)}\n`);
    await writeFile(
      compatibilityPath,
      `${JSON.stringify(nextCompatibility, null, 2)}\n`,
    );
    await run("node", ["tools/prepare-package-assets.mjs"]);
    await run("npm", ["run", "renderer:verify"]);
  } catch (error) {
    const rollbackErrors = [];
    await writeFile(packagePath, originalPackage).catch((rollbackError) =>
      rollbackErrors.push(rollbackError),
    );
    await writeFile(compatibilityPath, originalCompatibility).catch(
      (rollbackError) => rollbackErrors.push(rollbackError),
    );
    await run("node", ["tools/prepare-package-assets.mjs"]).catch(
      (rollbackError) => rollbackErrors.push(rollbackError),
    );
    if (rollbackErrors.length > 0)
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Renderer promotion failed and rollback was incomplete",
      );
    throw error;
  }
  process.stdout.write(`Promoted renderer/contract ${targetVersion}.\n`);
}

if (flag("--launch")) {
  if (!flag("--allow-partial") && patchReport.unresolved > 0)
    throw new Error(
      "The candidate still has unresolved patches. Pass --allow-partial to launch it explicitly in compatibility mode.",
    );
  // npm start consumes dist-electron rather than TypeScript directly. Build
  // immediately before every candidate launch so newly added variants are
  // the code under test, not a stale main-process bundle.
  await run("npm", ["run", "build"]);
  await run("npm", ["start"], {
    ...process.env,
    CLAUDE_DESKTOP_LOCAL_UI: "1",
    CLAUDE_ION_DIST: canonicalCandidateRoot,
    OPEN_CLAUDE_PATCH_MODE:
      patchReport.unresolved > 0 ? "compatible" : "strict",
  });
}
