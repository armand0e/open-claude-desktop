import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { childEnvironment } from "./child-environment";

interface MoonshinePaths {
  binary: string;
  model: string;
  binDir: string;
}

interface MoonshineSession {
  id: string;
  child: ChildProcessWithoutNullStreams;
  text: string;
  error?: string;
  final: boolean;
  stopping: boolean;
  bytes: number;
  outputBuffer: string;
  writeChain: Promise<void>;
  exit: Promise<number | null>;
}

const MAX_SESSIONS = 4;
const MAX_AUDIO_BYTES = 25_000_000;
const MAX_CHUNK_BYTES = 512_000;

function candidateRoots(): string[] {
  const roots: string[] = [];
  if (process.resourcesPath)
    roots.push(path.join(process.resourcesPath, "moonshine"));
  roots.push(path.join(process.cwd(), "assets", "moonshine"));
  return roots;
}

export function bundledMoonshinePaths(): MoonshinePaths | null {
  const platform = process.platform === "win32" ? "win" : "linux";
  const binaryName =
    process.platform === "win32" ? "moonshine-stream.exe" : "moonshine-stream";
  for (const root of candidateRoots()) {
    const binary = path.join(root, "bin", binaryName);
    const developmentBinary = path.join(root, platform, binaryName);
    const selectedBinary = existsSync(binary)
      ? binary
      : existsSync(developmentBinary)
        ? developmentBinary
        : null;
    const model = path.join(root, "models", "medium-streaming-en");
    if (selectedBinary && existsSync(model))
      return {
        binary: selectedBinary,
        model,
        binDir: path.dirname(selectedBinary),
      };
  }
  return null;
}

export class LocalMoonshine {
  readonly #sessions = new Map<string, MoonshineSession>();
  readonly #stops = new Map<
    string,
    Promise<ReturnType<LocalMoonshine["status"]>>
  >();
  #disposed = false;

  available(): boolean {
    return bundledMoonshinePaths() !== null;
  }

  start(): { sessionId: string; engine: string; model: string } {
    if (this.#disposed) throw new Error("Moonshine dictation is disposed");
    if (this.#sessions.size >= MAX_SESSIONS)
      throw new Error("Too many active dictation sessions");
    const paths = bundledMoonshinePaths();
    if (!paths)
      throw new Error(
        "The bundled Moonshine streaming model is not available in this build",
      );
    const id = randomUUID();
    const child = spawn(paths.binary, [paths.model, "5"], {
      cwd: paths.binDir,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnvironment({ LD_LIBRARY_PATH: paths.binDir }),
    });
    let resolveExit!: (code: number | null) => void;
    const exit = new Promise<number | null>((resolve) => {
      resolveExit = resolve;
    });
    const session: MoonshineSession = {
      id,
      child,
      text: "",
      final: false,
      stopping: false,
      bytes: 0,
      outputBuffer: "",
      writeChain: Promise.resolve(),
      exit,
    };
    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const value = JSON.parse(line) as {
          text?: unknown;
          final?: unknown;
          error?: unknown;
        };
        if (typeof value.text === "string") session.text = value.text.trim();
        if (value.final === true) session.final = true;
        if (typeof value.error === "string") session.error = value.error;
      } catch {
        // Native-library diagnostics belong on stderr; ignore non-protocol
        // stdout rather than surfacing it as dictated text.
      }
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      session.outputBuffer += chunk;
      let newline = session.outputBuffer.indexOf("\n");
      while (newline !== -1) {
        consumeLine(session.outputBuffer.slice(0, newline).replace(/\r$/u, ""));
        session.outputBuffer = session.outputBuffer.slice(newline + 1);
        newline = session.outputBuffer.indexOf("\n");
      }
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-4_000);
    });
    child.once("error", (error) => {
      session.error = error.message;
    });
    child.stdin.on("error", (error) => {
      session.error = error.message;
    });
    // close also follows a failed spawn and waits for the final stdout bytes.
    child.once("close", (code) => {
      if (session.outputBuffer) consumeLine(session.outputBuffer);
      session.outputBuffer = "";
      session.final = true;
      if (code && !session.error)
        session.error = stderr.trim() || `Moonshine exited with code ${code}`;
      resolveExit(code);
    });
    this.#sessions.set(id, session);
    return {
      sessionId: id,
      engine: "moonshine-voice",
      model: "medium-streaming-en",
    };
  }

  status(sessionId: string): {
    text: string;
    final: boolean;
    error?: string;
    bytes: number;
  } {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error("Dictation session was not found");
    return {
      text: session.text,
      final: session.final,
      ...(session.error ? { error: session.error } : {}),
      bytes: session.bytes,
    };
  }

  async audio(sessionId: string, pcm: Buffer): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error("Dictation session was not found");
    if (session.final || session.stopping || session.error)
      throw new Error(
        session.error || "Dictation session has ended or is stopping",
      );
    if (pcm.length === 0 || pcm.length > MAX_CHUNK_BYTES)
      throw new Error("Dictation audio chunk is empty or too large");
    if (pcm.length % 2 !== 0) throw new Error("Dictation audio must be PCM16");
    if (session.bytes + pcm.length > MAX_AUDIO_BYTES)
      throw new Error("Dictation recording exceeds the 25 MB limit");
    session.bytes += pcm.length;
    const write = async () => {
      if (session.child.stdin.destroyed)
        throw new Error("Moonshine audio input is closed");
      await new Promise<void>((resolve, reject) => {
        const input = session.child.stdin;
        const closed = () =>
          finish(new Error("Moonshine audio input is closed"));
        const finish = (error?: Error | null) => {
          input.off("close", closed);
          input.off("error", finish);
          if (error) reject(error);
          else resolve();
        };
        input.once("close", closed);
        input.once("error", finish);
        input.write(pcm, finish);
      });
    };
    session.writeChain = session.writeChain.then(write);
    await session.writeChain;
  }

  async stop(sessionId: string): Promise<ReturnType<LocalMoonshine["status"]>> {
    const pending = this.#stops.get(sessionId);
    if (pending) return pending;
    const session = this.#sessions.get(sessionId);
    if (!session) throw new Error("Dictation session was not found");
    session.stopping = true;
    const stopping = this.#stopSession(session);
    this.#stops.set(sessionId, stopping);
    try {
      return await stopping;
    } finally {
      this.#stops.delete(sessionId);
    }
  }

  async #stopSession(
    session: MoonshineSession,
  ): Promise<ReturnType<LocalMoonshine["status"]>> {
    const within = async (work: Promise<unknown>, milliseconds: number) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work.then(() => true),
          new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), milliseconds);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };
    // Include queued writes in the deadline: a dead native reader cannot drain.
    const graceful = session.writeChain
      .catch(() => undefined)
      .then(async () => {
        if (!session.child.stdin.destroyed) session.child.stdin.end();
        await session.exit;
      });
    if (!(await within(Promise.race([graceful, session.exit]), 15_000))) {
      session.error ??= "Moonshine did not stop within 15 seconds";
      session.child.stdin.destroy();
      session.child.kill("SIGKILL");
      if (!(await within(session.exit, 2_000)))
        throw new Error("Moonshine process did not exit after termination");
    }
    const result = this.status(session.id);
    this.#sessions.delete(session.id);
    return result;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.allSettled(
      [...this.#sessions.keys()].map((sessionId) => this.stop(sessionId)),
    );
    this.#sessions.clear();
  }
}
