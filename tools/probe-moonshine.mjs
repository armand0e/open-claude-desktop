// Native Moonshine hardware smoke. It feeds the official release's Beckett
// fixture through Open-Claude's persistent sidecar and proves both partial
// streaming updates and a meaningful final transcript.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const workspace = path.resolve(process.cwd());
const platform = process.platform === "win32" ? "win" : "linux";
const packagedRoot = process.env.OPEN_CLAUDE_MOONSHINE_ROOT
  ? path.resolve(process.env.OPEN_CLAUDE_MOONSHINE_ROOT)
  : null;
const binary = packagedRoot
  ? path.join(
      packagedRoot,
      "bin",
      process.platform === "win32"
        ? "moonshine-stream.exe"
        : "moonshine-stream",
    )
  : path.join(
      workspace,
      "assets",
      "moonshine",
      platform,
      process.platform === "win32"
        ? "moonshine-stream.exe"
        : "moonshine-stream",
    );
const model = path.join(
  packagedRoot ?? path.join(workspace, "assets", "moonshine"),
  "models",
  "medium-streaming-en",
);
if (!existsSync(binary) || !existsSync(model))
  throw new Error("Run npm run dictation:prepare before the Moonshine probe");

const archive = path.join(
  os.tmpdir(),
  "open-claude-v0.0.69-windows-cli-transcriber.tar.gz",
);
if (!existsSync(archive))
  throw new Error(
    "The verified Moonshine release cache is missing; rerun dictation:prepare",
  );

const temporary = await mkdtemp(
  path.join(os.tmpdir(), "open-claude-moonshine-probe-"),
);
try {
  execFileSync(
    "tar",
    [
      "-xzf",
      archive,
      "-C",
      temporary,
      "--strip-components=1",
      "cli-transcriber/beckett.wav",
    ],
    { stdio: "inherit" },
  );
  const wav = await readFile(path.join(temporary, "beckett.wav"));
  if (wav.toString("ascii", 0, 4) !== "RIFF")
    throw new Error("Moonshine fixture is not RIFF audio");
  let offset = 12;
  let pcm = null;
  while (offset + 8 <= wav.length) {
    const name = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (name === "data") {
      pcm = wav.subarray(offset + 8, Math.min(wav.length, offset + 8 + size));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!pcm?.length) throw new Error("Moonshine fixture has no PCM data chunk");

  const child = spawn(binary, [model, "5"], {
    cwd: path.dirname(binary),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      LD_LIBRARY_PATH: [
        path.dirname(binary),
        process.env.LD_LIBRARY_PATH ?? "",
      ].join(path.delimiter),
    },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
  let stdinFailure = null;
  child.stdin.once("error", (error) => (stdinFailure = error));
  child.stdin.end(pcm);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0)
    throw new Error(
      `Moonshine sidecar exited ${code}: ${stderr || stdinFailure || "unknown failure"}`,
    );
  const updates = stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const partials = updates.filter(
    (update) => update.final === false && update.text,
  );
  const final = updates.findLast((update) => update.final === true);
  if (partials.length < 2)
    throw new Error(
      `Expected streaming transcript updates, received ${partials.length}`,
    );
  if (!final || typeof final.text !== "string")
    throw new Error("Moonshine did not emit a final transcript");
  const normalized = final.text.toLowerCase();
  for (const phrase of ["ever", "no matter", "try again", "fail better"])
    if (!normalized.includes(phrase))
      throw new Error(
        `Moonshine transcript omitted ${JSON.stringify(phrase)}: ${final.text}`,
      );
  console.log(
    JSON.stringify(
      {
        engine: "moonshine-voice",
        model: "medium-streaming-en",
        partialUpdates: partials.length,
        transcript: final.text,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
