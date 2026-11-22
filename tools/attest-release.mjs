import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(process.cwd());
const releaseDirectory = path.join(workspace, "release");
const packageMetadata = JSON.parse(
  await readFile(path.join(workspace, "package.json"), "utf8"),
);
const artifacts = [
  `Open-Claude-Setup-${packageMetadata.version}.exe`,
  `Open-Claude-${packageMetadata.version}-x86_64.AppImage`,
];
const rendererManifest = JSON.parse(
  await readFile(
    path.join(workspace, "analysis", "renderer-compatibility.json"),
    "utf8",
  ),
);

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function actualHashes() {
  return Promise.all(
    artifacts.map(async (name) => ({
      name,
      hash: await sha256(path.join(releaseDirectory, name)),
    })),
  );
}

function git(...args) {
  return execFileSync("git", args, {
    cwd: workspace,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

function authenticodeStatus(file) {
  if (process.platform !== "win32")
    throw new Error(
      "Authenticode verification must run on Windows before release publication",
    );
  const powershell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const windowsPowerShellModules = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "Modules",
  );
  return execFileSync(
    powershell,
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Import-Module Microsoft.PowerShell.Security; (Get-AuthenticodeSignature -LiteralPath '${file.replaceAll("'", "''")}').Status.ToString()`,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, PSModulePath: windowsPowerShellModules },
    },
  ).trim();
}

const mode = process.argv[2];
if (mode === "--write-hashes") {
  const hashes = await actualHashes();
  await writeFile(
    path.join(releaseDirectory, "SHA256SUMS.txt"),
    `${hashes.map(({ hash, name }) => `${hash} *${name}`).join("\n")}\n`,
  );
  await writeFile(
    path.join(releaseDirectory, "build-provenance.json"),
    `${JSON.stringify(
      {
        version: packageMetadata.version,
        commit: git("rev-parse", "HEAD"),
        dirty: Boolean(git("status", "--porcelain")),
        rendererCompatibilityVersion:
          packageMetadata.openClaude?.rendererCompatibilityVersion ?? null,
        contractReferenceVersion:
          packageMetadata.openClaude?.contractReferenceVersion ?? null,
        rendererTreeSha256: rendererManifest.renderer.treeSha256,
        contractTreeSha256: rendererManifest.contract.treeSha256,
        patchSourceSha256: rendererManifest.patchSourceSha256,
        artifacts: hashes,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  console.log(JSON.stringify({ hashes }, null, 2));
} else if (mode === "--verify-release") {
  const provenance = JSON.parse(
    await readFile(
      path.join(releaseDirectory, "build-provenance.json"),
      "utf8",
    ),
  );
  const expected = new Map(
    (await readFile(path.join(releaseDirectory, "SHA256SUMS.txt"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => {
        const match = line.match(/^([a-f\d]{64}) \*(.+)$/iu);
        if (!match) throw new Error(`Malformed checksum row: ${line}`);
        return [match[2], match[1].toLowerCase()];
      }),
  );
  const actual = await actualHashes();
  for (const { name, hash } of actual)
    if (expected.get(name) !== hash)
      throw new Error(`Checksum mismatch for ${name}`);
  if (provenance.dirty !== false)
    throw new Error("Build provenance records a dirty worktree");
  if (provenance.commit !== git("rev-parse", "HEAD"))
    throw new Error("Build provenance commit does not match HEAD");
  if (provenance.version !== packageMetadata.version)
    throw new Error("Build provenance version does not match package.json");
  for (const { name, hash } of actual) {
    const recorded = Array.isArray(provenance.artifacts)
      ? provenance.artifacts.find((entry) => entry?.name === name)?.hash
      : undefined;
    if (recorded !== hash)
      throw new Error(`Build provenance hash mismatch for ${name}`);
  }
  for (const [field, expectedValue] of Object.entries({
    rendererCompatibilityVersion:
      packageMetadata.openClaude?.rendererCompatibilityVersion ?? null,
    contractReferenceVersion:
      packageMetadata.openClaude?.contractReferenceVersion ?? null,
    rendererTreeSha256: rendererManifest.renderer.treeSha256,
    contractTreeSha256: rendererManifest.contract.treeSha256,
    patchSourceSha256: rendererManifest.patchSourceSha256,
  }))
    if (provenance[field] !== expectedValue)
      throw new Error(
        `Build provenance ${field} does not match the release inputs`,
      );
  const status = authenticodeStatus(path.join(releaseDirectory, artifacts[0]));
  if (status !== "Valid")
    throw new Error(`Windows installer signature is ${status}, not Valid`);
  if (git("status", "--porcelain"))
    throw new Error("Release attestation requires a clean Git worktree");
  console.log(
    JSON.stringify(
      {
        commit: git("rev-parse", "HEAD"),
        hashes: actual,
        authenticode: status,
        rendererCompatibilityVersion:
          packageMetadata.openClaude?.rendererCompatibilityVersion ?? null,
        contractReferenceVersion:
          packageMetadata.openClaude?.contractReferenceVersion ?? null,
      },
      null,
      2,
    ),
  );
} else {
  throw new Error("Use --write-hashes or --verify-release");
}
