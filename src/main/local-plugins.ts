// Local plugin manager backing the native LocalPlugins service: install
// Claude Code plugin zips (.claude-plugin/plugin.json manifests with
// skills/, commands/, agents/, hooks/), list them in the shape the retained
// client normalizes, and toggle/delete them. Marketplace sync, CLI shims,
// and OAuth are cloud features and answer as empty/unavailable.

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { zipEntries } from "./local-extract";

type JsonObject = Record<string, unknown>;

const MAX_PLUGIN_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_PLUGIN_FILES = 2_000;
const LOCAL_MARKETPLACE = "local";

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

export class LocalPluginManager {
  readonly #root: string;
  readonly #stateFile: string;
  #state: Record<string, PluginState> = {};
  #loaded = false;
  #writeChain = Promise.resolve();

  constructor(userDataPath: string) {
    this.#root = path.join(userDataPath, "plugins");
    this.#stateFile = path.join(this.#root, "plugins.json");
  }

  async #load(): Promise<void> {
    if (this.#loaded) return;
    this.#loaded = true;
    try {
      const parsed: unknown = JSON.parse(
        await readFile(this.#stateFile, "utf8"),
      );
      if (isObject(parsed))
        for (const [key, value] of Object.entries(parsed))
          if (isObject(value))
            this.#state[key] = {
              enabled: value.enabled !== false,
              installedAt: text(value.installedAt) ?? new Date(0).toISOString(),
            };
    } catch {
      // First run.
    }
  }

