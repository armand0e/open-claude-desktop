// Built-in speech-to-text: runs the bundled whisper.cpp CLI (base-q5_1
// model) over a 16 kHz mono WAV recording. Fully offline; no network.

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

interface WhisperPaths {
  binary: string;
  model: string;
  binDir: string;
}

function candidateRoots(): string[] {
  const roots: string[] = [];
  if (process.resourcesPath)
    roots.push(path.join(process.resourcesPath, "whisper"));
  roots.push(path.join(process.cwd(), "assets", "whisper"));
  return roots;
}

export function bundledWhisperPaths(): WhisperPaths | null {
  const binaryName =
    process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli";
  for (const root of candidateRoots()) {
    const model = path.join(root, "ggml-base-q5_1.bin");
    const packagedBinary = path.join(root, "bin", binaryName);
    const developmentBinary = path.join(
      root,
      process.platform === "win32" ? "win" : "linux",
      binaryName,
    );
    const binary = existsSync(packagedBinary)
      ? packagedBinary
      : existsSync(developmentBinary)
        ? developmentBinary
        : null;
    if (binary && existsSync(model))
      return { binary, model, binDir: path.dirname(binary) };
  }
  return null;
}

export async function transcribeWithBundledWhisper(
  wav: Buffer,
): Promise<string> {
  const paths = bundledWhisperPaths();
  if (!paths)
    throw new Error(
      "The bundled speech-to-text model is not available in this build",
    );
  const workDir = await mkdtemp(path.join(os.tmpdir(), "open-claude-stt-"));
  const wavPath = path.join(workDir, "recording.wav");
  try {
    await writeFile(wavPath, wav);
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        paths.binary,
        [
          "-m",
          paths.model,
          "-f",
          wavPath,
          "--no-timestamps",
          "--language",
          "auto",
          "--threads",
          String(Math.max(2, Math.min(8, os.cpus().length - 1))),
        ],
        {
          timeout: 180_000,
          windowsHide: true,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            // The Linux build ships its shared objects beside the binary.
            LD_LIBRARY_PATH: [
              paths.binDir,
              process.env.LD_LIBRARY_PATH ?? "",
            ].join(path.delimiter),
          },
        },
        (error, stdoutText) => {
          if (error)
            reject(new Error(`Transcription failed: ${error.message}`));
          else resolve(String(stdoutText));
        },
      );
    });
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !/^\[[A-Z_ ]+\]$/.test(line))
      .join(" ")
      .trim();
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
