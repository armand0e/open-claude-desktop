import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

// Chat-mode code execution ("wiggle" in the retained client): a Docker-backed
// Linux runtime with node/npm and python/uv preinstalled. Each conversation
// gets its own container whose /workspace is a bind-mounted host directory
// under the profile, so uploads flow in and generated files flow out without
// docker cp. The image builds once from the embedded Dockerfile below.

const IMAGE_TAG = "open-claude-sandbox";
const CONTAINER_PREFIX = "open-claude-sbx-";
const CONTAINER_LABEL = "io.openclaude.sandbox";
const EXEC_TIMEOUT_SECONDS = 180;
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CONTAINER_MS = 30 * 60 * 1000;
const MAX_OUTPUT_CHARS = 24_000;
const MAX_LISTED_FILES = 200;
const STATUS_CACHE_MS = 3_000;

// Preinstalled: node 22 + npm, python 3.12 + uv/pip, pandas, numpy, openpyxl,
// pillow, matplotlib, requests, plus ffmpeg/git/zip/jq CLI tools.
const DOCKERFILE = `FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \\
      ca-certificates curl git unzip zip jq ffmpeg \\
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \\
    && apt-get install -y --no-install-recommends nodejs \\
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv pandas numpy openpyxl pillow matplotlib requests
WORKDIR /workspace
CMD ["sleep","infinity"]
`;

export type SandboxDockerState = "missing" | "stopped" | "ok";
export type SandboxImageState = "absent" | "building" | "ready";

export interface SandboxStatus {
  docker: SandboxDockerState;
  image: SandboxImageState;
  detail?: string;
}

export interface SandboxGeneratedFile {
  path: string;
  size_bytes: number;
}

export interface SandboxRunResult {
  output: string;
  generatedFiles: SandboxGeneratedFile[];
}

interface DockerInvocation {
  missing: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
}

function runDocker(
  args: readonly string[],
  options: { input?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<DockerInvocation> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      windowsHide: true,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: DockerInvocation) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => {
      child.kill();
      finish({ missing: false, code: null, stdout, stderr: "aborted" });
    };
    const timer = setTimeout(() => {
      child.kill();
      finish({ missing: false, code: null, stdout, stderr: "timed out" });
    }, options.timeoutMs ?? 30_000);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-256_000);
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-256_000);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      finish({
        missing: error.code === "ENOENT",
        code: null,
        stdout,
        stderr: error.message,
      });
    });
    if (options.input !== undefined) {
      child.stdin?.write(options.input);
      child.stdin?.end();
    }
    child.on("close", (code) => {
      finish({ missing: false, code, stdout, stderr });
    });
  });
}

function conversationKey(conversationUuid: string): string {
  const key = conversationUuid.toLowerCase();
  if (!/^[0-9a-f][0-9a-f-]{0,63}$/.test(key))
    throw new Error("Invalid sandbox conversation id");
  return key;
}

function safeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replaceAll("\0", "");
  const parts = normalized.split("/").filter((part) => part && part !== ".");
  if (parts.length === 0 || parts.some((part) => part === ".."))
    throw new Error("Invalid sandbox file path");
  return parts.join("/");
}

async function walkWorkspace(
  root: string,
): Promise<Map<string, { size: number; mtimeMs: number }>> {
  const entries = new Map<string, { size: number; mtimeMs: number }>();
  const visit = async (directory: string, prefix: string, depth: number) => {
    if (depth > 6 || entries.size >= MAX_LISTED_FILES) return;
    let names: string[] = [];
    try {
      names = await readdir(directory);
    } catch {
      return;
    }
    for (const name of names) {
      if (entries.size >= MAX_LISTED_FILES) return;
      if (name === "node_modules" || name === ".git" || name === "__pycache__")
        continue;
      const absolute = path.join(directory, name);
      const relative = prefix ? `${prefix}/${name}` : name;
      try {
        const info = await stat(absolute);
        if (info.isDirectory()) await visit(absolute, relative, depth + 1);
        else if (info.isFile())
          entries.set(relative, { size: info.size, mtimeMs: info.mtimeMs });
      } catch {
        // Files may vanish between listing and stat; skip them.
      }
    }
  };
  await visit(root, "", 0);
  return entries;
}

