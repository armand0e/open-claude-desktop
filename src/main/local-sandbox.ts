import { spawn } from "node:child_process";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

// Chat-mode file processing and data analysis ("wiggle" in the retained
// client): a Docker-backed Linux runtime with node/npm and python/uv
// preinstalled. Each conversation gets a private, persistent /workspace under
// the profile, while every command uses a short-lived container bind-mounted
// to that directory. Uploads flow in and generated files flow out without
// docker cp. The image builds once from the embedded Dockerfile below.

const IMAGE_REPOSITORY = "open-claude-sandbox";
const CONTAINER_PREFIX = "open-claude-sbx-";
const CONTAINER_LABEL = "io.openclaude.sandbox";
const EXEC_TIMEOUT_SECONDS = 180;
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_CONTAINER_MS = 30 * 60 * 1000;
const MAX_OUTPUT_CHARS = 24_000;
const MAX_LISTED_FILES = 200;
const STATUS_CACHE_MS = 3_000;
const MAX_SKILL_FILE_BYTES = 1024 * 1024;
const MAX_SKILL_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_UPLOAD_FILES = 100;
const MAX_UPLOAD_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_COMMAND_CHARS = 100_000;
const MAX_SKILL_FILES = 100;
const UPLOAD_MANIFEST = "_open_claude_manifest.json";

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
const IMAGE_TAG = `${IMAGE_REPOSITORY}:${createHash("sha256")
  .update(DOCKERFILE)
  .digest("hex")
  .slice(0, 16)}`;

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

export type SandboxDockerRunner = (
  args: readonly string[],
  options?: { input?: string; timeoutMs?: number; signal?: AbortSignal },
) => Promise<DockerInvocation>;

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
    if (options.signal?.aborted) onAbort();
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
    child.stdin?.on("error", (error: NodeJS.ErrnoException) => {
      child.kill();
      finish({
        missing: error.code === "ENOENT",
        code: null,
        stdout,
        stderr: error.message,
      });
    });
    if (options.input !== undefined) {
      child.stdin?.write(options.input, (error) => {
        if (!error) return;
        child.kill();
        finish({
          missing: false,
          code: null,
          stdout,
          stderr: error.message,
        });
      });
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
  if (!value || value.length > 4_096 || value.includes("\0"))
    throw new Error("Invalid sandbox file path");
  const normalized = value.replaceAll("\\", "/");
  const parts = normalized.split("/").filter((part) => part && part !== ".");
  if (
    parts.length === 0 ||
    parts.length > 100 ||
    parts.some((part) => part === "..")
  )
    throw new Error("Invalid sandbox file path");
  return parts.join("/");
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function safeDirectory(
  workspace: string,
  relativeDirectory: string,
): Promise<string> {
  await mkdir(workspace, { recursive: true });
  const workspaceInfo = await lstat(workspace);
  if (!workspaceInfo.isDirectory() || workspaceInfo.isSymbolicLink())
    throw new Error("Sandbox workspace is not a safe directory");
  const canonicalWorkspace = await realpath(workspace);
  let current = workspace;
  const parts = relativeDirectory
    ? safeRelativePath(relativeDirectory).split("/")
    : [];
  for (const part of parts) {
    current = path.join(current, part);
    await mkdir(current).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Sandbox path contains a link or non-directory");
    const canonical = await realpath(current);
    if (!isWithin(canonicalWorkspace, canonical))
      throw new Error("Sandbox path escaped its workspace");
  }
  return current;
}

async function replaceWorkspaceFile(
  workspace: string,
  relativePath: string,
  write: (temporaryPath: string) => Promise<void>,
): Promise<void> {
  const safePath = safeRelativePath(relativePath);
  const directoryPart = path.posix.dirname(safePath);
  const directory = await safeDirectory(
    workspace,
    directoryPart === "." ? "" : directoryPart,
  );
  const target = path.join(directory, path.posix.basename(safePath));
  const temporary = path.join(directory, `.open-claude-${randomUUID()}.tmp`);
  const backup = path.join(directory, `.open-claude-${randomUUID()}.bak`);
  let backupContainsOriginal = false;
  try {
    await write(temporary);
    const tempInfo = await lstat(temporary);
    if (!tempInfo.isFile() || tempInfo.isSymbolicLink())
      throw new Error("Sandbox staging did not create a regular file");
    const existing = await lstat(target).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      },
    );
    if (existing) {
      if (!existing.isFile() && !existing.isSymbolicLink())
        throw new Error("Sandbox target is not a regular file");
      await rename(target, backup);
      backupContainsOriginal = true;
    }
    try {
      await rename(temporary, target);
    } catch (error) {
      if (backupContainsOriginal) {
        await rename(backup, target);
        backupContainsOriginal = false;
      }
      throw error;
    }
    if (backupContainsOriginal) {
      await rm(backup, { force: true }).catch(() => undefined);
      backupContainsOriginal = false;
    }
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
    if (!backupContainsOriginal)
      await rm(backup, { force: true }).catch(() => undefined);
  }
}

