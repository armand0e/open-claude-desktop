// Fetches the pinned official Moonshine Voice v0.0.69 native library and
// medium English streaming model, then builds Open-Claude's stdin/stdout
// streaming sidecar. Generated assets stay ignored; release builds call this
// script so a clean checkout cannot silently package the old Whisper path.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const RELEASE = "v0.0.69";
const workspace = path.resolve(process.cwd());
const root = path.join(workspace, "assets", "moonshine");
const model = path.join(root, "models", "medium-streaming-en");
const platform = process.platform === "win32" ? "win" : "linux";
const platformRoot = path.join(root, platform);
const binary = path.join(
  platformRoot,
  process.platform === "win32" ? "moonshine-stream.exe" : "moonshine-stream",
);
const source = path.join(workspace, "tools", "native", "moonshine-stream.cpp");
const DIGESTS = {
  "windows-cli-transcriber.tar.gz":
    "7954779d8cc79ab11508a9b6789d7bd94fe9e99d3a3e1579b2aa9948115b3f6c",
  "moonshine-linux.tar.gz":
    "299b672cfe9c7d3b8b8f4909fb1e51ccfe8db07c78936a00f7137e0241997a65",
  "onnxruntime-linux-x64-1.23.2.tgz":
    "1fa4dcaef22f6f7d5cd81b28c2800414350c10116f5fdd46a2160082551c5f9b",
};

function assertInsideWorkspace(candidate) {
  const relative = path.relative(workspace, path.resolve(candidate));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error(`Unsafe Moonshine asset path: ${candidate}`);
}
assertInsideWorkspace(root);

async function download(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const temporary = `${target}.download`;
  await pipeline(response.body, createWriteStream(temporary));
  await rename(temporary, target);
}

async function digest(target) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(target)) hash.update(chunk);
  return hash.digest("hex");
}

async function extractedArchive(url, archiveName) {
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), "open-claude-moonshine-"),
  );
  const archive = path.join(
    os.tmpdir(),
    `open-claude-${RELEASE}-${archiveName}`,
  );
  if (!existsSync(archive)) await download(url, archive);
  const actual = await digest(archive);
  if (actual !== DIGESTS[archiveName]) {
    await rm(archive, { force: true });
    throw new Error(`Moonshine release checksum mismatch for ${archiveName}`);
  }
  execFileSync("tar", ["-xzf", archive, "-C", temporary], { stdio: "inherit" });
  return temporary;
}

await mkdir(platformRoot, { recursive: true });
let libraryRoot;
let onnxLibraryRoot;
let cleanup = [];
if (process.platform === "win32") {
  const extracted = await extractedArchive(
    `https://github.com/moonshine-ai/moonshine/releases/download/${RELEASE}/windows-cli-transcriber.tar.gz`,
    "windows-cli-transcriber.tar.gz",
  );
  cleanup.push(extracted);
  const example = path.join(extracted, "cli-transcriber");
  libraryRoot = path.join(example, "moonshine-voice-windows-x86_64");
  if (!existsSync(model)) {
    await mkdir(path.dirname(model), { recursive: true });
    await cp(path.join(example, "models", "medium-streaming-en"), model, {
      recursive: true,
    });
  }
} else {
  const modelArchive = await extractedArchive(
    `https://github.com/moonshine-ai/moonshine/releases/download/${RELEASE}/windows-cli-transcriber.tar.gz`,
    "windows-cli-transcriber.tar.gz",
  );
  cleanup.push(modelArchive);
  if (!existsSync(model)) {
    await mkdir(path.dirname(model), { recursive: true });
    await cp(
      path.join(
        modelArchive,
        "cli-transcriber",
        "models",
        "medium-streaming-en",
      ),
      model,
      { recursive: true },
    );
  }
  const extracted = await extractedArchive(
    `https://github.com/moonshine-ai/moonshine/releases/download/${RELEASE}/moonshine-voice-linux-x86_64.tar.gz`,
    "moonshine-linux.tar.gz",
  );
  cleanup.push(extracted);
  libraryRoot = path.join(extracted, "moonshine-voice-linux-x86_64");
  const onnxExtracted = await extractedArchive(
    "https://github.com/microsoft/onnxruntime/releases/download/v1.23.2/onnxruntime-linux-x64-1.23.2.tgz",
    "onnxruntime-linux-x64-1.23.2.tgz",
  );
  cleanup.push(onnxExtracted);
  onnxLibraryRoot = path.join(onnxExtracted, "onnxruntime-linux-x64-1.23.2");
}

