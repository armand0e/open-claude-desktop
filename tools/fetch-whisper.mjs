// Fetches the bundled speech-to-text pieces (whisper.cpp v1.9.1 binaries
// for Windows and Linux plus the ggml-base-q5_1 model) into assets/whisper.
// Idempotent: existing files are kept. Run before dist builds on a fresh
// checkout; the directory is gitignored because of its size (~85 MB).
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";

const RELEASE = "v1.9.1";
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin";
const WIN_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${RELEASE}/whisper-bin-x64.zip`;
const LINUX_URL = `https://github.com/ggml-org/whisper.cpp/releases/download/${RELEASE}/whisper-bin-ubuntu-x64.tar.gz`;

const root = path.resolve("assets/whisper");
const winDir = path.join(root, "win");
const linuxDir = path.join(root, "linux");

async function download(url, target) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const temporary = `${target}.download`;
  await pipeline(response.body, createWriteStream(temporary));
  await rename(temporary, target);
}

await mkdir(winDir, { recursive: true });
await mkdir(linuxDir, { recursive: true });

const model = path.join(root, "ggml-base-q5_1.bin");
if (!existsSync(model)) {
  console.log("Downloading whisper model (ggml-base-q5_1, ~57 MB)…");
  await download(MODEL_URL, model);
}

if (!existsSync(path.join(winDir, "whisper-cli.exe"))) {
  console.log("Downloading whisper.cpp Windows binaries…");
  const zip = path.join(tmpdir(), "open-claude-whisper-win.zip");
  const extracted = path.join(tmpdir(), "open-claude-whisper-win");
  await download(WIN_URL, zip);
  await rm(extracted, { recursive: true, force: true });
  execFileSync("tar", [
    "-xf",
    zip,
    "-C",
    tmpdir(),
    "--one-top-level=open-claude-whisper-win",
  ]);
  const release = path.join(extracted, "Release");
  for (const name of [
    "whisper-cli.exe",
    "whisper.dll",
    "ggml.dll",
    "ggml-base.dll",
  ])
    await rename(path.join(release, name), path.join(winDir, name));
  const { readdirSync } = await import("node:fs");
  for (const name of readdirSync(release))
    if (/^ggml-cpu-.*\.dll$/.test(name))
      await rename(path.join(release, name), path.join(winDir, name));
  await rm(extracted, { recursive: true, force: true });
  await rm(zip, { force: true });
}

if (!existsSync(path.join(linuxDir, "whisper-cli"))) {
  console.log("Downloading whisper.cpp Linux binaries…");
  const tarball = path.join(tmpdir(), "open-claude-whisper-linux.tar.gz");
  await download(LINUX_URL, tarball);
  execFileSync("tar", ["-xzf", tarball, "-C", tmpdir()]);
  const extracted = path.join(tmpdir(), "whisper-bin-ubuntu-x64");
  const { readdirSync } = await import("node:fs");
  for (const name of readdirSync(extracted))
    if (name === "whisper-cli" || /^lib(whisper|ggml).*\.so/.test(name))
      await rename(path.join(extracted, name), path.join(linuxDir, name));
  await rm(extracted, { recursive: true, force: true });
  await rm(tarball, { force: true });
}

console.log("whisper assets ready:", root);