export class LocalSandbox {
  readonly #rootDir: string;
  #building = false;
  #buildDetail = "";
  #buildError = "";
  #imageReady = false;
  #reaped = false;
  #statusCache: { at: number; value: SandboxStatus } | null = null;
  // Containers this process started: name -> last-use timestamp.
  readonly #containers = new Map<string, number>();
  // The network mode each container was created with; a changed egress
  // setting recreates the container instead of silently keeping the old one.
  readonly #containerNetwork = new Map<string, boolean>();
  // Workspaces of incognito conversations: deleted on dispose so no chat
  // data outlives the in-memory conversation.
  readonly #ephemeralWorkspaces = new Set<string>();
  readonly #ensureChains = new Map<string, Promise<string>>();
  readonly #reaper: NodeJS.Timeout;

  constructor(userDataPath: string) {
    this.#rootDir = path.join(userDataPath, "sandbox");
    this.#reaper = setInterval(() => void this.#reapIdle(), 5 * 60 * 1000);
    this.#reaper.unref?.();
  }

  workspaceDir(conversationUuid: string): string {
    return path.join(this.#rootDir, conversationKey(conversationUuid));
  }

  async status(): Promise<SandboxStatus> {
    const cached = this.#statusCache;
    if (cached && Date.now() - cached.at < STATUS_CACHE_MS) return cached.value;
    const value = await this.#probeStatus();
    this.#statusCache = { at: Date.now(), value };
    return value;
  }

  async #probeStatus(): Promise<SandboxStatus> {
    const probe = await runDocker(
      ["version", "--format", "{{.Server.Version}}"],
      {
        timeoutMs: 10_000,
      },
    );
    if (probe.missing)
      return {
        docker: "missing",
        image: "absent",
        detail: "Docker is not installed",
      };
    if (probe.code !== 0)
      return {
        docker: "stopped",
        image: "absent",
        detail: "Docker is not running — start Docker Desktop",
      };
    if (this.#building)
      return {
        docker: "ok",
        image: "building",
        detail: this.#buildDetail || "Building the code execution image…",
      };
    if (this.#imageReady) return { docker: "ok", image: "ready" };
    const inspect = await runDocker(["image", "inspect", IMAGE_TAG], {
      timeoutMs: 10_000,
    });
    if (inspect.code === 0) {
      this.#imageReady = true;
      return { docker: "ok", image: "ready" };
    }
    return {
      docker: "ok",
      image: "absent",
      ...(this.#buildError ? { detail: this.#buildError } : {}),
    };
  }

  // Fire-and-forget build; status() reports progress while it runs.
  startImageBuild(): void {
    if (this.#building || this.#imageReady) return;
    this.#building = true;
    this.#buildError = "";
    this.#buildDetail = "Building the code execution image (one time)…";
    this.#statusCache = null;
    void (async () => {
      const probe = await runDocker(["version"], { timeoutMs: 10_000 });
      if (probe.missing || probe.code !== 0) {
        this.#building = false;
        this.#statusCache = null;
        return;
      }
      const inspect = await runDocker(["image", "inspect", IMAGE_TAG], {
        timeoutMs: 10_000,
      });
      if (inspect.code === 0) {
        this.#imageReady = true;
        this.#building = false;
        this.#statusCache = null;
        return;
      }
      const build = await runDocker(["build", "--pull", "-t", IMAGE_TAG, "-"], {
        input: DOCKERFILE,
        timeoutMs: BUILD_TIMEOUT_MS,
      });
      this.#building = false;
      this.#statusCache = null;
      if (build.code === 0) {
        this.#imageReady = true;
        return;
      }
      const tail = (build.stderr || build.stdout).trim().split("\n").at(-1);
      this.#buildError = `Image build failed${tail ? `: ${tail.slice(0, 300)}` : ""}`;
    })();
  }

  async #reapStale(): Promise<void> {
    if (this.#reaped) return;
    this.#reaped = true;
    // Remove containers a crashed previous instance left behind.
    const listed = await runDocker([
      "ps",
      "-aq",
      "--filter",
      `label=${CONTAINER_LABEL}`,
    ]);
    const ids = listed.stdout.split(/\s+/).filter(Boolean);
    if (ids.length > 0)
      await runDocker(["rm", "-f", ...ids], { timeoutMs: 60_000 });
  }

  async #reapIdle(): Promise<void> {
    const now = Date.now();
    for (const [name, lastUse] of this.#containers) {
      if (now - lastUse < IDLE_CONTAINER_MS) continue;
      this.#containers.delete(name);
      await runDocker(["rm", "-f", name], { timeoutMs: 60_000 });
    }
  }

  async #ensureContainer(
    conversationUuid: string,
    allowNetwork: boolean,
  ): Promise<string> {
    const key = conversationKey(conversationUuid);
    const name = `${CONTAINER_PREFIX}${key}`;
    const pending = this.#ensureChains.get(name) ?? Promise.resolve("");
    const chained = pending
      .catch(() => undefined)
      .then(async () => {
        await this.#reapStale();
        if (
          this.#containers.has(name) &&
          this.#containerNetwork.get(name) === allowNetwork
        ) {
          const running = await runDocker([
            "inspect",
            "-f",
            "{{.State.Running}}",
            name,
          ]);
          if (running.code === 0 && running.stdout.trim() === "true") {
            this.#containers.set(name, Date.now());
            return name;
          }
        }
        this.#containers.delete(name);
        this.#containerNetwork.delete(name);
        await runDocker(["rm", "-f", name], { timeoutMs: 60_000 });
        const workspace = this.workspaceDir(conversationUuid);
        await mkdir(path.join(workspace, "uploads"), { recursive: true });
        const run = await runDocker(
          [
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "--label",
            `${CONTAINER_LABEL}=1`,
            ...(allowNetwork ? [] : ["--network", "none"]),
            "--memory",
            "2g",
            "--cpus",
            "2",
            "--pids-limit",
            "512",
            "-v",
            `${workspace}:/workspace`,
            "-w",
            "/workspace",
            IMAGE_TAG,
            "sleep",
            "infinity",
          ],
          { timeoutMs: 60_000 },
        );
        if (run.code !== 0)
          throw new Error(
            `Could not start the sandbox container: ${(run.stderr || run.stdout).trim().slice(0, 400)}`,
          );
        this.#containers.set(name, Date.now());
        this.#containerNetwork.set(name, allowNetwork);
        return name;
      });
    this.#ensureChains.set(name, chained);
    try {
      return await chained;
    } finally {
      if (this.#ensureChains.get(name) === chained)
        this.#ensureChains.delete(name);
    }
  }

  async runCommand(
    conversationUuid: string,
    command: string,
    options: { allowNetwork: boolean; signal: AbortSignal },
  ): Promise<SandboxRunResult> {
    if (!command.trim()) throw new Error("A command is required");
    const state = await this.status();
    if (state.docker === "missing")
      throw new Error(
        "Docker is not installed, so code execution is unavailable",
      );
    if (state.docker === "stopped")
      throw new Error("Docker is not running — start Docker Desktop first");
    if (state.image === "building")
      throw new Error(
        "The code execution image is still building; try again shortly",
      );
    if (state.image !== "ready") {
      this.startImageBuild();
      throw new Error(
        "The code execution image is not built yet; it is building now — try again in a few minutes",
      );
    }
    const name = await this.#ensureContainer(
      conversationUuid,
      options.allowNetwork,
    );
    const workspace = this.workspaceDir(conversationUuid);
    const before = await walkWorkspace(workspace);
    const exec = await runDocker(
      [
        "exec",
        name,
        "timeout",
        "-k",
        "10",
        String(EXEC_TIMEOUT_SECONDS),
        "bash",
        "-lc",
        command,
      ],
      {
        timeoutMs: (EXEC_TIMEOUT_SECONDS + 30) * 1000,
        signal: options.signal,
      },
    );
    this.#containers.set(name, Date.now());
    const after = await walkWorkspace(workspace);
    const generatedFiles: SandboxGeneratedFile[] = [];
    for (const [relative, info] of after) {
      if (relative.startsWith("uploads/") || relative.startsWith("skills/"))
        continue;
      const previous = before.get(relative);
      if (
        previous &&
        previous.size === info.size &&
        previous.mtimeMs === info.mtimeMs
      )
        continue;
      generatedFiles.push({ path: relative, size_bytes: info.size });
    }
    const combined = [exec.stdout.trim(), exec.stderr.trim()]
      .filter(Boolean)
      .join("\n");
    let output = combined;
    if (output.length > MAX_OUTPUT_CHARS)
      output = `${output.slice(0, MAX_OUTPUT_CHARS)}\n… output truncated`;
    if (exec.code === 124 || exec.code === 137)
      output = `${output ? `${output}\n` : ""}Command timed out after ${EXEC_TIMEOUT_SECONDS} seconds.`;
    else if (exec.code !== 0)
      output = `${output ? `${output}\n` : ""}Exit code: ${exec.code ?? "killed"}`;
    return { output: output || "(no output)", generatedFiles };
  }

  async stageUpload(
    conversationUuid: string,
    fileName: string,
    sourcePath: string,
  ): Promise<void> {
    const uploads = path.join(this.workspaceDir(conversationUuid), "uploads");
    await mkdir(uploads, { recursive: true });
    const target = path.join(
      uploads,
      safeRelativePath(path.basename(fileName)),
    );
    await copyFile(sourcePath, target);
  }

  async stageSkillFiles(
    conversationUuid: string,
    skillName: string,
    files: readonly { path: string; content: string }[],
  ): Promise<void> {
    const root = path.join(
      this.workspaceDir(conversationUuid),
      "skills",
      safeRelativePath(skillName.replaceAll("/", "-")),
    );
    for (const file of files.slice(0, 100)) {
      const relative = safeRelativePath(file.path);
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf8");
    }
  }

  // Resolve a generated file for the local download endpoint. Returns null
  // when the path escapes the workspace or does not exist.
  async workspaceFile(
    conversationUuid: string,
    relativePath: string,
  ): Promise<{ absolutePath: string; size_bytes: number } | null> {
    let absolutePath: string;
    try {
      absolutePath = path.join(
        this.workspaceDir(conversationUuid),
        safeRelativePath(relativePath),
      );
    } catch {
      return null;
    }
    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) return null;
      return { absolutePath, size_bytes: info.size };
    } catch {
      return null;
    }
  }