try {
  const include = path.join(libraryRoot, "include");
  const lib = path.join(libraryRoot, "lib");
  if (process.platform === "win32") {
    const vswhere = path.join(
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Microsoft Visual Studio",
      "Installer",
      "vswhere.exe",
    );
    const vcvars = execFileSync(
      vswhere,
      [
        "-latest",
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-find",
        "VC\\Auxiliary\\Build\\vcvars64.bat",
      ],
      { encoding: "utf8" },
    )
      .trim()
      .split(/\r?\n/u)[0];
    if (!vcvars) throw new Error("Visual Studio C++ Build Tools are required");
    const args = [
      "/nologo",
      "/std:c++17",
      "/EHsc",
      "/O2",
      "/MD",
      `/Fo:${path.join(platformRoot, "moonshine-stream.obj")}`,
      source,
      `/I${include}`,
      `/Fe:${binary}`,
      "/link",
      `/LIBPATH:${lib}`,
      "moonshine.lib",
      "bin-tokenizer.lib",
      "ort-utils.lib",
      "moonshine-utils.lib",
      "onnxruntime.lib",
      "ole32.lib",
    ];
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    // Passing a compound command as cmd.exe's final argv element applies a
    // second layer of quote rewriting around Program Files (x86). A temporary
    // batch file makes the toolchain setup deterministic and keeps every
    // compiler path explicitly quoted.
    const buildScript = path.join(
      path.dirname(libraryRoot),
      "build-moonshine.cmd",
    );
    await writeFile(
      buildScript,
      `@echo off\r\ncall ${quote(vcvars)} >nul\r\nif errorlevel 1 exit /b %errorlevel%\r\ncl ${args.map(quote).join(" ")}\r\n`,
      "utf8",
    );
    execFileSync("cmd.exe", ["/d", "/c", buildScript], {
      cwd: workspace,
      stdio: "inherit",
    });
    await Promise.all([
      rm(path.join(platformRoot, "moonshine-stream.exp"), { force: true }),
      rm(path.join(platformRoot, "moonshine-stream.lib"), { force: true }),
      rm(path.join(platformRoot, "moonshine-stream.obj"), { force: true }),
    ]);
    await cp(
      path.join(lib, "onnxruntime.dll"),
      path.join(platformRoot, "onnxruntime.dll"),
    );
  } else {
    if (!onnxLibraryRoot)
      throw new Error("Pinned Linux ONNX Runtime was not prepared");
    const onnxLib = path.join(onnxLibraryRoot, "lib");
    execFileSync(
      "g++",
      [
        "-std=c++17",
        "-O2",
        source,
        `-I${include}`,
        `-L${lib}`,
        `-L${onnxLib}`,
        "-lmoonshine",
        "-lonnxruntime",
        "-pthread",
        `-Wl,-rpath-link,${onnxLib}`,
        `-Wl,--disable-new-dtags,-rpath,$ORIGIN`,
        "-o",
        binary,
      ],
      { cwd: workspace, stdio: "inherit" },
    );
    await cp(
      path.join(lib, "libmoonshine.so"),
      path.join(platformRoot, "libmoonshine.so"),
    );
    const onnxRuntime = path.join(onnxLib, "libonnxruntime.so.1.23.2");
    for (const name of [
      "libonnxruntime.so",
      "libonnxruntime.so.1",
      "libonnxruntime.so.1.23.2",
    ])
      await cp(onnxRuntime, path.join(platformRoot, name));
    const providers = path.join(onnxLib, "libonnxruntime_providers_shared.so");
    if (existsSync(providers))
      await cp(providers, path.join(platformRoot, path.basename(providers)));
  }
} finally {
  await Promise.all(
    cleanup.map((directory) => rm(directory, { recursive: true, force: true })),
  );
}

console.log(`Moonshine ${RELEASE} streaming assets ready: ${root}`);
