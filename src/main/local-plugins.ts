// Local plugin manager backing the native LocalPlugins service: install
// Claude Code plugin zips (.claude-plugin/plugin.json manifests with
// skills/, commands/, agents/, hooks/, MCP servers, and CLI metadata), list
// them in the shape the retained client normalizes, and toggle/delete them.
// Directory installs use a bundled snapshot of Anthropic's public GitHub
// marketplaces, so browsing never depends on an account or cloud directory.

import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { constants as fsConstants } from "node:fs";
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
import pluginDirectorySnapshot from "../shared/plugin-directory-snapshot.json";
import { zipEntries } from "./local-extract";
import { readResponseBytes } from "./bounded-response";
import {
  assertBoundedJson,
  readRecoverableBoundedJsonFile,
} from "./bounded-json-file";

type JsonObject = Record<string, unknown>;

const MAX_PLUGIN_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_PLUGIN_FILES = 2_000;
const MAX_PLUGIN_ENTRY_BYTES = 32 * 1024 * 1024;
const MAX_PLUGIN_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_SKILL_FILES = 200;
const MAX_SKILL_FILE_BYTES = 512 * 1024;
const MAX_SKILL_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_SKILL_DEPTH = 16;
const MAX_ENTRY_NAME_CHARS = 512;
const MAX_ENTRY_DESCRIPTION_CHARS = 20_000;
const MAX_ARGUMENT_HINT_CHARS = 2_000;
const LOCAL_MARKETPLACE = "local";
const MAX_CAPABILITY_JSON_BYTES = 4 * 1024 * 1024;
const MAX_HOOK_COMMAND_CHARS = 8_192;
const MAX_HOOK_INPUT_BYTES = 512 * 1024;
const MAX_HOOK_OUTPUT_BYTES = 1024 * 1024;
const MAX_HOOK_TIMEOUT_MS = 120_000;

interface CatalogPlugin {
  id: string;
  displayName: string;
  description: string;
  author?: string;
  category?: string;
  homepage?: string;
  marketplace: string;
  source: {
    repository: string;
    commit: string;
    path?: string;
    skills?: string[];
  };
}

const LOCAL_PLUGIN_CATALOG = new Map(
  (pluginDirectorySnapshot.plugins as CatalogPlugin[]).map((plugin) => [
    plugin.id,
    plugin,
  ]),
);

export interface LocalPluginCustomization {
  kind: "skill" | "command" | "agent";
  name: string;
  description: string;
  content: string;
  directory: string;
}

export interface LocalPluginSkill {
  name: string;
  content: string;
  directory: string;
  files: Array<{ path: string; content: string }>;
}

export interface LocalPluginHookResult {
  plugin: string;
  event: string;
  command: string;
  output: string;
  exitCode: number | null;
  blocking: boolean;
}

interface PluginState {
  enabled: boolean;
  installedAt: string;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function boundedText(value: unknown, limit: number): string | undefined {
  return text(value)?.slice(0, limit);
}

function samePath(left: string, right: string): boolean {
  const leftPath = path.resolve(left);
  const rightPath = path.resolve(right);
  return process.platform === "win32"
    ? leftPath.toLowerCase() === rightPath.toLowerCase()
    : leftPath === rightPath;
}

async function readSafeText(
  filePath: string,
  maxBytes = MAX_SKILL_FILE_BYTES,
): Promise<{ content: string; bytes: number }> {
  const lexical = await lstat(filePath);
  if (lexical.isSymbolicLink() || !lexical.isFile())
    throw new Error("Plugin entry is not a safe regular file");
  const expected = await realpath(filePath);
  if (!samePath(expected, filePath))
    throw new Error("Plugin entry is not a safe regular file");
  const handle = await open(
    expected,
    fsConstants.O_RDONLY |
      (process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW),
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes)
      throw new Error("Plugin entry exceeds its local safety limit");
    const confirmed = await realpath(expected);
    const confirmedInfo = await stat(confirmed);
    if (
      !samePath(expected, confirmed) ||
      confirmedInfo.dev !== info.dev ||
      confirmedInfo.ino !== info.ino
    )
      throw new Error("Plugin entry changed while it was being opened");
    const bytes = await handle.readFile();
    if (bytes.byteLength > maxBytes)
      throw new Error("Plugin entry exceeds its local safety limit");
    return {
      content: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      bytes: bytes.byteLength,
    };
  } finally {
    await handle.close();
  }
}

// SKILL.md / command frontmatter: a permissive YAML subset (string fields).
function frontmatterField(content: string, field: string): string | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return undefined;
  const line = match[1].match(
    new RegExp(`^${field}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))$`, "m"),
  );
  const value = (line?.[1] ?? line?.[2] ?? line?.[3])?.trim();
  return value || undefined;
}

function safePluginName(value: string): string | undefined {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value) ? value : undefined;
}

function safeArchivePath(value: string): string | undefined {
  if (!value || value.includes("\0")) return undefined;
  const normalized = value.replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized))
    return undefined;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === ".."))
    return undefined;
  return parts.join("/");
}

function decodeStrictBase64(value: string): Buffer | undefined {
  const normalized = value.replace(/[\t\n\r ]/g, "");
  if (
    !normalized ||
    normalized.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      normalized,
    )
  )
    return undefined;
  const decoded = Buffer.from(normalized, "base64");
  return decoded.toString("base64") === normalized ? decoded : undefined;
}

function catalogRelativePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return safeArchivePath(value.replace(/^\.\//u, ""));
}

function catalogArchiveUrl(plugin: CatalogPlugin): string | undefined {
  const repository = plugin.source.repository.match(
    /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/u,
  );
  if (!repository || !/^[a-f0-9]{40}$/iu.test(plugin.source.commit))
    return undefined;
  return `https://codeload.github.com/${repository[1]}/${repository[2]}/zip/${plugin.source.commit}`;
}

function withPluginRoot(value: unknown, root: string): unknown {
  if (typeof value === "string")
    return value.replaceAll("${CLAUDE_PLUGIN_ROOT}", root);
  if (Array.isArray(value))
    return value.map((entry) => withPluginRoot(entry, root));
  if (isObject(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        withPluginRoot(entry, root),
      ]),
    );
  return value;
}

function terminateHook(child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    const killer = spawn(
      "taskkill.exe",
      ["/pid", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" },
    );
    killer.once("error", () => child.kill());
    return;
  }
  child.kill("SIGKILL");
}

function simplePatternMatches(pattern: string, value: string): boolean {
  return pattern.split("|").some((candidate) => {
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === "*") return true;
    if (trimmed.endsWith("*")) return value.startsWith(trimmed.slice(0, -1));
    return value === trimmed;
  });
}

function hookGroupMatches(group: JsonObject, context: JsonObject): boolean {
  const toolName = text(context.toolName) ?? "";
  const matcher = text(group.matcher);
  if (matcher && !simplePatternMatches(matcher, toolName)) return false;
  const condition = text(group.if);
  if (!condition) return true;
  const parsed = condition.match(/^([^()]+)\((.*)\)$/u);
  if (!parsed || parsed[1] !== toolName) return false;
  const command = isObject(context.toolInput)
    ? (text(context.toolInput.command) ?? "")
    : "";
  return simplePatternMatches(parsed[2].replace(/:\*$/u, "*"), command);
}

export class LocalPluginManager {
  readonly #root: string;
  readonly #stateFile: string;
  #state: Record<string, PluginState> = {};
  #loadPromise: Promise<void> | null = null;
  #writeChain = Promise.resolve();
  #mutationChain = Promise.resolve();

  constructor(userDataPath: string) {
    this.#root = path.join(userDataPath, "plugins");
    this.#stateFile = path.join(this.#root, "plugins.json");
  }