  // Incognito conversations mark their workspace so nothing persists on
  // disk past the session.
  markEphemeral(conversationUuid: string): void {
    try {
      this.#ephemeralWorkspaces.add(this.workspaceDir(conversationUuid));
    } catch {
      // Invalid ids never created a workspace.
    }
  }

  // Deleting a conversation removes its container and workspace directory.
  async removeWorkspace(conversationUuid: string): Promise<void> {
    let workspace: string;
    try {
      workspace = this.workspaceDir(conversationUuid);
    } catch {
      return;
    }
    const name = `${CONTAINER_PREFIX}${conversationKey(conversationUuid)}`;
    this.#containers.delete(name);
    this.#containerNetwork.delete(name);
    this.#ephemeralWorkspaces.delete(workspace);
    await runDocker(["rm", "-f", name], { timeoutMs: 60_000 });
    await rm(workspace, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }

  dispose(): void {
    clearInterval(this.#reaper);
    for (const name of this.#containers.keys()) {
      // Fire and forget: --rm containers clean themselves up after the kill.
      void runDocker(["rm", "-f", name], { timeoutMs: 30_000 });
    }
    this.#containers.clear();
    this.#containerNetwork.clear();
    // Synchronous on purpose: this runs during app quit, after the
    // containers above were told to go; an async rm would not finish.
    for (const workspace of this.#ephemeralWorkspaces) {
      try {
        rmSync(workspace, { recursive: true, force: true });
      } catch {
        // A file still held open leaves the directory for the next reap.
      }
    }
    this.#ephemeralWorkspaces.clear();
  }
}
