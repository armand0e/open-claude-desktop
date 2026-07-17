import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalPluginManager } from "../src/main/local-plugins";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

// Store-method zip builder (same layout the production reader parses).
function buildZip(files: Array<[string, string]>): Buffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const uint16 = (value: number) => new Uint8Array([value & 255, value >> 8]);
  const uint32 = (value: number) =>
    new Uint8Array([
      value & 255,
      (value >> 8) & 255,
      (value >> 16) & 255,
      (value >>> 24) & 255,
    ]);
  for (const [name, content] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const localOffset = offset;
    const parts = [
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
      data,
    ];
    for (const part of parts) {
      chunks.push(part);
      offset += part.length;
    }
    central.push(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(localOffset),
      nameBytes,
    );
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const part of central) {
    chunks.push(part);
    centralSize += part.length;
  }
  chunks.push(
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(files.length),
    uint16(files.length),
    uint32(centralSize),
    uint32(centralStart),
    uint16(0),
  );
  return Buffer.concat(chunks);
}

const PLUGIN_ZIP = buildZip([
  [
    "my-plugin/.claude-plugin/plugin.json",
    JSON.stringify({
      name: "demo-tools",
      description: "Demo plugin",
      version: "1.2.0",
      author: { name: "Tester" },
    }),
  ],
  [
    "my-plugin/skills/greeting/SKILL.md",
    "---\nname: greeting\ndescription: Greets warmly\n---\n\nSay hello nicely.",
  ],
  ["my-plugin/skills/greeting/notes.md", "Extra notes."],
  [
    "my-plugin/commands/review.md",
    "---\ndescription: Reviews the diff\n---\n\nReview instructions.",
  ],
  ["my-plugin/README.md", "# Demo tools"],
]);

describe("LocalPluginManager", () => {
  it("installs, lists, toggles, reads skill files, and deletes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-plugins-"));
    temporaryDirectories.push(directory);
    const manager = new LocalPluginManager(directory);

    const uploaded = (await manager.uploadPlugin(
      "demo.zip",
      PLUGIN_ZIP.toString("base64"),
    )) as Record<string, unknown>;
    expect(uploaded.success).toBe(true);
    expect(uploaded.pluginId).toBe("demo-tools@local");
    expect(uploaded.isNew).toBe(true);

    // Re-upload without replace flag is refused; with it, succeeds.
    const duplicate = (await manager.uploadPlugin(
      "demo.zip",
      PLUGIN_ZIP.toString("base64"),
    )) as Record<string, unknown>;
    expect(duplicate.success).toBe(false);
    expect(duplicate.alreadyExists).toBe(true);
    const replaced = (await manager.uploadPlugin(
      "demo.zip",
      PLUGIN_ZIP.toString("base64"),
      true,
    )) as Record<string, unknown>;
    expect(replaced.success).toBe(true);
    expect(replaced.isNew).toBe(false);

    const plugins = await manager.getPlugins();
    expect(plugins).toHaveLength(1);
    const record = plugins[0] as Record<string, unknown>;
    expect(record.id).toBe("demo-tools@local");
    expect(record.enabled).toBe(true);
    expect(record.version).toBe("1.2.0");
    const skills = record.skills as Array<Record<string, unknown>>;
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("greeting");
    expect(skills[0].description).toBe("Greets warmly");
    const commands = record.commands as Array<Record<string, unknown>>;
    expect(commands[0].name).toBe("review");

    const enabledSkills = await manager.enabledSkills();
    expect(enabledSkills[0].name).toBe("greeting (demo-tools)");
    expect(enabledSkills[0].content).toContain("Say hello nicely.");

    await manager.setPluginEnabled("demo-tools@local", false);
    expect(await manager.enabledSkills()).toHaveLength(0);
    const disabled = (await manager.getPlugins())[0] as Record<string, unknown>;
    expect(disabled.enabled).toBe(false);

    const files = (await manager.listSkillFiles(
      "demo-tools@local",
      "greeting",
    )) as { success: boolean; files: Array<{ path: string }> };
    expect(files.success).toBe(true);
    expect(files.files.map((file) => file.path).sort()).toEqual([
      "SKILL.md",
      "notes.md",
    ]);

    // State survives a fresh manager (restart).
    const reopened = new LocalPluginManager(directory);
    const persisted = (await reopened.getPlugins())[0] as Record<
      string,
      unknown
    >;
    expect(persisted.enabled).toBe(false);

    expect(
      ((await manager.deletePlugin("demo-tools@local")) as { success: boolean })
        .success,
    ).toBe(true);
    expect(await manager.getPlugins()).toHaveLength(0);

    // Garbage uploads fail cleanly.
    const garbage = (await manager.uploadPlugin(
      "bad.zip",
      Buffer.from("not a zip").toString("base64"),
    )) as Record<string, unknown>;
    expect(garbage.success).toBe(false);
  });
});