  async #load(): Promise<void> {
    this.#loadPromise ??= (async () => {
      const parsed = await readRecoverableBoundedJsonFile(
        this.#stateFile,
        4 * 1024 * 1024,
        "local plugin state",
      );
      if (isObject(parsed))
        for (const [key, value] of Object.entries(parsed))
          if (safePluginName(key) && isObject(value))
            this.#state[key] = {
              enabled: value.enabled !== false,
              installedAt: text(value.installedAt) ?? new Date(0).toISOString(),
            };
    })();
    await this.#loadPromise;
  }

  async #persist(): Promise<void> {
    const serialized = `${JSON.stringify(this.#state, null, 2)}\n`;
    assertBoundedJson(serialized, 4 * 1024 * 1024, "local plugin state");
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(this.#root, { recursive: true });
        const temporary = `${this.#stateFile}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, serialized, {
            encoding: "utf8",
            mode: 0o600,
          });
          await rename(temporary, this.#stateFile);
        } finally {
          await rm(temporary, { force: true }).catch(() => undefined);
        }
      });
    this.#writeChain = pending;
    await pending;
  }

  #pluginDir(name: string): string {
    return path.join(this.#root, name);
  }

  #idFor(name: string): string {
    return `${name}@${LOCAL_MARKETPLACE}`;
  }

  #nameFromId(pluginId: string): string | undefined {
    if (!pluginId.endsWith(`@${LOCAL_MARKETPLACE}`)) return undefined;
    return safePluginName(pluginId.slice(0, -`@${LOCAL_MARKETPLACE}`.length));
  }

  #catalogName(pluginIdOrName: unknown): string | undefined {
    const value = text(pluginIdOrName);
    if (!value) return undefined;
    return safePluginName(value.split("@", 1)[0] ?? "");
  }

  #mutate<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.#mutationChain.catch(() => undefined).then(operation);
    this.#mutationChain = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async #installDirectory(
    name: string,
    replaceExisting: boolean,
    populate: (stagingDirectory: string) => Promise<void>,
  ): Promise<{
    installed: boolean;
    replaced: boolean;
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
  }> {
    await mkdir(this.#root, { recursive: true });
    const directory = this.#pluginDir(name);
    const exists = await stat(directory).then(
      (value) => value.isDirectory(),
      () => false,
    );
    if (exists && !replaceExisting)
      return {
        installed: false,
        replaced: false,
        commit: async () => undefined,
        rollback: async () => undefined,
      };

    const nonce = randomUUID();
    const staging = path.join(this.#root, `.install-${name}-${nonce}`);
    const backup = path.join(this.#root, `.backup-${name}-${nonce}`);
    let movedExisting = false;
    try {
      await mkdir(staging, { recursive: false });
      await populate(staging);
      const manifest = await stat(
        path.join(staging, ".claude-plugin", "plugin.json"),
      );
      if (!manifest.isFile()) throw new Error("Plugin manifest was not staged");
      if (exists) {
        await rename(directory, backup);
        movedExisting = true;
      }
      try {
        await rename(staging, directory);
      } catch (error) {
        if (movedExisting)
          await rename(backup, directory).catch(() => undefined);
        throw error;
      }
      return {
        installed: true,
        replaced: exists,
        commit: async () => {
          if (movedExisting)
            await rm(backup, { recursive: true, force: true }).catch(
              () => undefined,
            );
        },
        rollback: async () => {
          await rm(directory, { recursive: true, force: true }).catch(
            () => undefined,
          );
          if (movedExisting)
            await rename(backup, directory).catch(() => undefined);
        },
      };
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(
        () => undefined,
      );
      // If restoring the previous directory failed, its backup is the only
      // recoverable copy. Never erase it from the failure cleanup path.
    }
  }

  async #collectEntries(
    directory: string,
    kind: "skills" | "commands" | "agents",
  ): Promise<JsonObject[]> {
    const results: JsonObject[] = [];
    const kindRoot = path.join(directory, kind);
    let names: string[] = [];
    try {
      const rootInfo = await lstat(kindRoot);
      if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) return results;
      names = await readdir(kindRoot);
    } catch {
      return results;
    }
    for (const name of names.slice(0, 200)) {
      try {
        const entryPath = path.join(kindRoot, name);
        const info = await lstat(entryPath);
        if (info.isSymbolicLink()) continue;
        if (kind === "skills" && info.isDirectory()) {
          const manifestPath = path.join(entryPath, "SKILL.md");
          const manifestInfo = await lstat(manifestPath);
          if (
            manifestInfo.isSymbolicLink() ||
            !manifestInfo.isFile() ||
            manifestInfo.size > MAX_SKILL_FILE_BYTES
          )
            continue;
          const { content: manifest } = await readSafeText(manifestPath);
          results.push({
            name: (frontmatterField(manifest, "name") ?? name).slice(
              0,
              MAX_ENTRY_NAME_CHARS,
            ),
            description: (
              frontmatterField(manifest, "description") ?? ""
            ).slice(0, MAX_ENTRY_DESCRIPTION_CHARS),
            argumentHint: frontmatterField(manifest, "argument-hint")?.slice(
              0,
              MAX_ARGUMENT_HINT_CHARS,
            ),
            location: `${kind}/${name}`,
            hostFilesystemLocation: entryPath,
            content: manifest.slice(0, 64_000),
            source: "plugin",
            userInvocable: true,
          });
        } else if (
          kind !== "skills" &&
          info.isFile() &&
          info.size <= MAX_SKILL_FILE_BYTES &&
          name.endsWith(".md")
        ) {
          const { content } = await readSafeText(entryPath);
          const base = name.replace(/\.md$/, "");
          results.push({
            name: (frontmatterField(content, "name") ?? base).slice(
              0,
              MAX_ENTRY_NAME_CHARS,
            ),
            description: (frontmatterField(content, "description") ?? "").slice(
              0,
              MAX_ENTRY_DESCRIPTION_CHARS,
            ),
            argumentHint: frontmatterField(content, "argument-hint")?.slice(
              0,
              MAX_ARGUMENT_HINT_CHARS,
            ),
            location: `${kind}/${name}`,
            hostFilesystemLocation: entryPath,
            content: content.slice(0, 64_000),
            source: "plugin",
          });
        }
      } catch {
        // Skip malformed entries; the rest of the plugin stays usable.
      }
    }
    return results;
  }

  async #readPluginJson(
    directory: string,
    relativePath: string,
  ): Promise<unknown> {
    const relative = catalogRelativePath(relativePath);
    if (!relative) return undefined;
    try {
      const loaded = await readSafeText(
        path.join(directory, ...relative.split("/")),
        MAX_CAPABILITY_JSON_BYTES,
      );
      return JSON.parse(loaded.content);
    } catch {
      return undefined;
    }
  }

  async #capabilities(
    directory: string,
    manifest: JsonObject,
  ): Promise<{
    hooks: JsonObject[];
    mcpServers: JsonObject[];
    clis: JsonObject[];
  }> {
    const mcpServers = new Map<string, JsonObject>();
    const addMcpServers = (candidate: unknown) => {
      if (!isObject(candidate)) return;
      const raw = isObject(candidate.mcpServers)
        ? candidate.mcpServers
        : candidate;
      for (const [name, config] of Object.entries(raw).slice(0, 200)) {
        if (!safePluginName(name) || !isObject(config) || mcpServers.has(name))
          continue;
        mcpServers.set(name, withPluginRoot(config, directory) as JsonObject);
      }
    };
    addMcpServers(await this.#readPluginJson(directory, ".mcp.json"));
    if (typeof manifest.mcpServers === "string")
      addMcpServers(await this.#readPluginJson(directory, manifest.mcpServers));
    else addMcpServers(manifest.mcpServers);

    const hookDocuments: unknown[] = [];
    for (const candidate of [
      "hooks/hooks.json",
      ".claude-plugin/hooks/hooks.json",
    ]) {
      const loaded = await this.#readPluginJson(directory, candidate);
      if (loaded !== undefined) hookDocuments.push(loaded);
    }
    if (typeof manifest.hooks === "string") {
      const loaded = await this.#readPluginJson(directory, manifest.hooks);
      if (loaded !== undefined) hookDocuments.push(loaded);
    } else if (manifest.hooks !== undefined) hookDocuments.push(manifest.hooks);
    const hooks = hookDocuments.flatMap((document) => {
      if (!isObject(document)) return [];
      const raw = isObject(document.hooks) ? document.hooks : document;
      return Object.entries(raw)
        .slice(0, 200)
        .map(([event, definitions]) => ({ event, definitions }));
    });

    const rawClis = manifest.clis;
    const clis = Array.isArray(rawClis)
      ? rawClis.filter(isObject).slice(0, 200)
      : isObject(rawClis)
        ? Object.entries(rawClis)
            .slice(0, 200)
            .flatMap(([name, value]) =>
              isObject(value) ? [{ name, ...value }] : [],
            )
        : [];
    return {
      hooks,
      mcpServers: [...mcpServers].map(([name, config]) => ({ name, config })),
      clis,
    };
  }

  async #record(name: string): Promise<JsonObject | null> {
    const directory = this.#pluginDir(name);
    let manifest: JsonObject = {};
    try {
      const manifestPath = path.join(
        directory,
        ".claude-plugin",
        "plugin.json",
      );
      const manifestInfo = await lstat(manifestPath);
      if (
        manifestInfo.isSymbolicLink() ||
        !manifestInfo.isFile() ||
        manifestInfo.size > MAX_SKILL_FILE_BYTES
      )
        return null;
      const parsed: unknown = JSON.parse(
        (await readSafeText(manifestPath)).content,
      );
      if (isObject(parsed)) manifest = parsed;
    } catch {
      return null;
    }
    const state = this.#state[name] ?? {
      enabled: true,
      installedAt: new Date().toISOString(),
    };
    const readmePath = path.join(directory, "README.md");
    let hasReadme = false;
    try {
      const readme = await lstat(readmePath);
      hasReadme = readme.isFile() && !readme.isSymbolicLink();
    } catch {
      // Optional.
    }
    const capabilities = await this.#capabilities(directory, manifest);
    return {
      id: this.#idFor(name),
      name,
      display_name:
        boundedText(manifest.displayName, MAX_ENTRY_NAME_CHARS) ??
        boundedText(manifest.display_name, MAX_ENTRY_NAME_CHARS),
      marketplaceName: LOCAL_MARKETPLACE,
      source: "local",
      scope: "user",
      enabled: state.enabled,
      installedBy: "user",
      installationPreference: "available",
      installPath: directory,
      ...(hasReadme ? { readmePath } : {}),
      description:
        boundedText(manifest.description, MAX_ENTRY_DESCRIPTION_CHARS) ?? "",
      version: boundedText(manifest.version, 256),
      author: isObject(manifest.author)
        ? {
            name: boundedText(manifest.author.name, MAX_ENTRY_NAME_CHARS) ?? "",
          }
        : boundedText(manifest.author, MAX_ENTRY_NAME_CHARS)
          ? { name: boundedText(manifest.author, MAX_ENTRY_NAME_CHARS)! }
          : undefined,
      lastUpdated: state.installedAt,
      skills: await this.#collectEntries(directory, "skills"),
      commands: await this.#collectEntries(directory, "commands"),
      agents: await this.#collectEntries(directory, "agents"),
      hooks: capabilities.hooks,
      mcpServers: capabilities.mcpServers,
      clis: capabilities.clis,
    };
  }

  async getPlugins(): Promise<JsonObject[]> {
    await this.#load();
    let names: string[] = [];
    try {
      names = (await readdir(this.#root, { withFileTypes: true }))
        .filter(
          (entry) =>
            entry.isDirectory() && safePluginName(entry.name) !== undefined,
        )
        .map((entry) => entry.name);
    } catch {
      return [];
    }
    const records: JsonObject[] = [];
    for (const name of names) {
      const record = await this.#record(name);
      if (record) records.push(record);
    }
    return records;
  }

  async listCatalogPlugins(): Promise<JsonObject[]> {
    const installed = new Set(
      (await this.getPlugins())
        .map((plugin) => text(plugin.name))
        .filter((name): name is string => Boolean(name)),
    );
    return [...LOCAL_PLUGIN_CATALOG.values()].map((plugin) => ({
      id: `${plugin.id}@${plugin.marketplace}`,
      name: plugin.id,
      displayName: plugin.displayName,
      display_name: plugin.displayName,
      description: plugin.description,
      marketplaceName: plugin.marketplace,
      marketplace_name: plugin.marketplace,
      version: plugin.source.commit.slice(0, 12),
      isInstalled: installed.has(plugin.id),
      installation_preference: "available",
      installationPreference: "available",
      category: plugin.category,
      homepage: plugin.homepage,
      author: plugin.author ? { name: plugin.author } : undefined,
      source: "local",
      skills: [],
      commands: [],
      agents: [],
    }));
  }

  async listCatalogMarketplaces(): Promise<JsonObject[]> {
    return (
      pluginDirectorySnapshot.sources as Array<{
        name: string;
        repository: string;
        commit: string;
      }>
    ).map((source) => ({
      name: source.name,
      displayName:
        source.name === "claude-plugins-official"
          ? "Anthropic"
          : "Knowledge work",
      sourceType: "github",
      repo: source.repository,
      lastRefreshedAt: pluginDirectorySnapshot.capturedAt,
      lastSyncedSha: source.commit,
      isDefault: true,
      source: "local",
    }));
  }

  async listLocalOrgPlugins(): Promise<JsonObject> {
    const plugins = await this.listCatalogPlugins();
    return {
      plugins: plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName,
        description: plugin.description,
        marketplaceName: plugin.marketplaceName,
        version: plugin.version,
        isInstalled: plugin.isInstalled,
        installationPreference: "available",
      })),
      indexUnavailable: false,
    };
  }

  async installNativePlugin(pluginIdOrName: unknown): Promise<JsonObject> {
    const name = this.#catalogName(pluginIdOrName);
    if (!name)
      return { success: false, error: "Unknown local catalog plugin." };
    const catalog = LOCAL_PLUGIN_CATALOG.get(name);
    if (!catalog)
      return { success: false, error: "Unknown local catalog plugin." };
    const result = await this.installCatalogPlugin(name);
    return {
      ...result,
      pluginId: `${name}@${catalog.marketplace}`,
    };
  }

  async uninstallNativePlugin(pluginIdOrName: unknown): Promise<void> {
    const name = this.#catalogName(pluginIdOrName);
    if (!name) throw new Error("Unknown plugin.");
    const result = await this.deletePlugin(this.#idFor(name));
    if (result.success !== true)
      throw new Error(text(result.error) ?? "Could not uninstall plugin.");
  }

  async enabledCustomizations(): Promise<LocalPluginCustomization[]> {
    const plugins = await this.getPlugins();
    const customizations: LocalPluginCustomization[] = [];
    for (const plugin of plugins) {
      if (plugin.enabled !== true) continue;
      const pluginName = text(plugin.name);
      if (!pluginName) continue;
      for (const [kind, field] of [
        ["skill", "skills"],
        ["command", "commands"],
        ["agent", "agents"],
      ] as const) {
        const entries = Array.isArray(plugin[field]) ? plugin[field] : [];
        for (const entry of entries) {
          if (!isObject(entry)) continue;
          const entryName = text(entry.name);
          const content = text(entry.content);
          const location = text(entry.hostFilesystemLocation);
          if (!entryName || !content || !location) continue;
          customizations.push({
            kind,
            name: `${pluginName}:${entryName}`,
            description: text(entry.description) ?? "",
            content,
            directory: kind === "skill" ? location : path.dirname(location),
          });
        }
      }
    }
    return customizations;
  }

  async readEnabledSkill(name: string): Promise<LocalPluginSkill | null> {
    const plugins = await this.getPlugins();
    for (const plugin of plugins) {
      if (plugin.enabled !== true) continue;
      const pluginName = text(plugin.name);
      const pluginId = text(plugin.id);
      if (!pluginName || !pluginId) continue;
      for (const rawSkill of Array.isArray(plugin.skills)
        ? plugin.skills
        : []) {
        if (!isObject(rawSkill)) continue;
        const skillName = text(rawSkill.name);
        if (!skillName || `${pluginName}:${skillName}` !== name) continue;
        const content = text(rawSkill.content);
        const directory = text(rawSkill.hostFilesystemLocation);
        if (!content || !directory) return null;
        const loaded = await this.listSkillFiles(pluginId, skillName);
        const files =
          isObject(loaded) && Array.isArray(loaded.files)
            ? loaded.files.flatMap((file) =>
                isObject(file) && text(file.path) && text(file.content)
                  ? [
                      {
                        path: text(file.path)!,
                        content: text(file.content)!,
                      },
                    ]
                  : [],
              )
            : [];
        return { name, content, directory, files };
      }
    }
    return null;
  }

  async enabledMcpServers(): Promise<Record<string, unknown>> {
    const plugins = await this.getPlugins();
    const configs: Record<string, unknown> = {};
    for (const plugin of plugins) {
      if (plugin.enabled !== true) continue;
      const pluginName = text(plugin.name);
      if (!pluginName) continue;
      for (const server of Array.isArray(plugin.mcpServers)
        ? plugin.mcpServers
        : []) {
        if (!isObject(server)) continue;
        const serverName = text(server.name);
        if (!serverName || !isObject(server.config)) continue;
        configs[`${pluginName}:${serverName}`] = server.config;
      }
    }
    return configs;
  }

  async #runHookCommand(
    plugin: string,
    event: string,
    commandValue: string,
    root: string,
    cwd: string,
    timeoutValue: unknown,
    context: JsonObject,
  ): Promise<LocalPluginHookResult> {
    const command = String(withPluginRoot(commandValue, root));
    const requestedTimeout = Number(timeoutValue) * 1_000;
    const timeoutMs =
      Number.isFinite(requestedTimeout) && requestedTimeout > 0
        ? Math.min(requestedTimeout, MAX_HOOK_TIMEOUT_MS)
        : 30_000;
    const input = JSON.stringify({
      hook_event_name: event,
      plugin_name: plugin,
      cwd,
      ...context,
    });
    if (
      !command ||
      command.length > MAX_HOOK_COMMAND_CHARS ||
      Buffer.byteLength(input, "utf8") > MAX_HOOK_INPUT_BYTES
    )
      return {
        plugin,
        event,
        command: command.slice(0, 240),
        output: "Plugin hook exceeded its local safety limit.",
        exitCode: null,
        blocking: true,
      };
    return new Promise((resolve) => {
      const child = spawn(command, [], {
        cwd,
        env: {
          ...process.env,
          CLAUDE_PLUGIN_ROOT: root,
          CLAUDE_PROJECT_DIR: cwd,
        },
        shell: true,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let output = "";
      let outputBytes = 0;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (exitCode: number | null, fallback = "") => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({
          plugin,
          event,
          command: command.slice(0, 240),
          output: (output || fallback).slice(0, MAX_HOOK_OUTPUT_BYTES),
          exitCode,
          blocking: exitCode === 2 || Boolean(fallback),
        });
      };
      const collect = (chunk: Buffer) => {
        if (settled) return;
        outputBytes += chunk.byteLength;
        if (outputBytes > MAX_HOOK_OUTPUT_BYTES) {
          terminateHook(child);
          finish(null, "Plugin hook output exceeded 1 MiB.");
          return;
        }
        output += chunk.toString("utf8");
      };
      child.stdout?.on("data", collect);
      child.stderr?.on("data", collect);
      child.once("error", (error) => finish(null, error.message));
      child.once("close", (code) => finish(code));
      child.stdin?.on("error", () => undefined);
      child.stdin?.end(input);
      timer = setTimeout(() => {
        terminateHook(child);
        finish(null, `Plugin hook timed out after ${timeoutMs} ms.`);
      }, timeoutMs);
      timer.unref?.();
    });
  }

  async runHooks(
    event: string,
    context: JsonObject,
  ): Promise<LocalPluginHookResult[]> {
    const plugins = await this.getPlugins();
    const results: LocalPluginHookResult[] = [];
    for (const plugin of plugins) {
      if (plugin.enabled !== true || results.length >= 100) continue;
      const pluginName = text(plugin.name);
      const root = text(plugin.installPath);
      if (!pluginName || !root) continue;
      const cwd = text(context.cwd) ?? root;
      for (const document of Array.isArray(plugin.hooks) ? plugin.hooks : []) {
        if (!isObject(document) || document.event !== event) continue;
        for (const group of Array.isArray(document.definitions)
          ? document.definitions
          : []) {
          if (!isObject(group) || !hookGroupMatches(group, context)) continue;
          for (const hook of Array.isArray(group.hooks) ? group.hooks : []) {
            if (results.length >= 100 || !isObject(hook)) break;
            const command = hook.type === "command" ? text(hook.command) : null;
            if (!command) continue;
            results.push(
              await this.#runHookCommand(
                pluginName,
                event,
                command,
                root,
                cwd,
                hook.timeout,
                context,
              ),
            );
          }
        }
      }
    }
    return results;
  }

  // Enabled plugins' skills for the local Chat runtime. Code consumes the
  // richer customization source above so commands and agents transfer too.
  async enabledSkills(): Promise<
    Array<{ name: string; description: string; content: string }>
  > {
    return (await this.enabledCustomizations())
      .filter((entry) => entry.kind === "skill")
      .map((entry) => ({
        name: entry.name,
        description: entry.description,
        content: entry.content,
      }));
  }

  async uploadPlugin(
    filename: unknown,
    base64Content: unknown,
    replaceExisting?: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    if (typeof base64Content !== "string" || !base64Content)
      return { success: false, error: "The plugin upload was empty." };
    const bytes = decodeStrictBase64(base64Content);
    if (!bytes) {
      return {
        success: false,
        error: "The plugin upload was not valid base64.",
      };
    }
    if (bytes.byteLength > MAX_PLUGIN_ZIP_BYTES)
      return {
        success: false,
        error: "Plugin archives are limited to 100 MB.",
      };
    let entries: Map<string, Uint8Array>;
    try {
      entries = zipEntries(new Uint8Array(bytes), {
        maxEntries: MAX_PLUGIN_FILES,
        maxEntryBytes: MAX_PLUGIN_ENTRY_BYTES,
        maxTotalBytes: MAX_PLUGIN_EXPANDED_BYTES,
      });
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The plugin archive exceeded local extraction limits.",
      };
    }
    if (entries.size === 0)
      return {
        success: false,
        error: `${text(filename) ?? "The file"} is not a readable zip archive.`,
      };
    if (entries.size > MAX_PLUGIN_FILES)
      return {
        success: false,
        error: "The plugin archive has too many files.",
      };
    // The manifest may sit under a wrapping top-level folder.
    const normalizedEntries = [...entries].flatMap(([entry, data]) => {
      const normalized = safeArchivePath(entry);
      return normalized ? ([[normalized, data]] as const) : [];
    });
    const seenNormalizedEntries = new Set<string>();
    for (const [entry] of normalizedEntries) {
      const comparableEntry =
        process.platform === "win32" ? entry.toLowerCase() : entry;
      if (seenNormalizedEntries.has(comparableEntry))
        return {
          success: false,
          error: `The plugin archive contains a duplicate path: ${entry}`,
        };
      seenNormalizedEntries.add(comparableEntry);
    }
    const manifestEntry = normalizedEntries.find(([entry]) =>
      entry.endsWith(".claude-plugin/plugin.json"),
    );
    if (!manifestEntry)
      return {
        success: false,
        error:
          "No .claude-plugin/plugin.json manifest was found in the archive.",
      };
    const prefix = manifestEntry[0].slice(
      0,
      manifestEntry[0].length - ".claude-plugin/plugin.json".length,
    );
    let manifest: JsonObject = {};
    try {
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(manifestEntry[1]),
      );
      if (isObject(parsed)) manifest = parsed;
    } catch {
      return { success: false, error: "plugin.json is not valid JSON." };
    }
    const name = safePluginName(text(manifest.name) ?? "");
    if (!name)
      return {
        success: false,
        error: 'plugin.json must declare a valid "name".',
      };
    return this.#mutate(async () => {
      const install = await this.#installDirectory(
        name,
        replaceExisting === true,
        async (staging) => {
          for (const [entryName, data] of normalizedEntries) {
            if (!entryName.startsWith(prefix)) continue;
            const relative = safeArchivePath(entryName.slice(prefix.length));
            if (!relative) continue;
            const target = path.join(staging, ...relative.split("/"));
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, data);
          }
        },
      );
      if (!install.installed)
        return {
          success: false,
          error: `A plugin named “${name}” is already installed.`,
          alreadyExists: true,
        };
      const previousState = this.#state[name];
      this.#state[name] = {
        enabled: true,
        installedAt: new Date().toISOString(),
      };
      try {
        await this.#persist();
      } catch (error) {
        if (previousState) this.#state[name] = previousState;
        else delete this.#state[name];
        await install.rollback();
        throw error;
      }
      await install.commit();
      return {
        success: true,
        pluginId: this.#idFor(name),
        pluginName: name,
        pluginDisplayName:
          boundedText(manifest.displayName, MAX_ENTRY_NAME_CHARS) ??
          boundedText(manifest.display_name, MAX_ENTRY_NAME_CHARS),
        isNew: !install.replaced,
      };
    });
  }

  async setPluginEnabled(
    pluginId: unknown,
    enabled: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    if (!name) return { success: false, error: "Unknown plugin." };
    return this.#mutate(async () => {
      const exists = await stat(this.#pluginDir(name)).then(
        (value) => value.isDirectory(),
        () => false,
      );
      if (!exists) return { success: false, error: "Unknown plugin." };
      const previous = this.#state[name];
      this.#state[name] = {
        enabled: enabled === true,
        installedAt: this.#state[name]?.installedAt ?? new Date().toISOString(),
      };
      try {
        await this.#persist();
      } catch (error) {
        if (previous) this.#state[name] = previous;
        else delete this.#state[name];
        throw error;
      }
      return { success: true };
    });
  }

  async installCatalogPlugin(catalogId: unknown): Promise<JsonObject> {
    await this.#load();
    const id = text(catalogId);
    const template = id ? LOCAL_PLUGIN_CATALOG.get(id) : undefined;
    const name = id ? safePluginName(id) : undefined;
    if (!template || !name)
      return { success: false, error: "Unknown local catalog plugin." };
    const archiveUrl = catalogArchiveUrl(template);
    if (!archiveUrl)
      return {
        success: false,
        error:
          "This catalog entry does not have a supported pinned GitHub source.",
      };
    return this.#mutate(async () => {
      try {
        const install = await this.#installDirectory(
          name,
          false,
          async (root) => {
            const response = await fetch(archiveUrl, {
              headers: {
                Accept: "application/zip",
                "User-Agent": "Open-Claude-Plugin-Installer",
              },
              redirect: "error",
            });
            if (!response.ok)
              throw new Error(
                `The public plugin source returned HTTP ${response.status}.`,
              );
            const bytes = await readResponseBytes(
              response,
              MAX_PLUGIN_ZIP_BYTES,
              "Plugin source archive",
            );
            const entries = zipEntries(bytes, {
              maxEntries: MAX_PLUGIN_FILES,
              maxEntryBytes: MAX_PLUGIN_ENTRY_BYTES,
              maxTotalBytes: MAX_PLUGIN_EXPANDED_BYTES,
            });
            const normalized = [...entries].flatMap(([entry, data]) => {
              const safe = safeArchivePath(entry);
              return safe ? ([[safe, data]] as const) : [];
            });
            const topLevels = new Set(
              normalized.map(([entry]) => entry.split("/")[0]),
            );
            if (topLevels.size !== 1)
              throw new Error(
                "The public plugin archive did not contain one repository root.",
              );
            const archiveRoot = [...topLevels][0];
            const sourcePath = catalogRelativePath(template.source.path);
            if (template.source.path && !sourcePath)
              throw new Error("The catalog plugin source path is invalid.");
            const sourcePrefix = `${archiveRoot}/${sourcePath ? `${sourcePath}/` : ""}`;
            const selected = normalized.flatMap(([entry, data]) =>
              entry.startsWith(sourcePrefix)
                ? ([[entry.slice(sourcePrefix.length), data]] as const)
                : [],
            );
            if (selected.length === 0)
              throw new Error(
                "The pinned plugin source path was not present in its archive.",
              );

            const hasManifest = selected.some(
              ([entry]) => entry === ".claude-plugin/plugin.json",
            );
            const targets = new Map<string, Uint8Array>();
            if (hasManifest) {
              for (const [relative, data] of selected) {
                const safe = safeArchivePath(relative);
                if (safe) targets.set(safe, data);
              }
            } else {
              const declaredSkills = (template.source.skills ?? [])
                .map((skill) => catalogRelativePath(skill))
                .filter((skill): skill is string => Boolean(skill));
              const skillRoots =
                declaredSkills.length > 0
                  ? declaredSkills
                  : selected.some(([entry]) => entry === "SKILL.md")
                    ? [""]
                    : [
                        ...new Set(
                          selected.flatMap(([entry]) => {
                            const match = entry.match(/^([^/]+)\/SKILL\.md$/u);
                            return match ? [match[1]] : [];
                          }),
                        ),
                      ];
              for (const skillRoot of skillRoots) {
                const skillName = safePluginName(
                  skillRoot ? path.posix.basename(skillRoot) : name,
                );
                if (!skillName) continue;
                const prefix = skillRoot ? `${skillRoot}/` : "";
                for (const [relative, data] of selected) {
                  if (skillRoot && !relative.startsWith(prefix)) continue;
                  const within = skillRoot
                    ? relative.slice(prefix.length)
                    : relative;
                  const safe = safeArchivePath(`skills/${skillName}/${within}`);
                  if (safe) targets.set(safe, data);
                }
              }
              if (
                ![...targets.keys()].some((entry) =>
                  /^skills\/[^/]+\/SKILL\.md$/u.test(entry),
                )
              )
                throw new Error(
                  "The catalog source contained neither a plugin manifest nor a skill manifest.",
                );
              targets.set(
                ".claude-plugin/plugin.json",
                new TextEncoder().encode(
                  `${JSON.stringify(
                    {
                      name,
                      displayName: template.displayName,
                      description: template.description,
                      author: template.author
                        ? { name: template.author }
                        : undefined,
                      homepage: template.homepage,
                      source: {
                        marketplace: template.marketplace,
                        repository: template.source.repository,
                        commit: template.source.commit,
                      },
                    },
                    null,
                    2,
                  )}\n`,
                ),
              );
            }
            const seenTargets = new Set<string>();
            for (const [relative, data] of targets) {
              const comparable =
                process.platform === "win32"
                  ? relative.toLowerCase()
                  : relative;
              if (seenTargets.has(comparable))
                throw new Error(
                  `The plugin source contains a duplicate path: ${relative}`,
                );
              seenTargets.add(comparable);
              const target = path.join(root, ...relative.split("/"));
              await mkdir(path.dirname(target), { recursive: true });
              await writeFile(target, data, {
                mode: /(?:^|\/)(?:scripts?|bin)\//u.test(relative)
                  ? 0o700
                  : 0o600,
              });
            }
          },
        );
        if (install.installed) {
          const previousState = this.#state[name];
          this.#state[name] = {
            enabled: true,
            installedAt: new Date().toISOString(),
          };
          try {
            await this.#persist();
          } catch (error) {
            if (previousState) this.#state[name] = previousState;
            else delete this.#state[name];
            await install.rollback();
            throw error;
          }
          await install.commit();
        }
        return {
          success: true,
          pluginId: this.#idFor(name),
          pluginName: name,
          pluginDisplayName: template.displayName,
          isNew: install.installed,
        };
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "The public plugin source could not be installed.",
        };
      }
    });
  }

  async deletePlugin(pluginId: unknown): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    if (!name) return { success: false, error: "Unknown plugin." };
    return this.#mutate(async () => {
      const directory = this.#pluginDir(name);
      const backup = path.join(this.#root, `.delete-${name}-${randomUUID()}`);
      const exists = await stat(directory).then(
        (info) => info.isDirectory(),
        () => false,
      );
      if (exists) await rename(directory, backup);
      const previous = this.#state[name];
      delete this.#state[name];
      try {
        await this.#persist();
      } catch (error) {
        if (previous) this.#state[name] = previous;
        if (exists) await rename(backup, directory).catch(() => undefined);
        throw error;
      }
      if (exists)
        await rm(backup, { recursive: true, force: true }).catch(
          () => undefined,
        );
      return { success: true };
    });
  }

  async listSkillFiles(
    pluginId: unknown,
    skillName: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    const skill = text(skillName);
    if (!name || !skill || !safePluginName(skill))
      return { success: false, error: "Unknown skill." };
    const skillRoot = path.join(this.#pluginDir(name), "skills", skill);
    const files: Array<{ path: string; content: string }> = [];
    let totalBytes = 0;
    const visit = async (directory: string, prefix: string, depth: number) => {
      if (depth > MAX_SKILL_DEPTH || files.length >= MAX_SKILL_FILES) return;
      let entries: string[] = [];
      try {
        entries = await readdir(directory);
      } catch {
        return;
      }
      for (const entry of entries.slice(0, 200)) {
        if (files.length >= MAX_SKILL_FILES) break;
        const absolute = path.join(directory, entry);
        const relative = prefix ? `${prefix}/${entry}` : entry;
        try {
          const info = await lstat(absolute);
          if (info.isSymbolicLink()) continue;
          if (info.isDirectory()) await visit(absolute, relative, depth + 1);
          else if (
            info.isFile() &&
            info.size <= MAX_SKILL_FILE_BYTES &&
            totalBytes + info.size <= MAX_SKILL_TOTAL_BYTES
          ) {
            const loaded = await readSafeText(absolute);
            if (totalBytes + loaded.bytes > MAX_SKILL_TOTAL_BYTES) continue;
            const content = loaded.content;
            totalBytes += loaded.bytes;
            files.push({ path: relative, content });
          }
        } catch {
          // A single unreadable entry must not break the rest of the skill.
        }
      }
    };
    const rootInfo = await lstat(skillRoot).catch(() => null);
    if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink())
      return { success: false, error: "Skill files were not found." };
    await visit(skillRoot, "", 0);
    if (files.length === 0)
      return { success: false, error: "Skill files were not found." };
    return { success: true, files };
  }

  invoke(method: string, args: unknown[]): unknown {
    switch (method) {
      case "getPlugins":
        return this.getPlugins();
      case "uploadPlugin":
        return this.uploadPlugin(args[0], args[1], args[2]);
      case "setPluginEnabled":
        return this.setPluginEnabled(args[0], args[1]);
      case "installCatalogPlugin":
        return this.installCatalogPlugin(args[0]);
      case "deletePlugin":
        return this.deletePlugin(args[0]);
      case "listSkillFiles":
        return this.listSkillFiles(args[0], args[1]);
      case "listMarketplaces":
        return this.listCatalogMarketplaces();
      case "listAvailablePlugins":
        return this.listCatalogPlugins();
      case "listInstalledPlugins":
        return this.listCatalogPlugins().then((plugins) =>
          plugins.filter((plugin) => plugin.isInstalled === true),
        );
      case "listLocalOrgPlugins":
        return this.listLocalOrgPlugins();
      case "listRemotePluginsPage":
        return { plugins: [], hasMore: false };
      case "installPlugin":
      case "installLocalOrgPlugin":
        return this.installNativePlugin(args[0]);
      case "uninstallPlugin":
        return this.uninstallNativePlugin(args[0]);
      case "updatePlugin":
        return this.installNativePlugin(args[0]);
      case "checkPluginHasLocalChanges":
        return { hasLocalChanges: false, changedFiles: [] };
      case "getAndClearMigrationIssues":
      case "getInstallCounts":
        return null;
      case "getCachedCommands":
        return [];
      case "syncLocalOrgPlugins":
        return { newlyInstalled: [], configuredMarketplaceStatus: [] };
      case "refreshMarketplace":
        return { success: true };
      case "getDownloadedRemotePlugins":
      case "getPluginCliBatch":
      case "getPluginShimOps":
        return [];
      case "getPluginCliStatus":
      case "getPluginOAuthStatus":
        return null;
      case "syncRemotePlugins":
        return { success: true };
      case "setPluginShimPermission":
        return [];
      default:
        return undefined;
    }
  }
}
