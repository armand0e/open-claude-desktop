import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalPluginManager } from "../src/main/local-plugins";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
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
      clis: { demo: { command: "demo-cli" } },
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
  [
    "my-plugin/agents/reviewer.md",
    "---\ndescription: Reviews carefully\n---\n\nAgent instructions.",
  ],
  [
    "my-plugin/.mcp.json",
    JSON.stringify({
      mcpServers: {
        demo: {
          command: "node",
          args: ["${CLAUDE_PLUGIN_ROOT}/server.js"],
        },
      },
    }),
  ],
  [
    "my-plugin/hooks/hooks.json",
    JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Write",
            hooks: [
              {
                type: "command",
                command: `"${process.execPath}" "\${CLAUDE_PLUGIN_ROOT}/hook.cjs"`,
              },
            ],
          },
        ],
      },
    }),
  ],
  [
    "my-plugin/hook.cjs",
    'process.stdin.resume(); process.stdin.on("end", () => process.stdout.write("hook-proof"));',
  ],
  ["my-plugin/README.md", "# Demo tools"],
]);

const CATALOG_PLUGIN_ZIP = buildZip([
  [
    "agent-sdk-dev-source/plugins/agent-sdk-dev/.claude-plugin/plugin.json",
    JSON.stringify({
      name: "agent-sdk-dev",
      displayName: "Agent SDK Dev",
      description: "Development kit for working with the Claude Agent SDK",
      version: "1.0.0",
    }),
  ],
  [
    "agent-sdk-dev-source/plugins/agent-sdk-dev/skills/agent-sdk-development/SKILL.md",
    "---\nname: agent-sdk-development\ndescription: Build agent applications with explicit tools and state\n---\n\n# Agent SDK development\n\nUse the real plugin instructions.",
  ],
]);

