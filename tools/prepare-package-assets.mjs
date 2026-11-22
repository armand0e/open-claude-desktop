import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const workspace = path.resolve(process.cwd());
const staging = path.join(workspace, ".package-assets");
// The renderer, preload contract, and exact-match patch table are one release
// unit. tools/renderer-compatibility.mjs verifies their retained tree hashes.
const packageMetadata = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
const compatibilityVersion =
  process.env.CLAUDE_DESKTOP_VERSION ||
  packageMetadata.openClaude?.rendererCompatibilityVersion;
if (!compatibilityVersion)
  throw new Error(
    "package.json does not declare a renderer compatibility version",
  );
if (
  packageMetadata.openClaude?.contractReferenceVersion !== compatibilityVersion
)
  throw new Error(
    "Renderer and contract reference versions must match before packaging",
  );
const compatibilityManifest = JSON.parse(
  await readFile(
    path.join(workspace, "analysis", "renderer-compatibility.json"),
    "utf8",
  ),
);
if (
  compatibilityManifest.rendererCompatibilityVersion !== compatibilityVersion ||
  compatibilityManifest.contractReferenceVersion !== compatibilityVersion
)
  throw new Error("The renderer compatibility manifest is stale");

function insideWorkspace(candidate) {
  const relative = path.relative(workspace, candidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function isUiRoot(candidate) {
  if (!candidate) return false;
  return stat(path.join(candidate, "index.html"))
    .then((details) => details.isFile())
    .catch(() => false);
}

async function installedUiCandidates() {
  const username = process.env.USERNAME || os.userInfo().username;
  const installRoot = path.join(
    process.env.ProgramData || "C:\\ProgramData",
    username,
    "AnthropicClaude",
  );
  return [
    path.join(
      installRoot,
      `app-${compatibilityVersion}`,
      "resources",
      "ion-dist",
    ),
  ];
}

const appData =
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const candidates = [
  process.env.OPEN_CLAUDE_ION_DIST,
  process.env.CLAUDE_ION_DIST,
  path.join(
    appData,
    "Claude Local",
    "UI Assets",
    `claude-${compatibilityVersion}`,
    "ion-dist",
  ),
  path.join(
    appData,
    "Open-Claude",
    "UI Assets",
    `claude-${compatibilityVersion}`,
    "ion-dist",
  ),
  path.join(
    workspace,
    "reference",
    `claude-${compatibilityVersion}`,
    "ion-dist",
  ),
  ...(await installedUiCandidates()),
].filter(Boolean);

let source = null;
for (const candidate of candidates) {
  if (await isUiRoot(candidate)) {
    source = path.resolve(candidate);
    break;
  }
}
if (!source)
  throw new Error(
    "No compatible Claude UI snapshot was found. Set OPEN_CLAUDE_ION_DIST to an ion-dist directory.",
  );
if (!insideWorkspace(staging))
  throw new Error(`Refusing to replace unsafe staging path: ${staging}`);

await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(source, path.join(staging, "ion-dist"), { recursive: true });
await cp(
  path.join(workspace, "analysis", "renderer-compatibility.json"),
  path.join(staging, "renderer-compatibility.json"),
);
await writeFile(
  path.join(staging, "release-metadata.json"),
  `${JSON.stringify(
    {
      rendererCompatibilityVersion: compatibilityVersion,
      contractReferenceVersion:
        packageMetadata.openClaude?.contractReferenceVersion ?? null,
      rendererTreeSha256: compatibilityManifest.renderer.treeSha256,
      contractTreeSha256: compatibilityManifest.contract.treeSha256,
      patchSourceSha256: compatibilityManifest.patchSourceSha256,
    },
    null,
    2,
  )}\n`,
);

const icon = path.join(source, "images", "claude_app_icon.png");
if (!(await stat(icon).catch(() => null)))
  throw new Error(
    `The packaged UI snapshot is missing its application icon: ${icon}`,
  );
await cp(icon, path.join(staging, "icon.png"));
if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(workspace, "tools", "prepare-windows-icon.ps1"),
      "-Source",
      path.join(staging, "icon.png"),
      "-Destination",
      path.join(staging, "icon.ico"),
    ],
    { stdio: "inherit" },
  );
}

process.stdout.write(
  `Prepared the retained Claude UI and app icon for the Open-Claude installer from ${source}\n`,
);