async function readUploadSource(sourcePath: string): Promise<Buffer> {
  if (typeof sourcePath !== "string")
    throw new Error("Sandbox upload details are invalid");
  const expectedSource = await realpath(sourcePath);
  if (!isWithin(expectedSource, path.resolve(sourcePath)))
    throw new Error("Sandbox upload source cannot be a symbolic link");
  const sourceHandle = await open(
    expectedSource,
    constants.O_RDONLY |
      (process.platform === "win32" ? 0 : constants.O_NOFOLLOW),
  );
  try {
    const source = await sourceHandle.stat();
    if (!source.isFile() || source.size > MAX_UPLOAD_BYTES)
      throw new Error(
        "Sandbox uploads must be regular files no larger than 50 MB",
      );
    const confirmed = await realpath(expectedSource);
    const confirmedInfo = await stat(confirmed);
    if (
      !isWithin(expectedSource, confirmed) ||
      confirmedInfo.dev !== source.dev ||
      confirmedInfo.ino !== source.ino
    )
      throw new Error("Sandbox upload source changed while being opened");
    const sourceBytes = await sourceHandle.readFile();
    if (sourceBytes.byteLength > MAX_UPLOAD_BYTES)
      throw new Error(
        "Sandbox uploads must be regular files no larger than 50 MB",
      );
    return sourceBytes;
  } finally {
    await sourceHandle.close();
  }
}

function uniqueUploadName(fileName: string, used: Set<string>): string {
  const cleaned = path
    .basename(fileName.replaceAll("\\", "/"))
    .replaceAll("\0", "")
    .slice(0, 255);
  const initial = safeRelativePath(cleaned || "attachment");
  const comparable = (value: string) => value.toLowerCase();
  if (!used.has(comparable(initial))) {
    used.add(comparable(initial));
    return initial;
  }
  const extension = path.posix.extname(initial);
  const stem = initial.slice(0, initial.length - extension.length);
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const marker = ` (${suffix})`;
    const candidate = `${stem.slice(0, 255 - extension.length - marker.length)}${marker}${extension}`;
    if (used.has(comparable(candidate))) continue;
    used.add(comparable(candidate));
    return candidate;
  }
  throw new Error("Could not assign a unique sandbox upload name");
}