describe("LocalPluginManager", () => {
  it("does not claim that embedded marketplace data was refreshed or synced", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-plugins-"));
    temporaryDirectories.push(directory);
    const manager = new LocalPluginManager(directory);

    expect(manager.invoke("refreshMarketplace", [])).toEqual(
      expect.objectContaining({
        success: false,
        source: "embedded_snapshot",
        error: expect.stringMatching(/unavailable/i),
      }),
    );
    expect(manager.invoke("syncRemotePlugins", [])).toEqual(
      expect.objectContaining({
        success: false,
        source: "embedded_snapshot",
        error: expect.stringMatching(/unavailable/i),
      }),
    );
  });

  it("rejects archive traversal and preserves an installed plugin on a failed replacement", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-plugins-"));
    temporaryDirectories.push(directory);
    const manager = new LocalPluginManager(directory);
    expect(
      (await manager.uploadPlugin(
        "demo.zip",
        PLUGIN_ZIP.toString("base64"),
      )) as Record<string, unknown>,
    ).toEqual(expect.objectContaining({ success: true }));

    const traversal = buildZip([
      [
        "wrapper/.claude-plugin/plugin.json",
        JSON.stringify({ name: "traversal", version: "1.0.0" }),
      ],
      ["wrapper/..\\escaped.txt", "must not escape"],
      [
        "wrapper/skills/safe/SKILL.md",
        "---\nname: safe\ndescription: Safe\n---\n",
      ],
    ]);
    expect(
      (await manager.uploadPlugin(
        "traversal.zip",
        traversal.toString("base64"),
      )) as Record<string, unknown>,
    ).toEqual(expect.objectContaining({ success: true }));
    await expect(access(path.join(directory, "escaped.txt"))).rejects.toThrow();

    // This archive stages a regular file where a later member needs a
    // directory. Replacement must fail before the known-good install moves.
    const brokenReplacement = buildZip([
      [
        "wrapper/.claude-plugin/plugin.json",
        JSON.stringify({ name: "demo-tools", version: "9.9.9" }),
      ],
      ["wrapper/conflict", "file"],
      ["wrapper/conflict/nested.txt", "cannot be written"],
    ]);
    await expect(
      manager.uploadPlugin(
        "broken.zip",
        brokenReplacement.toString("base64"),
        true,
      ),
    ).rejects.toThrow();
    expect(
      await readFile(
        path.join(
          directory,
          "plugins",
          "demo-tools",
          "skills",
          "greeting",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).toContain("Greets warmly");

    expect(await manager.setPluginEnabled("missing@local", true)).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(await manager.setPluginEnabled("demo-tools@other", true)).toEqual(
      expect.objectContaining({ success: false }),
    );

    const normalizedCollision = buildZip([
      [
        "wrapper/.claude-plugin/plugin.json",
        JSON.stringify({ name: "collision", version: "1.0.0" }),
      ],
      [
        "wrapper\\.claude-plugin\\plugin.json",
        JSON.stringify({ name: "overwriter", version: "1.0.0" }),
      ],
    ]);
    expect(
      (await manager.uploadPlugin(
        "collision.zip",
        normalizedCollision.toString("base64"),
      )) as Record<string, unknown>,
    ).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/duplicate path/i),
      }),
    );

    expect(
      (await manager.uploadPlugin("invalid.zip", "!!!!")) as Record<
        string,
        unknown
      >,
    ).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/valid base64/i),
      }),
    );
  });

  it("materializes directory catalog entries as usable local plugins", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-plugin-catalog-"),
    );
    temporaryDirectories.push(directory);
    const manager = new LocalPluginManager(directory);
    const available = (await manager.invoke("listAvailablePlugins", [
      [],
      undefined,
    ])) as Array<Record<string, unknown>>;
    expect(available.length).toBeGreaterThan(100);
    expect(available).toContainEqual(
      expect.objectContaining({
        id: "agent-sdk-dev@claude-plugins-official",
        name: "agent-sdk-dev",
        displayName: "Agent SDK Dev",
        marketplaceName: "claude-plugins-official",
        isInstalled: false,
      }),
    );
    const marketplaces = (await manager.invoke(
      "listMarketplaces",
      [],
    )) as Array<Record<string, unknown>>;
    expect(marketplaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "claude-plugins-official",
          isDefault: true,
          source: "local",
        }),
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(CATALOG_PLUGIN_ZIP), {
            status: 200,
            headers: { "Content-Type": "application/zip" },
          }),
      ),
    );

    const installed = (await manager.invoke("installPlugin", [
      "agent-sdk-dev@claude-plugins-official",
      [],
      undefined,
    ])) as Record<string, unknown>;
    expect(installed).toEqual(
      expect.objectContaining({
        success: true,
        pluginId: "agent-sdk-dev@claude-plugins-official",
        pluginDisplayName: "Agent SDK Dev",
        isNew: true,
      }),
    );
    expect(
      (await manager.installCatalogPlugin("agent-sdk-dev")) as Record<
        string,
        unknown
      >,
    ).toEqual(expect.objectContaining({ success: true, isNew: false }));

    const plugin = (await manager.getPlugins())[0] as Record<string, unknown>;
    expect(plugin).toEqual(
      expect.objectContaining({
        id: "agent-sdk-dev@local",
        enabled: true,
        display_name: "Agent SDK Dev",
      }),
    );
    expect(plugin.skills).toEqual([
      expect.objectContaining({
        name: "agent-sdk-development",
        description: expect.stringContaining("explicit tools"),
      }),
    ]);
    const enabled = await manager.enabledSkills();
    expect(enabled[0].name).toBe("agent-sdk-dev:agent-sdk-development");
    expect(enabled[0].content).toContain("real plugin instructions");
    expect(
      (await manager.invoke("listInstalledPlugins", [])) as Array<
        Record<string, unknown>
      >,
    ).toContainEqual(
      expect.objectContaining({
        id: "agent-sdk-dev@local",
        name: "agent-sdk-dev",
        enabled: true,
        skills: expect.any(Array),
      }),
    );

    expect(await manager.installCatalogPlugin("not-in-the-catalog")).toEqual(
      expect.objectContaining({ success: false }),
    );
  });

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
    expect(record.agents).toEqual([
      expect.objectContaining({ name: "reviewer" }),
    ]);
    expect(record.hooks).toEqual([
      expect.objectContaining({ event: "PreToolUse" }),
    ]);
    expect(record.mcpServers).toEqual([
      expect.objectContaining({ name: "demo" }),
    ]);
    expect(record.clis).toEqual([
      expect.objectContaining({ name: "demo", command: "demo-cli" }),
    ]);

    const enabledSkills = await manager.enabledSkills();
    expect(enabledSkills[0].name).toBe("demo-tools:greeting");
    expect(enabledSkills[0].content).toContain("Say hello nicely.");
    expect(await manager.enabledCustomizations()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skill", name: "demo-tools:greeting" }),
        expect.objectContaining({ kind: "command", name: "demo-tools:review" }),
        expect.objectContaining({ kind: "agent", name: "demo-tools:reviewer" }),
      ]),
    );
    expect(await manager.readEnabledSkill("demo-tools:greeting")).toEqual(
      expect.objectContaining({
        name: "demo-tools:greeting",
        content: expect.stringContaining("Say hello nicely."),
        files: expect.arrayContaining([
          expect.objectContaining({ path: "notes.md" }),
        ]),
      }),
    );
    const mcpServers = await manager.enabledMcpServers();
    expect(mcpServers["demo-tools:demo"]).toEqual(
      expect.objectContaining({
        command: "node",
        args: [`${path.join(directory, "plugins", "demo-tools")}/server.js`],
      }),
    );
    expect(
      await manager.runHooks("PreToolUse", {
        cwd: directory,
        toolName: "Write",
        toolInput: { file_path: "proof.txt" },
      }),
    ).toEqual([
      expect.objectContaining({
        plugin: "demo-tools",
        event: "PreToolUse",
        output: "hook-proof",
        exitCode: 0,
        blocking: false,
      }),
    ]);

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