  async #persist(): Promise<void> {
    const serialized = `${JSON.stringify(this.#state, null, 2)}\n`;
    const pending = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        await mkdir(this.#root, { recursive: true });
        const temporary = `${this.#stateFile}.${randomUUID()}.tmp`;
        await writeFile(temporary, serialized, "utf8");
        await rename(temporary, this.#stateFile);
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
    const name = pluginId.split("@")[0];
    return safePluginName(name);
  }

  async #collectEntries(
    directory: string,
    kind: "skills" | "commands" | "agents",
  ): Promise<JsonObject[]> {
    const results: JsonObject[] = [];
    const kindRoot = path.join(directory, kind);
    let names: string[] = [];
    try {
      names = await readdir(kindRoot);
    } catch {
      return results;
    }
    for (const name of names.slice(0, 200)) {
      try {
        const entryPath = path.join(kindRoot, name);
        const info = await stat(entryPath);
        if (kind === "skills" && info.isDirectory()) {
          const manifest = await readFile(
            path.join(entryPath, "SKILL.md"),
            "utf8",
          );
          results.push({
            name: frontmatterField(manifest, "name") ?? name,
            description: frontmatterField(manifest, "description") ?? "",
            argumentHint: frontmatterField(manifest, "argument-hint"),
            location: `${kind}/${name}`,
            hostFilesystemLocation: entryPath,
            content: manifest.slice(0, 64_000),
            source: "plugin",
            userInvocable: true,
          });
        } else if (kind !== "skills" && info.isFile() && name.endsWith(".md")) {
          const content = await readFile(entryPath, "utf8");
          const base = name.replace(/\.md$/, "");
          results.push({
            name: frontmatterField(content, "name") ?? base,
            description: frontmatterField(content, "description") ?? "",
            argumentHint: frontmatterField(content, "argument-hint"),
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

  async #record(name: string): Promise<JsonObject | null> {
    const directory = this.#pluginDir(name);
    let manifest: JsonObject = {};
    try {
      const parsed: unknown = JSON.parse(
        await readFile(
          path.join(directory, ".claude-plugin", "plugin.json"),
          "utf8",
        ),
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
      hasReadme = (await stat(readmePath)).isFile();
    } catch {
      // Optional.
    }
    return {
      id: this.#idFor(name),
      name,
      display_name: text(manifest.displayName) ?? text(manifest.display_name),
      marketplaceName: LOCAL_MARKETPLACE,
      source: "local",
      scope: "user",
      enabled: state.enabled,
      installedBy: "user",
      installationPreference: "available",
      installPath: directory,
      ...(hasReadme ? { readmePath } : {}),
      description: text(manifest.description) ?? "",
      version: text(manifest.version),
      author: isObject(manifest.author)
        ? { name: text(manifest.author.name) ?? "" }
        : text(manifest.author)
          ? { name: manifest.author }
          : undefined,
      lastUpdated: state.installedAt,
      skills: await this.#collectEntries(directory, "skills"),
      commands: await this.#collectEntries(directory, "commands"),
      agents: await this.#collectEntries(directory, "agents"),
      hooks: [],
      mcpServers: [],
      clis: [],
    };
  }

  async getPlugins(): Promise<JsonObject[]> {
    await this.#load();
    let names: string[] = [];
    try {
      names = (await readdir(this.#root, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
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

  // Enabled plugins' skills for the local runtimes (chat + code): each entry
  // carries the plugin qualifier so names cannot collide with user skills.
  async enabledSkills(): Promise<
    Array<{ name: string; description: string; content: string }>
  > {
    const plugins = await this.getPlugins();
    return plugins
      .filter((plugin) => plugin.enabled === true)
      .flatMap((plugin) =>
        (plugin.skills as JsonObject[]).map((skill) => ({
          name: `${text(skill.name) ?? "skill"} (${text(plugin.name) ?? "plugin"})`,
          description: text(skill.description) ?? "",
          content: text(skill.content) ?? "",
        })),
      );
  }

  async uploadPlugin(
    filename: unknown,
    base64Content: unknown,
    replaceExisting?: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    if (typeof base64Content !== "string" || !base64Content)
      return { success: false, error: "The plugin upload was empty." };
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64Content, "base64");
    } catch {
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
    const entries = zipEntries(new Uint8Array(bytes));
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
    const manifestEntry = [...entries.keys()].find((entry) =>
      entry.endsWith(".claude-plugin/plugin.json"),
    );
    if (!manifestEntry)
      return {
        success: false,
        error:
          "No .claude-plugin/plugin.json manifest was found in the archive.",
      };
    const prefix = manifestEntry.slice(
      0,
      manifestEntry.length - ".claude-plugin/plugin.json".length,
    );
    let manifest: JsonObject = {};
    try {
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8").decode(entries.get(manifestEntry)!),
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
    const directory = this.#pluginDir(name);
    let exists = false;
    try {
      exists = (await stat(directory)).isDirectory();
    } catch {
      // New install.
    }
    if (exists && replaceExisting !== true)
      return {
        success: false,
        error: `A plugin named “${name}” is already installed.`,
        alreadyExists: true,
      };
    if (exists) await rm(directory, { recursive: true, force: true });
    for (const [entryName, data] of entries) {
      if (!entryName.startsWith(prefix)) continue;
      const relative = entryName.slice(prefix.length);
      const parts = relative.split("/").filter(Boolean);
      if (parts.length === 0 || parts.some((part) => part === "..")) continue;
      const target = path.join(directory, ...parts);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, data);
    }
    this.#state[name] = {
      enabled: true,
      installedAt: new Date().toISOString(),
    };
    await this.#persist();
    return {
      success: true,
      pluginId: this.#idFor(name),
      pluginName: name,
      pluginDisplayName:
        text(manifest.displayName) ?? text(manifest.display_name),
      isNew: !exists,
    };
  }

  async setPluginEnabled(
    pluginId: unknown,
    enabled: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    if (!name) return { success: false, error: "Unknown plugin." };
    this.#state[name] = {
      enabled: enabled === true,
      installedAt: this.#state[name]?.installedAt ?? new Date().toISOString(),
    };
    await this.#persist();
    return { success: true };
  }

  async deletePlugin(pluginId: unknown): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    if (!name) return { success: false, error: "Unknown plugin." };
    await rm(this.#pluginDir(name), { recursive: true, force: true });
    delete this.#state[name];
    await this.#persist();
    return { success: true };
  }

  async listSkillFiles(
    pluginId: unknown,
    skillName: unknown,
  ): Promise<JsonObject> {
    await this.#load();
    const name = this.#nameFromId(text(pluginId) ?? "");
    const skill = text(skillName);
    if (!name || !skill || skill.includes("..") || skill.includes("/"))
      return { success: false, error: "Unknown skill." };
    const skillRoot = path.join(this.#pluginDir(name), "skills", skill);
    const files: Array<{ path: string; content: string }> = [];
    const visit = async (directory: string, prefix: string) => {
      let entries: string[] = [];
      try {
        entries = await readdir(directory);
      } catch {
        return;
      }
      for (const entry of entries.slice(0, 200)) {
        const absolute = path.join(directory, entry);
        const relative = prefix ? `${prefix}/${entry}` : entry;
        const info = await stat(absolute);
        if (info.isDirectory()) await visit(absolute, relative);
        else if (info.isFile() && info.size <= 512 * 1024)
          files.push({
            path: relative,
            content: await readFile(absolute, "utf8").catch(() => ""),
          });
      }
    };
    await visit(skillRoot, "");
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
      case "deletePlugin":
        return this.deletePlugin(args[0]);
      case "listSkillFiles":
        return this.listSkillFiles(args[0], args[1]);
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