function sanitizeCommandOutput(value: string): string {
  return value
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      "",
    );
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
        const info = await lstat(absolute);
        if (info.isSymbolicLink()) continue;
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
  readonly #ownerId: string;
  readonly #docker: SandboxDockerRunner;
  #building = false;
  #buildDetail = "";
  #buildError = "";
  #imageReady = false;
  #reaped = false;
  #reapPromise: Promise<void> | null = null;
  #statusCache: { at: number; value: SandboxStatus } | null = null;
  // Containers this process started: name -> last-use timestamp.
  readonly #containers = new Map<string, number>();
  // The network mode each container was created with; a changed egress
  // setting recreates the container instead of silently keeping the old one.
  readonly #containerNetwork = new Map<string, boolean>();
  readonly #workspaceRemovals = new Map<string, string>();
  // Workspaces of incognito conversations: deleted on dispose so no chat
  // data outlives the in-memory conversation.
  readonly #ephemeralWorkspaces = new Set<string>();
  readonly #ensureChains = new Map<string, Promise<string>>();
  readonly #executionChains = new Map<string, Promise<void>>();
  readonly #executionAborts = new Set<AbortController>();
  readonly #skillStageChains = new Map<string, Promise<void>>();
  readonly #reaper: NodeJS.Timeout;
  #buildPromise: Promise<void> | null = null;
  #buildAbort: AbortController | null = null;
  #disposed = false;

  constructor(userDataPath: string, docker: SandboxDockerRunner = runDocker) {
    this.#docker = docker;
    this.#rootDir = path.join(userDataPath, "sandbox");
    const ownerPath = path.resolve(this.#rootDir);
    this.#ownerId = createHash("sha256")
      .update(
        process.platform === "win32" ? ownerPath.toLowerCase() : ownerPath,
      )
      .digest("hex")
      .slice(0, 12);
    this.#reaper = setInterval(() => void this.#reapIdle(), 5 * 60 * 1000);
    this.#reaper.unref?.();
    // Clean up a container left by a previous crash even when the user does
    // not immediately run another code-execution command after restarting.
    void this.#reapStale().catch(() => undefined);
  }

  workspaceDir(conversationUuid: string): string {
    return path.join(this.#rootDir, conversationKey(conversationUuid));
  }

  #containerName(conversationUuid: string): string {
    return `${CONTAINER_PREFIX}${this.#ownerId}-${conversationKey(conversationUuid)}`;
  }

  async #removeContainer(name: string, timeoutMs = 60_000): Promise<boolean> {
    const removed = await this.#docker(["rm", "-f", name], { timeoutMs });
    return removed.code === 0 || /No such container/i.test(removed.stderr);
  }

  async #removeOwnedContainers(timeoutMs = 60_000): Promise<boolean> {
    const listed = await this.#docker(
      [
        "ps",
        "-aq",
        "--filter",
        `label=${CONTAINER_LABEL}.owner=${this.#ownerId}`,
      ],
      { timeoutMs },
    );
    if (listed.missing || listed.code !== 0) return false;
    const ids = listed.stdout.split(/\s+/).filter(Boolean);
    if (ids.length === 0) return true;
    const removed = await this.#docker(["rm", "-f", ...ids], { timeoutMs });
    return removed.code === 0 || /No such container/i.test(removed.stderr);
  }

  async status(): Promise<SandboxStatus> {
    const cached = this.#statusCache;
    if (cached && Date.now() - cached.at < STATUS_CACHE_MS) return cached.value;
    const value = await this.#probeStatus();
    this.#statusCache = { at: Date.now(), value };
    return value;
  }

  async #probeStatus(): Promise<SandboxStatus> {
    const probe = await this.#docker(
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
    const inspect = await this.#docker(["image", "inspect", IMAGE_TAG], {
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
    if (this.#disposed || this.#building || this.#imageReady) return;
    this.#building = true;
    this.#buildError = "";
    this.#buildDetail = "Building the code execution image (one time)…";
    this.#statusCache = null;
    const controller = new AbortController();
    this.#buildAbort = controller;
    const buildPromise = (async () => {
      const probe = await this.#docker(["version"], {
        timeoutMs: 10_000,
        signal: controller.signal,
      });
      if (probe.missing || probe.code !== 0) {
        return;
      }
      const inspect = await this.#docker(["image", "inspect", IMAGE_TAG], {
        timeoutMs: 10_000,
        signal: controller.signal,
      });
      if (inspect.code === 0) {
        this.#imageReady = true;
        return;
      }
      const build = await this.#docker(
        ["build", "--pull", "-t", IMAGE_TAG, "-"],
        {
          input: DOCKERFILE,
          timeoutMs: BUILD_TIMEOUT_MS,
          signal: controller.signal,
        },
      );
      if (controller.signal.aborted) return;
      if (build.code === 0) {
        this.#imageReady = true;
        return;
      }
      const tail = (build.stderr || build.stdout).trim().split("\n").at(-1);
      this.#buildError = `Image build failed${tail ? `: ${tail.slice(0, 300)}` : ""}`;
    })().finally(() => {
      if (this.#buildPromise !== buildPromise) return;
      this.#building = false;
      this.#statusCache = null;
      this.#buildPromise = null;
      this.#buildAbort = null;
    });
    this.#buildPromise = buildPromise;
  }

  async #reapStale(): Promise<void> {
    if (this.#reaped) return;
    if (!this.#reapPromise) {
      // Coalesce this global startup barrier. Per-container ensure chains do
      // not protect different conversations: without this barrier a second
      // stale scan can observe and delete a container the first call just
      // created.
      this.#reapPromise = (async () => {
        if (!(await this.#removeOwnedContainers())) return;
        this.#reaped = true;
      })();
    }
    const pending = this.#reapPromise;
    try {
      await pending;
    } finally {
      if (this.#reapPromise === pending) this.#reapPromise = null;
    }
  }

  async #reapIdle(): Promise<void> {
    const now = Date.now();
    for (const [name, lastUse] of this.#containers) {
      if (now - lastUse < IDLE_CONTAINER_MS) continue;
      if (!(await this.#removeContainer(name))) continue;
      this.#containers.delete(name);
      this.#containerNetwork.delete(name);
      const workspace = this.#workspaceRemovals.get(name);
      if (workspace) {
        await rm(workspace, { recursive: true, force: true }).catch(
          () => undefined,
        );
        this.#workspaceRemovals.delete(name);
      }
    }
  }

  async #ensureContainer(
    conversationUuid: string,
    allowNetwork: boolean,
  ): Promise<string> {
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    const key = conversationKey(conversationUuid);
    const name = `${CONTAINER_PREFIX}${this.#ownerId}-${key}`;
    const pending = this.#ensureChains.get(name) ?? Promise.resolve("");
    const chained = pending
      .catch(() => undefined)
      .then(async () => {
        if (this.#disposed) throw new Error("Sandbox is shutting down");
        if (this.#workspaceRemovals.has(name))
          throw new Error("Sandbox workspace is being removed");
        await this.#reapStale();
        if (
          this.#containers.has(name) &&
          this.#containerNetwork.get(name) === allowNetwork
        ) {
          const running = await this.#docker([
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
        if (!(await this.#removeContainer(name))) {
          this.#containers.set(name, 0);
          throw new Error("Could not replace the previous sandbox container");
        }
        this.#containers.delete(name);
        this.#containerNetwork.delete(name);
        const workspace = this.workspaceDir(conversationUuid);
        await mkdir(path.join(workspace, "uploads"), { recursive: true });
        const run = await this.#docker(
          [
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "--label",
            `${CONTAINER_LABEL}=1`,
            "--label",
            `${CONTAINER_LABEL}.owner=${this.#ownerId}`,
            ...(allowNetwork ? [] : ["--network", "none"]),
            "--read-only",
            "--tmpfs",
            "/tmp:rw,nosuid,nodev,size=512m",
            "--tmpfs",
            "/run:rw,nosuid,nodev,size=16m",
            "--env",
            "HOME=/tmp/home",
            "--env",
            "XDG_CACHE_HOME=/tmp/cache",
            "--env",
            "MPLCONFIGDIR=/tmp/matplotlib",
            "--memory",
            "2g",
            "--cpus",
            "2",
            "--pids-limit",
            "512",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--ulimit",
            "core=0:0",
            "--ulimit",
            "fsize=209715200:209715200",
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
        if (this.#disposed) {
          if (!(await this.#removeContainer(name))) {
            this.#containers.set(name, 0);
            this.#containerNetwork.set(name, allowNetwork);
          }
          throw new Error("Sandbox is shutting down");
        }
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
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    const name = this.#containerName(conversationUuid);
    const previous = this.#executionChains.get(name) ?? Promise.resolve();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.#executionChains.set(name, barrier);
    await previous.catch(() => undefined);
    if (this.#disposed || options.signal.aborted) {
      release();
      if (this.#executionChains.get(name) === barrier)
        this.#executionChains.delete(name);
      throw new Error(
        this.#disposed
          ? "Sandbox is shutting down"
          : "Code execution cancelled",
      );
    }
    const controller = new AbortController();
    const relayAbort = () => controller.abort();
    options.signal.addEventListener("abort", relayAbort, { once: true });
    this.#executionAborts.add(controller);
    try {
      return await this.#runCommandNow(conversationUuid, command, {
        allowNetwork: options.allowNetwork,
        signal: controller.signal,
      });
    } finally {
      options.signal.removeEventListener("abort", relayAbort);
      this.#executionAborts.delete(controller);
      release();
      if (this.#executionChains.get(name) === barrier)
        this.#executionChains.delete(name);
    }
  }

  async #runCommandNow(
    conversationUuid: string,
    command: string,
    options: { allowNetwork: boolean; signal: AbortSignal },
  ): Promise<SandboxRunResult> {
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    if (!command.trim()) throw new Error("A command is required");
    if (command.length > MAX_COMMAND_CHARS)
      throw new Error(
        `Commands are limited to ${MAX_COMMAND_CHARS} characters`,
      );
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
    const exec = await this.#docker(
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
    // A container is an execution-scoped resource. Always remove it after the
    // command, including success: background children otherwise survive the
    // shell and `sleep infinity` leaves Docker containers hanging when the
    // app or a smoke probe exits without a graceful Electron shutdown.
    if (await this.#removeContainer(name)) {
      this.#containers.delete(name);
      this.#containerNetwork.delete(name);
    } else this.#containers.set(name, 0);
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
    let output = sanitizeCommandOutput(combined);
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
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    if (typeof fileName !== "string" || typeof sourcePath !== "string")
      throw new Error("Sandbox upload details are invalid");
    const sourceBytes = await readUploadSource(sourcePath);
    const workspace = this.workspaceDir(conversationUuid);
    const safeName = safeRelativePath(path.basename(fileName));
    await replaceWorkspaceFile(workspace, `uploads/${safeName}`, (temporary) =>
      writeFile(temporary, sourceBytes, { flag: "wx", mode: 0o600 }),
    );
  }

  // Atomically reconcile /workspace/uploads to the active conversation branch.
  // This prevents files from abandoned branches remaining model-visible and
  // preserves same-named uploads under deterministic disambiguated names.
  async syncUploads(
    conversationUuid: string,
    files: readonly {
      id: string;
      fileName: string;
      sourcePath: string;
    }[],
  ): Promise<void> {
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    if (files.length > MAX_UPLOAD_FILES)
      throw new Error(
        `The Chat file workspace supports at most ${MAX_UPLOAD_FILES} uploads`,
      );
    const workspace = this.workspaceDir(conversationUuid);
    const workspaceRoot = await safeDirectory(workspace, "");
    const staging = path.join(
      workspaceRoot,
      `.open-claude-${randomUUID()}.uploads.tmp`,
    );
    const backup = path.join(
      workspaceRoot,
      `.open-claude-${randomUUID()}.uploads.bak`,
    );
    const target = path.join(workspaceRoot, "uploads");
    const used = new Set<string>([UPLOAD_MANIFEST.toLowerCase()]);
    const manifest: Array<{
      id: string;
      original_name: string;
      path: string;
      size_bytes: number;
    }> = [];
    let totalBytes = 0;
    let movedExisting = false;
    try {
      await mkdir(staging);
      for (const file of files) {
        if (
          typeof file?.id !== "string" ||
          typeof file.fileName !== "string" ||
          typeof file.sourcePath !== "string"
        )
          throw new Error("Sandbox upload details are invalid");
        const sourceBytes = await readUploadSource(file.sourcePath);
        totalBytes += sourceBytes.byteLength;
        if (totalBytes > MAX_UPLOAD_TOTAL_BYTES)
          throw new Error(
            "Chat file workspace uploads exceed the 200 MB total limit",
          );
        const workspaceName = uniqueUploadName(file.fileName, used);
        await replaceWorkspaceFile(staging, workspaceName, (temporary) =>
          writeFile(temporary, sourceBytes, { flag: "wx", mode: 0o600 }),
        );
        manifest.push({
          id: file.id.slice(0, 256),
          original_name: path
            .basename(file.fileName.replaceAll("\\", "/"))
            .replaceAll("\0", "")
            .slice(0, 255),
          path: `/workspace/uploads/${workspaceName}`,
          size_bytes: sourceBytes.byteLength,
        });
      }
      await replaceWorkspaceFile(staging, UPLOAD_MANIFEST, (temporary) =>
        writeFile(
          temporary,
          `${JSON.stringify({ version: 1, files: manifest }, null, 2)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 },
        ),
      );
      const existing = await lstat(target).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        },
      );
      if (existing) {
        await rename(target, backup);
        movedExisting = true;
      }
      try {
        await rename(staging, target);
      } catch (error) {
        if (movedExisting) await rename(backup, target);
        movedExisting = false;
        throw error;
      }
      if (movedExisting) {
        await rm(backup, { recursive: true, force: true });
        movedExisting = false;
      }
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(
        () => undefined,
      );
      // Preserve the last good upload snapshot if rollback itself fails.
      if (!movedExisting)
        await rm(backup, { recursive: true, force: true }).catch(
          () => undefined,
        );
    }
  }

  async stageSkillFiles(
    conversationUuid: string,
    skillName: string,
    files: readonly { path: string; content: string }[],
  ): Promise<void> {
    if (this.#disposed) throw new Error("Sandbox is shutting down");
    if (files.length > MAX_SKILL_FILES)
      throw new Error(`Sandbox skills are limited to ${MAX_SKILL_FILES} files`);
    const workspace = this.workspaceDir(conversationUuid);
    const safeSkill = safeRelativePath(
      skillName.replaceAll("/", "-").replaceAll("\\", "-"),
    );
    let totalBytes = 0;
    const seen = new Set<string>();
    const validated = files.map((file) => {
      if (typeof file?.path !== "string" || typeof file.content !== "string")
        throw new Error("Sandbox skill file details are invalid");
      const relative = safeRelativePath(file.path);
      const comparable =
        process.platform === "win32" ? relative.toLowerCase() : relative;
      if (seen.has(comparable))
        throw new Error(`Sandbox skill contains a duplicate path: ${relative}`);
      seen.add(comparable);
      const bytes = Buffer.byteLength(file.content, "utf8");
      if (bytes > MAX_SKILL_FILE_BYTES)
        throw new Error("Sandbox skill file exceeds the 1 MB limit");
      totalBytes += bytes;
      if (totalBytes > MAX_SKILL_TOTAL_BYTES)
        throw new Error("Sandbox skill files exceed the 16 MB limit");
      return { relative, content: file.content };
    });
    const chainKey = path.join(workspace, "skills", safeSkill);
    const previous = this.#skillStageChains.get(chainKey) ?? Promise.resolve();
    const pending = previous
      .catch(() => undefined)
      .then(async () => {
        const skillsDirectory = await safeDirectory(workspace, "skills");
        const target = path.join(skillsDirectory, safeSkill);
        const staging = path.join(
          skillsDirectory,
          `.open-claude-${randomUUID()}.skill.tmp`,
        );
        const backup = path.join(
          skillsDirectory,
          `.open-claude-${randomUUID()}.skill.bak`,
        );
        let movedExisting = false;
        try {
          await mkdir(staging);
          for (const file of validated) {
            await replaceWorkspaceFile(staging, file.relative, (temporary) =>
              writeFile(temporary, file.content, {
                encoding: "utf8",
                flag: "wx",
              }),
            );
          }
          const existing = await lstat(target).catch(
            (error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") return null;
              throw error;
            },
          );
          if (existing) {
            if (!existing.isDirectory() && !existing.isSymbolicLink())
              throw new Error("Sandbox skill target is not a directory");
            await rename(target, backup);
            movedExisting = true;
          }
          try {
            await rename(staging, target);
          } catch (error) {
            if (movedExisting) await rename(backup, target);
            movedExisting = false;
            throw error;
          }
          if (movedExisting) {
            await rm(backup, { recursive: true, force: true });
            movedExisting = false;
          }
        } finally {
          await rm(staging, { recursive: true, force: true }).catch(
            () => undefined,
          );
          // A failure after moving the old tree but before rollback is rare,
          // but leaving the backup is safer than deleting the last good copy.
          if (!movedExisting)
            await rm(backup, { recursive: true, force: true }).catch(
              () => undefined,
            );
        }
      });
    this.#skillStageChains.set(chainKey, pending);
    try {
      await pending;
    } finally {
      if (this.#skillStageChains.get(chainKey) === pending)
        this.#skillStageChains.delete(chainKey);
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
      const workspace = this.workspaceDir(conversationUuid);
      const canonicalWorkspace = await realpath(workspace);
      const candidateInfo = await lstat(absolutePath);
      if (candidateInfo.isSymbolicLink()) return null;
      const canonicalFile = await realpath(absolutePath);
      if (!isWithin(canonicalWorkspace, canonicalFile)) return null;
      const info = await stat(canonicalFile);
      if (!info.isFile()) return null;
      return { absolutePath: canonicalFile, size_bytes: info.size };
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

  // Remove durable workspaces that no persisted conversation owns. This also
  // clears incognito workspaces left by a crash; links are unlinked rather than
  // followed, and every recursive target is canonicalized under #rootDir.
  async reconcileWorkspaces(
    activeConversationUuids: readonly string[],
  ): Promise<void> {
    if (this.#disposed) return;
    const active = new Set(
      activeConversationUuids.map((uuid) => conversationKey(uuid)),
    );
    await mkdir(this.#rootDir, { recursive: true });
    const canonicalRoot = await realpath(this.#rootDir);
    const names = await readdir(this.#rootDir);
    for (const name of names) {
      let key: string;
      try {
        key = conversationKey(name);
      } catch {
        continue;
      }
      const candidate = path.join(this.#rootDir, name);
      const info = await lstat(candidate).catch(() => null);
      if (!info) continue;
      if (info.isSymbolicLink()) {
        await rm(candidate, { force: true }).catch(() => undefined);
        continue;
      }
      if (!info.isDirectory() || active.has(key)) continue;
      const canonicalCandidate = await realpath(candidate).catch(() => null);
      if (
        !canonicalCandidate ||
        !isWithin(canonicalRoot, canonicalCandidate) ||
        canonicalCandidate === canonicalRoot
      )
        continue;
      await rm(canonicalCandidate, { recursive: true, force: true }).catch(
        () => undefined,
      );
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
    const name = this.#containerName(conversationUuid);
    this.#workspaceRemovals.set(name, workspace);
    await this.#executionChains.get(name)?.catch(() => undefined);
    await this.#ensureChains.get(name)?.catch(() => undefined);
    this.#ephemeralWorkspaces.delete(workspace);
    if (await this.#removeContainer(name)) {
      this.#containers.delete(name);
      this.#containerNetwork.delete(name);
      this.#workspaceRemovals.delete(name);
      await rm(workspace, { recursive: true, force: true }).catch(
        () => undefined,
      );
    } else {
      // Keep it in the idle map so the periodic reaper retries instead of
      // forgetting a still-running container that can mutate the bind mount.
      this.#containers.set(name, 0);
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    clearInterval(this.#reaper);
    this.#buildAbort?.abort();
    for (const controller of this.#executionAborts) controller.abort();
    await this.#buildPromise?.catch(() => undefined);
    await Promise.allSettled([...this.#executionChains.values()]);
    await Promise.allSettled([...this.#ensureChains.values()]);
    await Promise.allSettled([...this.#skillStageChains.values()]);
    const removals = await Promise.all(
      [...this.#containers.keys()].map(async (name) => ({
        name,
        removed: await this.#removeContainer(name, 30_000),
      })),
    );
    for (const removal of removals) {
      if (!removal.removed) continue;
      this.#containers.delete(removal.name);
      this.#containerNetwork.delete(removal.name);
      const workspace = this.#workspaceRemovals.get(removal.name);
      if (workspace) {
        await rm(workspace, { recursive: true, force: true }).catch(
          () => undefined,
        );
        this.#workspaceRemovals.delete(removal.name);
      }
    }
    if (await this.#removeOwnedContainers(30_000)) {
      this.#containers.clear();
      this.#containerNetwork.clear();
    }
    await Promise.all(
      [...this.#ephemeralWorkspaces].map((workspace) =>
        rm(workspace, { recursive: true, force: true }).catch(() => undefined),
      ),
    );
    this.#ephemeralWorkspaces.clear();
  }
}
