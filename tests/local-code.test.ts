import { createServer } from "node:http";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalCodeSessionManager } from "../src/main/local-code";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function waitForResult(
  manager: LocalCodeSessionManager,
  sessionId: string,
): Promise<Array<Record<string, unknown>>> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const transcript = (await manager.invoke("getTranscript", [
      sessionId,
    ])) as Array<Record<string, unknown>>;
    if (transcript.some((message) => message.type === "result"))
      return transcript;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for local Code result");
}

describe("LocalCodeSessionManager", () => {
  it("requires the normal local-session workspace contract", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-code-"));
    temporaryDirectories.push(directory);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );

    await expect(
      manager.invoke("start", [{ message: "No implicit workspace" }]),
    ).rejects.toThrow("A workspace directory is required");
    await manager.dispose();
  });

  it("returns contract-shaped bootstrap values for local-only Code services", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-bootstrap-"),
    );
    temporaryDirectories.push(directory);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );

    expect(await manager.invoke("getDefaultWorkspaceFolders", [])).toEqual([]);
    expect(await manager.invoke("getDirectMcpServerStatuses", [])).toEqual([]);
    expect(await manager.invoke("getManagedAskToolNames", [])).toEqual({
      names: [],
      patterns: [],
      complete: true,
    });
    expect(await manager.invoke("getSessionsBridgeEnabled", [])).toBe(false);
    expect(await manager.invoke("getBridgeConsent", [])).toBe(false);
  });

  it("honors the native Browser tools setting when advertising model tools", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-browser-setting-"),
    );
    temporaryDirectories.push(directory);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    manager.setBrowserTools({
      executeCodeBrowserTool: vi.fn(async () => "ok"),
      ensureCodeBrowser: vi.fn(),
      startFromConfig: vi.fn(async () => ({ serverId: "preview-proof" })),
    });
    const internal = manager as unknown as {
      agentTools: () => Promise<Array<{ function: { name: string } }>>;
    };

    expect(
      (await internal.agentTools()).some((tool) =>
        tool.function.name.startsWith("mcp__Claude_Browser__"),
      ),
    ).toBe(true);
    expect(
      (await internal.agentTools()).some(
        (tool) => tool.function.name === "preview_start",
      ),
    ).toBe(true);
    manager.setBrowserToolsEnabled(() => false);
    expect(
      (await internal.agentTools()).some((tool) =>
        tool.function.name.startsWith("mcp__Claude_Browser__"),
      ),
    ).toBe(false);
    expect(
      (await internal.agentTools()).some(
        (tool) => tool.function.name === "preview_start",
      ),
    ).toBe(false);
    await manager.dispose();
  });

  it("executes preview_start through the Open-Claude launch configuration", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          requests.length === 1
            ? {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "",
                      tool_calls: [
                        {
                          id: "call_preview_1",
                          type: "function",
                          function: {
                            name: "preview_start",
                            arguments: JSON.stringify({ name: "web" }),
                          },
                        },
                      ],
                    },
                  },
                ],
              }
            : {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "Preview is running.",
                    },
                  },
                ],
              },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing preview provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-preview-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-preview-workspace-"),
      );
      temporaryDirectories.push(directory, workspace);
      const startFromConfig = vi.fn(async () => ({
        serverId: "preview-proof",
        url: "http://127.0.0.1:4173",
      }));
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "preview-code-model",
        }),
        () => undefined,
        () => undefined,
      );
      manager.setBrowserTools({
        executeCodeBrowserTool: vi.fn(async () => "ok"),
        ensureCodeBrowser: vi.fn(),
        startFromConfig,
      });

      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Set up the dev server",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      await waitForResult(manager, started.sessionId);

      expect(requests[0].tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: "preview_start",
              description: expect.stringContaining(".open-claude/launch.json"),
            }),
          }),
        ]),
      );
      expect(startFromConfig).toHaveBeenCalledWith(
        workspace,
        "web",
        started.sessionId,
      );
      expect(requests[1].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "preview_start",
            content: expect.stringContaining("preview-proof"),
          }),
        ]),
      );
      await manager.dispose();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("does not overwrite a session when concurrent starts claim the same id", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-concurrent-start-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-concurrent-workspace-"),
    );
    const additional = await mkdtemp(
      path.join(os.tmpdir(), "local-code-concurrent-additional-"),
    );
    temporaryDirectories.push(directory, workspace, additional);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    const input = {
      sessionId: "shared-session-id",
      cwd: workspace,
      additionalDirectories: [additional],
      message: "Keep exactly one session",
    };

    const results = await Promise.allSettled([
      manager.invoke("start", [input]),
      manager.invoke("start", [input]),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(
      (
        (await manager.invoke("getAll", [])) as Array<{ sessionId: string }>
      ).filter((session) => session.sessionId === input.sessionId),
    ).toHaveLength(1);
    await waitForResult(manager, input.sessionId);
    await manager.dispose();
  });

  it("manages workspace customization files without cloud services", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-custom-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-custom-root-"),
    );
    temporaryDirectories.push(directory, workspace);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );

    await manager.invoke("saveCustomization", [
      {
        cwd: workspace,
        kind: "skill",
        scope: "workspace",
        name: "proof-skill",
        content: "# Proof skill\n\nUse this locally.\n",
      },
    ]);
    await manager.invoke("saveCustomization", [
      {
        cwd: workspace,
        kind: "command",
        scope: "workspace",
        name: "verify",
        content: "# Verify\n\nRun the test suite.\n",
      },
    ]);
    const customization = (await manager.invoke("getCustomization", [
      workspace,
    ])) as { entries: Array<Record<string, unknown>> };
    expect(customization.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skill",
          scope: "workspace",
          name: "proof-skill",
        }),
        expect.objectContaining({
          kind: "command",
          scope: "workspace",
          name: "verify",
        }),
      ]),
    );
    expect(
      await manager.invoke("getSupportedCommands", [{ cwd: workspace }]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "proof-skill",
          scope: "code",
        }),
        expect.objectContaining({ name: "verify", scope: "code" }),
        expect.objectContaining({
          name: "frontend-design",
          scope: "code",
        }),
        expect.objectContaining({ name: "skill-creator", scope: "code" }),
      ]),
    );
    expect(
      await readFile(
        path.join(
          workspace,
          ".open-claude",
          "skills",
          "proof-skill",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).toContain("Use this locally");

    await manager.invoke("deleteCustomization", [
      {
        cwd: workspace,
        kind: "skill",
        scope: "workspace",
        name: "proof-skill",
      },
    ]);
    const afterDelete = (await manager.invoke("getCustomization", [
      workspace,
    ])) as { entries: Array<Record<string, unknown>> };
    expect(afterDelete.entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "skill", name: "proof-skill" }),
      ]),
    );
  });

  it("backs the native local-skills API with the standalone app profile", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-skills-"),
    );
    temporaryDirectories.push(directory);
    const reservedSkill = path.join(
      directory,
      ".claude",
      "skills",
      "reserved-skill",
      "SKILL.md",
    );
    await mkdir(path.dirname(reservedSkill), { recursive: true });
    await writeFile(
      reservedSkill,
      '---\nname: reserved-skill\ndescription: "Must remain private to Anthropic Claude."\n---\n',
      "utf8",
    );
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );

    expect(
      await manager.invoke("saveLocalSkill", [
        "proof-skill",
        "Used to prove native local skills.",
        '---\nname: "proof-skill"\ndescription: "Used to prove native local skills."\n---\n\nRun the proof.\n',
        false,
      ]),
    ).toEqual({ ok: true });
    expect(await manager.invoke("listLocalSkills", [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          skillId: "frontend-design",
          builtIn: true,
          enabled: true,
        }),
        expect.objectContaining({
          skillId: "skill-creator",
          builtIn: true,
          enabled: true,
        }),
        expect.objectContaining({
          skillId: "proof-skill",
          name: "proof-skill",
          description: "Used to prove native local skills.",
          enabled: true,
        }),
      ]),
    );
    expect(await manager.invoke("listLocalSkills", [])).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ skillId: "reserved-skill" }),
      ]),
    );
    // The official bundled copy ships SKILL.md plus support files such as
    // LICENSE.txt, so assert on the manifest rather than an exact file list.
    const frontendFiles = (await manager.invoke("getLocalSkillFiles", [
      "frontend-design",
    ])) as Array<{ path: string; content: string }>;
    expect(frontendFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "SKILL.md",
          content: expect.stringContaining("license: Complete terms in"),
        }),
      ]),
    );
    expect(await manager.invoke("getLocalSkillFiles", ["proof-skill"])).toEqual(
      [
        expect.objectContaining({
          path: "SKILL.md",
          content: expect.stringContaining("Run the proof."),
        }),
      ],
    );
    const creatorFiles = (await manager.invoke("getLocalSkillFiles", [
      "skill-creator",
    ])) as Array<{ path: string; content: string }>;
    expect(creatorFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "SKILL.md",
          content: expect.stringContaining(
            "Never read, write, create, migrate, or delete an Anthropic `.claude` directory",
          ),
        }),
      ]),
    );
    expect(creatorFiles.map((file) => file.path)).not.toEqual(
      expect.arrayContaining([
        "scripts/run_eval.py",
        "scripts/run_loop.py",
        "scripts/improve_description.py",
      ]),
    );
    expect(
      await readFile(
        path.join(
          directory,
          ".open-claude",
          "skills",
          "proof-skill",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).toContain("Run the proof.");

    await manager.invoke("setLocalSkillEnabled", ["proof-skill", false]);
    expect(await manager.invoke("listLocalSkills", [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "proof-skill", enabled: false }),
      ]),
    );
    await manager.invoke("deleteLocalSkill", ["proof-skill"]);
    expect(await manager.invoke("listLocalSkills", [])).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "proof-skill" }),
      ]),
    );
    expect(await readFile(reservedSkill, "utf8")).toContain(
      "Must remain private to Anthropic Claude.",
    );
  });

  it("runs an OpenAI-compatible tool loop, writes a file, emits events, and persists", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      if (requests.length === 1) {
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_write_1",
                      type: "function",
                      function: {
                        name: "Write",
                        arguments: JSON.stringify({
                          file_path: "/home/user/proof.md",
                          content: "local code harness proof",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4 },
          }),
        );
        return;
      }
      if (requests.length === 2) {
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_artifact_1",
                      type: "function",
                      function: {
                        name: "Artifact",
                        arguments: JSON.stringify({
                          file_path: "proof.md",
                          favicon: "🧪",
                          title: "Local Code proof",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 15, completion_tokens: 5 },
          }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Created, published, and verified proof.md.",
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 8 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing mock provider address");
      const directory = await mkdtemp(path.join(os.tmpdir(), "local-code-"));
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-workspace-"),
      );
      temporaryDirectories.push(directory, workspace);
      const events: Array<Record<string, unknown>> = [];
      const permissions: object[] = [];
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "test-code-model",
        }),
        (event) => events.push(event),
        (request) => permissions.push(request),
      );

      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Create proof.txt",
          model: "stale-ui-model",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);

      expect(await readFile(path.join(workspace, "proof.md"), "utf8")).toBe(
        "local code harness proof",
      );
      expect(requests).toHaveLength(3);
      expect(requests.map((request) => request.model)).toEqual([
        "test-code-model",
        "test-code-model",
        "test-code-model",
      ]);
      expect(requests[0].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringMatching(
              /Current local date and time:[\s\S]+Current UTC date and time:[\s\S]+Local timezone:/,
            ),
          }),
        ]),
      );
      expect(requests[0].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              `Current workspace root: ${workspace}`,
            ),
          }),
        ]),
      );
      expect(requests[0].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              "The .claude directory belongs to Anthropic Claude",
            ),
          }),
        ]),
      );
      expect(requests[0].tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({ name: "Read" }),
          }),
          expect.objectContaining({
            function: expect.objectContaining({
              name: "Artifact",
            }),
          }),
          expect.objectContaining({
            function: expect.objectContaining({
              name: "mcp__desktop__present_artifact",
            }),
          }),
        ]),
      );
      expect(transcript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "user" }),
          expect.objectContaining({ type: "assistant" }),
          expect.objectContaining({
            type: "result",
            result: "Created, published, and verified proof.md.",
          }),
        ]),
      );
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "fs_file" }),
          expect.objectContaining({
            type: "initialization_status",
            initializationStatus: expect.objectContaining({
              isComplete: true,
            }),
          }),
        ]),
      );
      expect(events).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "close" })]),
      );
      expect(permissions).toHaveLength(0);

      const stats = (await manager.invoke("getCodeStats", [])) as {
        dailyActivity: Array<Record<string, unknown>>;
        dailyModelTokens: Array<{
          date: string;
          tokensByModel: Record<string, number>;
        }>;
        modelUsage: Record<string, Record<string, number>>;
        streaks: Record<string, number>;
        peakActivityHour: number | null;
      };
      expect(stats.dailyActivity.at(-1)).toEqual(
        expect.objectContaining({
          sessionCount: 1,
          messageCount: 4,
          toolCallCount: 2,
        }),
      );
      expect(stats.dailyModelTokens.at(-1)?.tokensByModel).toEqual({
        "test-code-model": 62,
      });
      expect(stats.modelUsage["test-code-model"]).toEqual({
        inputTokens: 45,
        outputTokens: 17,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
      });
      expect(stats.streaks.currentStreak).toBe(1);
      expect(stats.streaks.longestStreak).toBe(1);
      expect(stats.peakActivityHour).not.toBeNull();

      expect(
        await manager.invoke("getContextUsage", [started.sessionId]),
      ).toEqual(
        expect.objectContaining({
          rawMaxTokens: 128_000,
          totalTokens: 28,
          categories: expect.arrayContaining([
            { name: "Conversation", tokens: 28 },
          ]),
        }),
      );
      const artifacts = (await manager.invoke("getAllArtifacts", [])) as Array<
        Record<string, unknown>
      >;
      expect(artifacts).toEqual([
        expect.objectContaining({
          sessionId: started.sessionId,
          title: "Local Code proof",
        }),
      ]);
      expect(
        await manager.invoke("readArtifact", [
          started.sessionId,
          artifacts[0]?.url,
        ]),
      ).toEqual(
        expect.objectContaining({
          type: "text/markdown",
          content: "local code harness proof",
        }),
      );

      const reopened = await LocalCodeSessionManager.create(
        directory,
        () => null,
        () => undefined,
        () => undefined,
      );
      expect(await reopened.invoke("getSession", [started.sessionId])).toEqual(
        expect.objectContaining({
          sessionId: started.sessionId,
          cwd: workspace,
          isRunning: false,
        }),
      );
      expect(
        (await reopened.invoke("getTranscript", [
          started.sessionId,
        ])) as unknown[],
      ).toHaveLength(transcript.length);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("discovers and calls configured MCP tools from Code turns", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          requests.length === 1
            ? {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "",
                      tool_calls: [
                        {
                          id: "call_connector_1",
                          type: "function",
                          function: {
                            name: "mcp__probe__echo",
                            arguments: JSON.stringify({ text: "proof" }),
                          },
                        },
                      ],
                    },
                  },
                ],
              }
            : {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "Connector returned connector-proof.",
                    },
                  },
                ],
              },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing mock provider address");
      const directory = await mkdtemp(path.join(os.tmpdir(), "code-mcp-"));
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "code-mcp-workspace-"),
      );
      temporaryDirectories.push(directory, workspace);
      const callTool = vi.fn().mockResolvedValue("connector-proof");
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "mcp-code-model",
        }),
        () => undefined,
        () => undefined,
      );
      manager.setMcpSource({
        listTools: async () => [
          {
            server: "probe",
            name: "echo",
            qualifiedName: "mcp__probe__echo",
            description: "Echo a value",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
            },
          },
        ],
        callTool,
      });

      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Use the connector",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      await waitForResult(manager, started.sessionId);

      expect(requests[0].tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({
              name: "mcp__probe__echo",
              description: "[probe] Echo a value",
            }),
          }),
        ]),
      );
      expect(callTool).toHaveBeenCalledWith("mcp__probe__echo", {
        text: "proof",
      });
      expect(requests[1].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "mcp__probe__echo",
            content: "connector-proof",
          }),
        ]),
      );
      await manager.dispose();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("loads enabled plugin skills, commands, and agents in Code mode", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          requests.length === 1
            ? {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "",
                      tool_calls: [
                        {
                          id: "call_plugin_skill",
                          type: "function",
                          function: {
                            name: "Skill",
                            arguments: JSON.stringify({
                              name: "demo-plugin:review",
                            }),
                          },
                        },
                      ],
                    },
                  },
                ],
              }
            : {
                choices: [
                  {
                    message: {
                      role: "assistant",
                      content: "Plugin instructions loaded.",
                    },
                  },
                ],
              },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing plugin provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "code-plugin-profile-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "code-plugin-workspace-"),
      );
      const pluginDirectory = path.join(directory, "plugins", "demo-plugin");
      temporaryDirectories.push(directory, workspace);
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "plugin-code-model",
        }),
        () => undefined,
        () => undefined,
      );
      manager.setPluginSource({
        enabledCustomizations: async () => [
          {
            kind: "skill",
            name: "demo-plugin:review",
            description: "Review a change with the plugin workflow",
            content:
              "---\ndescription: Review carefully\n---\nPlugin skill body.",
            directory: path.join(pluginDirectory, "skills", "review"),
          },
          {
            kind: "command",
            name: "demo-plugin:check",
            description: "Run the plugin check",
            content: "Plugin slash command body.",
            directory: path.join(pluginDirectory, "commands"),
          },
          {
            kind: "agent",
            name: "demo-plugin:reviewer",
            description: "Act as a plugin reviewer",
            content: "Plugin agent body.",
            directory: path.join(pluginDirectory, "agents"),
          },
        ],
        readEnabledSkill: async (name) =>
          name === "demo-plugin:review"
            ? {
                name,
                content: "Plugin skill body from disk.",
                directory: path.join(pluginDirectory, "skills", "review"),
                files: [
                  { path: "SKILL.md", content: "Plugin skill body from disk." },
                  { path: "check.js", content: "console.log('checked')" },
                ],
              }
            : null,
        runHooks: async (event) =>
          event === "UserPromptSubmit"
            ? [
                {
                  plugin: "demo-plugin",
                  event,
                  command: "fixture",
                  output: "Plugin prompt hook context.",
                  exitCode: 0,
                  blocking: false,
                },
              ]
            : [],
      });

      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "/demo-plugin:check review this change",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      await waitForResult(manager, started.sessionId);

      const system = (requests[0].messages as Array<Record<string, unknown>>)
        .filter((message) => message.role === "system")
        .map((message) => String(message.content ?? ""))
        .join("\n");
      expect(system).toContain(
        "demo-plugin:review: Review a change with the plugin workflow",
      );
      expect(system).toContain(
        '<local-command name="demo-plugin:check" scope="plugin">',
      );
      expect(system).toContain(
        '<local-agent name="demo-plugin:reviewer" scope="plugin">',
      );
      expect(system).toContain("Plugin prompt hook context.");
      expect(requests[1].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "tool",
            name: "Skill",
            content: expect.stringMatching(
              /Plugin skill body from disk[\s\S]+check\.js/,
            ),
          }),
        ]),
      );
      await manager.dispose();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("streams reasoning and assistant text while accumulating fragmented tool calls", async () => {
    const requests: Array<Record<string, unknown>> = [];
    let providerTimeoutSpy: { mockRestore: () => void } | undefined;
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const send = (event: unknown) =>
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      if (requests.length === 1) {
        send({
          choices: [{ delta: { content: "<|channel|>ana" } }],
        });
        send({
          choices: [
            {
              delta: {
                content: "lysisI should create the proof file.<|channel|>fi",
              },
            },
          ],
        });
        send({
          choices: [{ delta: { content: "nalI’m creating it now." } }],
        });
        send({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_stream_write",
                    function: {
                      name: "Wr",
                      arguments: '{"file_path":"/home/user/stream-proof.md",',
                    },
                  },
                ],
              },
            },
          ],
        });
        send({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: {
                      name: "ite",
                      arguments: '"content":"streamed tool proof"}',
                    },
                  },
                ],
              },
            },
          ],
        });
        response.end("data: [DONE]\n\n");
        return;
      }
      send({
        choices: [{ delta: { reasoning_content: "The file exists. " } }],
      });
      for (let index = 0; index < 1_000; index += 1)
        send({ choices: [{ delta: { reasoning_content: "x" } }] });
      send({ choices: [{ delta: { content: "Created stream-proof.md " } }] });
      send({ choices: [{ delta: { content: "successfully." } }] });
      response.end(
        `data: ${JSON.stringify({ usage: { prompt_tokens: 21, completion_tokens: 9 }, choices: [] })}\n\ndata: [DONE]\n\n`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing streaming provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-stream-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-stream-root-"),
      );
      temporaryDirectories.push(directory, workspace);
      const events: Array<Record<string, unknown>> = [];
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "streaming-code-model",
          thinkingStartTag: "<|channel|>analysis",
          thinkingEndTag: "<|channel|>final",
        }),
        (event) => events.push(event),
        () => undefined,
      );
      providerTimeoutSpy = vi.spyOn(AbortSignal, "timeout");
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Create the streaming proof",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);

      expect(providerTimeoutSpy).not.toHaveBeenCalled();
      expect(requests).toHaveLength(2);
      expect(requests.every((request) => request.stream === true)).toBe(true);
      expect(
        await readFile(path.join(workspace, "stream-proof.md"), "utf8"),
      ).toBe("streamed tool proof");

      const streamEvents = events.flatMap((outer) => {
        const message = outer.message;
        if (
          outer.type !== "message" ||
          typeof message !== "object" ||
          message === null ||
          !("type" in message) ||
          message.type !== "stream_event" ||
          !("event" in message) ||
          typeof message.event !== "object" ||
          message.event === null
        )
          return [];
        return [message.event as Record<string, unknown>];
      });
      const streamEnvelopes = events.flatMap((outer) => {
        const message = outer.message;
        return outer.type === "message" &&
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "stream_event"
          ? [message as Record<string, unknown>]
          : [];
      });
      const streamEnvelopeUuids = streamEnvelopes.map((message) =>
        String(message.uuid),
      );
      expect(new Set(streamEnvelopeUuids).size).toBe(
        streamEnvelopeUuids.length,
      );

      // Match the retained frontend's transport-level UUID deduplication.
      // Every live frame, finalized assistant message, tool result, and result
      // must survive this projection; reusing the assistant UUID on stream
      // envelopes used to leave only message_start visible until reload.
      const seenTransportUuids = new Set<string>();
      const frontendAccepted = events.flatMap((outer) => {
        const message = outer.message;
        if (
          outer.type !== "message" ||
          typeof message !== "object" ||
          message === null
        )
          return [];
        const uuid = "uuid" in message ? String(message.uuid) : "";
        if (uuid && seenTransportUuids.has(uuid)) return [];
        if (uuid) seenTransportUuids.add(uuid);
        return [message as Record<string, unknown>];
      });
      const frontendStreamEvents = frontendAccepted.flatMap((message) =>
        message.type === "stream_event" &&
        typeof message.event === "object" &&
        message.event !== null
          ? [message.event as Record<string, unknown>]
          : [],
      );
      expect(frontendStreamEvents.map((event) => event.type)).toEqual(
        expect.arrayContaining([
          "message_start",
          "content_block_start",
          "content_block_delta",
          "content_block_stop",
          "message_delta",
          "message_stop",
        ]),
      );
      expect(frontendAccepted).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "assistant" }),
          expect.objectContaining({
            type: "user",
            tool_use_result: expect.any(Object),
          }),
          expect.objectContaining({ type: "result" }),
        ]),
      );
      expect(streamEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "message_start" }),
          expect.objectContaining({
            type: "content_block_delta",
            delta: expect.objectContaining({
              type: "thinking_delta",
              thinking: "I should create the proof file.",
            }),
          }),
          expect.objectContaining({
            type: "content_block_delta",
            delta: expect.objectContaining({
              type: "text_delta",
              text: "Created stream-proof.md successfully.",
            }),
          }),
          expect.objectContaining({ type: "message_stop" }),
          expect.objectContaining({
            type: "content_block_start",
            content_block: expect.objectContaining({
              type: "tool_use",
              id: "call_stream_write",
              name: "Write",
            }),
          }),
          expect.objectContaining({
            type: "content_block_delta",
            delta: expect.objectContaining({
              type: "input_json_delta",
              partial_json:
                '{"file_path":"/home/user/stream-proof.md","content":"streamed tool proof"}',
            }),
          }),
        ]),
      );
      expect(
        streamEvents.filter(
          (event) =>
            event.type === "content_block_delta" &&
            typeof event.delta === "object" &&
            event.delta !== null &&
            "type" in event.delta &&
            event.delta.type === "thinking_delta",
        ),
      ).toHaveLength(2);
      const streamedToolIndex = events.findIndex((outer) => {
        const message = outer.message;
        return (
          outer.type === "message" &&
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "stream_event" &&
          "event" in message &&
          typeof message.event === "object" &&
          message.event !== null &&
          "type" in message.event &&
          message.event.type === "content_block_start" &&
          "content_block" in message.event &&
          typeof message.event.content_block === "object" &&
          message.event.content_block !== null &&
          "type" in message.event.content_block &&
          message.event.content_block.type === "tool_use"
        );
      });
      const firstPartialIndex = events.findIndex((outer) => {
        const message = outer.message;
        return (
          outer.type === "message" &&
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "stream_event"
        );
      });
      const firstFinalAssistantIndex = events.findIndex((outer) => {
        const message = outer.message;
        return (
          outer.type === "message" &&
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "assistant"
        );
      });
      expect(firstPartialIndex).toBeGreaterThanOrEqual(0);
      expect(streamedToolIndex).toBeGreaterThan(firstPartialIndex);
      expect(streamedToolIndex).toBeLessThan(firstFinalAssistantIndex);
      expect(firstFinalAssistantIndex).toBeGreaterThan(firstPartialIndex);
      expect(transcript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "result",
            result: "Created stream-proof.md successfully.",
          }),
        ]),
      );
      expect(transcript).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "stream_event" }),
        ]),
      );
    } finally {
      providerTimeoutSpy?.mockRestore();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("replays an active stream with fresh envelopes when a session is reopened", async () => {
    let releaseProvider: (() => void) | undefined;
    let manager: LocalCodeSessionManager | undefined;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const server = createServer(async (request, response) => {
      for await (const _chunk of request) {
        // Drain the request before beginning the response.
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Visible before switch." } }] })}\n\n`,
      );
      await providerGate;
      response.end(
        `data: ${JSON.stringify({ choices: [{ delta: { content: " Visible after switch." } }] })}\n\ndata: [DONE]\n\n`,
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing session-switch provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-switch-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-switch-root-"),
      );
      temporaryDirectories.push(directory, workspace);
      const events: Array<Record<string, unknown>> = [];
      manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "switch-model",
        }),
        (event) => events.push(event),
        () => undefined,
      );
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Keep streaming while I switch sessions",
          permissionMode: "dontAsk",
        },
      ])) as { sessionId: string };

      // The initial route fetch activates the deferred run.
      await manager.invoke("getTranscript", [started.sessionId]);

      const streamMessages = () =>
        events.flatMap((outer) => {
          const message = outer.message;
          return outer.type === "message" &&
            typeof message === "object" &&
            message !== null &&
            "type" in message &&
            message.type === "stream_event"
            ? [message as Record<string, unknown>]
            : [];
        });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (
          streamMessages().some(
            (message) =>
              typeof message.event === "object" &&
              message.event !== null &&
              "type" in message.event &&
              message.event.type === "content_block_delta",
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // A route switch reopens the session by fetching its transcript. The
      // active stream must replay message_start without colliding at the
      // transport-deduplication layer.
      await manager.invoke("getTranscript", [started.sessionId]);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const starts = streamMessages().filter(
          (message) =>
            typeof message.event === "object" &&
            message.event !== null &&
            "type" in message.event &&
            message.event.type === "message_start",
        );
        if (starts.length >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const starts = streamMessages().filter(
        (message) =>
          typeof message.event === "object" &&
          message.event !== null &&
          "type" in message.event &&
          message.event.type === "message_start",
      );
      expect(starts).toHaveLength(2);
      expect(new Set(starts.map((message) => message.uuid)).size).toBe(2);
      expect(
        new Set(
          starts.map((message) => {
            const event = message.event as Record<string, unknown>;
            const inner = event.message as Record<string, unknown>;
            return inner.id;
          }),
        ).size,
      ).toBe(1);

      releaseProvider?.();
      const transcript = await waitForResult(manager, started.sessionId);
      expect(transcript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "result",
            result: "Visible before switch. Visible after switch.",
          }),
        ]),
      );
    } finally {
      releaseProvider?.();
      await manager?.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 15_000);

  it("retries reasoning-only empty turns before completing", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message:
                requests.length < 3
                  ? {
                      role: "assistant",
                      content: "",
                      reasoning_content: "Planning the response.",
                    }
                  : {
                      role: "assistant",
                      content: "Recovered after empty provider turns.",
                    },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing empty-turn provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-empty-turn-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-empty-turn-root-"),
      );
      temporaryDirectories.push(directory, workspace);
      const manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "reasoning-model",
        }),
        () => undefined,
        () => undefined,
      );
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Finish visibly",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);

      expect(requests).toHaveLength(3);
      expect(requests[1].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("no visible answer"),
          }),
        ]),
      );
      expect(transcript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "result",
            result: "Recovered after empty provider turns.",
            is_error: false,
          }),
        ]),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("keeps direct file access inside the selected workspace", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-policy-"),
    );
    const workspace = await mkdtemp(path.join(os.tmpdir(), "local-code-root-"));
    temporaryDirectories.push(directory, workspace);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    const started = (await manager.invoke("start", [
      {
        cwd: workspace,
        message: "Inspect files",
        permissionMode: "dontAsk",
      },
    ])) as { sessionId: string };
    const reservedDirectory = path.join(workspace, ".claude");
    const reservedFile = path.join(reservedDirectory, "reserved.txt");
    await mkdir(reservedDirectory);
    await writeFile(reservedFile, "reserved-marker", "utf8");
    expect(
      await manager.invoke("readSessionFile", [
        started.sessionId,
        reservedFile,
      ]),
    ).toBeNull();
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        reservedFile,
        "must not overwrite",
      ]),
    ).toEqual({ status: "denied" });
    expect(await readFile(reservedFile, "utf8")).toBe("reserved-marker");
    const reservedAlias = path.join(workspace, "reserved-alias");
    await symlink(
      reservedDirectory,
      reservedAlias,
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(
      await manager.invoke("readSessionFile", [
        started.sessionId,
        path.join(reservedAlias, "reserved.txt"),
      ]),
    ).toBeNull();
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        path.join(reservedAlias, "reserved.txt"),
        "must not overwrite through an alias",
      ]),
    ).toEqual({ status: "denied" });
    expect(await readFile(reservedFile, "utf8")).toBe("reserved-marker");

    const internal = manager as unknown as {
      session: (sessionId: string) => Record<string, unknown> | undefined;
      toolGlob: (
        session: Record<string, unknown>,
        input: Record<string, unknown>,
        signal: AbortSignal,
      ) => Promise<{ modelOutput: string }>;
      toolGrep: (
        session: Record<string, unknown>,
        input: Record<string, unknown>,
        signal: AbortSignal,
      ) => Promise<{ modelOutput: string }>;
      toolBash: (
        session: Record<string, unknown>,
        input: Record<string, unknown>,
        signal: AbortSignal,
      ) => Promise<unknown>;
    };
    const session = internal.session(started.sessionId)!;
    const signal = new AbortController().signal;
    await expect(
      internal.toolGlob(session, { pattern: "**/*" }, signal),
    ).resolves.toEqual(
      expect.objectContaining({
        modelOutput: expect.not.stringContaining(".claude"),
      }),
    );
    await expect(
      internal.toolGrep(session, { pattern: "reserved-marker" }, signal),
    ).resolves.toEqual(expect.objectContaining({ modelOutput: "No matches" }));
    await expect(
      internal.toolBash(
        session,
        {
          command:
            "node -e \"require('fs').readFileSync('.claude/reserved.txt')\"",
        },
        signal,
      ),
    ).rejects.toThrow("reserved for Anthropic Claude");
    await expect(
      internal.toolBash(session, { command: "claude -p test" }, signal),
    ).rejects.toThrow("external Claude Code CLI");

    const outside = path.join(workspace, "..", "outside.txt");
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        outside,
        "blocked",
      ]),
    ).toEqual({ status: "denied" });

    const external = await mkdtemp(
      path.join(os.tmpdir(), "local-code-outside-"),
    );
    temporaryDirectories.push(external);
    await writeFile(path.join(external, "existing.txt"), "outside", "utf8");
    const linked = path.join(workspace, "linked");
    await symlink(
      external,
      linked,
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        path.join(linked, "existing.txt"),
        "must not overwrite",
      ]),
    ).toEqual({ status: "denied" });
    expect(await readFile(path.join(external, "existing.txt"), "utf8")).toBe(
      "outside",
    );
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        path.join(linked, "new", "file.txt"),
        "must not create",
      ]),
    ).toEqual({ status: "denied" });
    await expect(access(path.join(external, "new"))).rejects.toThrow();

    const movedWorkspace = `${workspace}-moved`;
    temporaryDirectories.push(movedWorkspace);
    await rename(workspace, movedWorkspace);
    await symlink(
      external,
      workspace,
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(
      await manager.invoke("readSessionFile", [
        started.sessionId,
        "existing.txt",
      ]),
    ).toBeNull();
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        "existing.txt",
        "must still not overwrite",
      ]),
    ).toEqual({ status: "denied" });
    expect(await readFile(path.join(external, "existing.txt"), "utf8")).toBe(
      "outside",
    );

    await expect(
      manager.invoke("start", [
        {
          sessionId: started.sessionId,
          cwd: workspace,
          message: "Duplicate id",
        },
      ]),
    ).rejects.toThrow(/already exists/);
    await expect(
      manager.invoke("start", [{ cwd: workspace, message: { not: "text" } }]),
    ).rejects.toThrow(/message/i);
    await waitForResult(manager, started.sessionId);
    await manager.invoke("stop", [started.sessionId]);
  });

  it("updates canonical file authority when workspace roots change", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-roots-"),
    );
    const original = await mkdtemp(
      path.join(os.tmpdir(), "local-code-original-"),
    );
    const changed = await mkdtemp(
      path.join(os.tmpdir(), "local-code-changed-"),
    );
    const additional = await mkdtemp(
      path.join(os.tmpdir(), "local-code-additional-"),
    );
    temporaryDirectories.push(directory, original, changed, additional);
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    const started = (await manager.invoke("start", [
      { cwd: original, message: "Inspect files", permissionMode: "dontAsk" },
    ])) as { sessionId: string };
    await manager.invoke("stop", [started.sessionId]);

    await manager.invoke("changeCwd", [started.sessionId, changed]);
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        "changed.txt",
        "new root",
      ]),
    ).toEqual(expect.objectContaining({ status: "ok" }));
    expect(await readFile(path.join(changed, "changed.txt"), "utf8")).toBe(
      "new root",
    );
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        path.join(original, "stale.txt"),
        "must not write",
      ]),
    ).toEqual({ status: "denied" });

    expect(
      await manager.invoke("addDirectories", [started.sessionId, [additional]]),
    ).toBe(true);
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        path.join(additional, "additional.txt"),
        "additional root",
      ]),
    ).toEqual(expect.objectContaining({ status: "ok" }));
    expect(
      await readFile(path.join(additional, "additional.txt"), "utf8"),
    ).toBe("additional root");
  });

  it("does not widen inherited workspace access when a fork changes cwd", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-code-fork-"));
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-fork-root-"),
    );
    const targetWorkspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-fork-target-"),
    );
    const additional = await mkdtemp(
      path.join(os.tmpdir(), "local-code-fork-additional-"),
    );
    const external = await mkdtemp(
      path.join(os.tmpdir(), "local-code-fork-external-"),
    );
    temporaryDirectories.push(
      directory,
      workspace,
      targetWorkspace,
      additional,
      external,
    );
    await writeFile(path.join(external, "outside.txt"), "outside", "utf8");
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    const started = (await manager.invoke("start", [
      {
        cwd: workspace,
        additionalDirectories: [additional],
        message: "Inspect files",
        permissionMode: "dontAsk",
      },
    ])) as { sessionId: string };

    const movedAdditional = `${additional}-moved`;
    temporaryDirectories.push(movedAdditional);
    await rename(additional, movedAdditional);
    await symlink(
      external,
      additional,
      process.platform === "win32" ? "junction" : "dir",
    );
    const forked = (await manager.invoke("forkSession", [
      started.sessionId,
      "safe-fork",
      undefined,
      targetWorkspace,
    ])) as { sessionId: string };

    expect(forked.sessionId).toBe("safe-fork");
    expect(
      await manager.invoke("readSessionFile", [
        forked.sessionId,
        path.join(additional, "outside.txt"),
      ]),
    ).toBeNull();
    await waitForResult(manager, started.sessionId);
    await manager.invoke("stop", [started.sessionId]);
  });

  it("normalizes malformed persisted sessions instead of hydrating crash-prone state", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-code-bad-"));
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-bad-root-"),
    );
    temporaryDirectories.push(directory, workspace);
    await writeFile(
      path.join(directory, "local-code-sessions.json"),
      JSON.stringify({
        version: 1,
        sessions: [
          {
            sessionId: "recovered",
            cwd: workspace,
            additionalDirectories: "not-an-array",
            transcript: [null, "bad", { type: "user", message: "ok" }],
            artifacts: [null],
            permissionMode: "invalid",
          },
          {
            sessionId: "summarized",
            cwd: workspace,
            transcript: [
              { type: "user", message: { content: "old question" } },
              { type: "assistant", message: { content: "old answer" } },
            ],
            contextSummary: {
              summary: "The old exchange was summarized.",
              upToTranscriptIndex: 1,
              createdAt: "2026-07-19T00:00:00.000Z",
            },
          },
          { sessionId: "recovered", cwd: workspace, title: "duplicate" },
          { sessionId: "missing-cwd" },
        ],
      }),
      "utf8",
    );
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      () => undefined,
      () => undefined,
    );
    expect(await manager.invoke("getAll", [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "recovered",
          cwd: path.resolve(workspace),
          permissionMode: "acceptEdits",
          additionalDirectories: [],
        }),
        expect.objectContaining({
          sessionId: "summarized",
          contextSummary: expect.objectContaining({
            summary: "The old exchange was summarized.",
            upToTranscriptIndex: 1,
          }),
        }),
      ]),
    );
    expect(await manager.invoke("getTranscript", ["recovered"])).toEqual([
      { type: "user", message: "ok" },
    ]);
  });

  it("backs the native terminal transport with an interactive PTY", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-code-pty-"));
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-pty-root-"),
    );
    temporaryDirectories.push(directory, workspace);
    const events: Array<Record<string, unknown>> = [];
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => null,
      (event) => events.push(event),
      () => undefined,
    );
    const started = (await manager.invoke("start", [
      {
        cwd: workspace,
        message: "Open a terminal",
        permissionMode: "dontAsk",
      },
    ])) as { sessionId: string };
    const ptyKey = `${started.sessionId}::1`;

    expect(await manager.invoke("startShellPty", [ptyKey, 92, 30])).toEqual(
      expect.objectContaining({ ok: true, cols: 92, rows: 30 }),
    );
    await manager.invoke("writeShellPty", [ptyKey, "echo TERMINAL_READY\r"]);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        events.some(
          (event) =>
            event.type === "shell_pty_data" &&
            event.sessionId === ptyKey &&
            String(event.data).includes("TERMINAL_READY"),
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(await manager.invoke("getShellPtyBuffer", [ptyKey])).toContain(
      "TERMINAL_READY",
    );
    expect(
      await manager.invoke("getBusyShellPtyKeys", [started.sessionId]),
    ).toEqual(
      expect.objectContaining({
        live: [ptyKey],
        busy: expect.any(Array),
        probed: true,
      }),
    );
    await manager.invoke("stopShellPty", [ptyKey]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "shell_pty_close",
          sessionId: ptyKey,
        }),
      ]),
    );
    await manager.dispose();
  });

  it("falls back for providers without function tools and honors one-time approval", async () => {
    let fallbackTurns = 0;
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (Array.isArray(parsed.tools)) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "tools are unsupported" }));
        return;
      }
      fallbackTurns += 1;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  fallbackTurns === 1
                    ? '<tool_call>{"name":"Write","arguments":{"file_path":"fallback.txt","content":"fallback provider proof"}}</tool_call>'
                    : "Fallback tool loop complete.",
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing fallback provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-fallback-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-fallback-root-"),
      );
      temporaryDirectories.push(directory, workspace);
      const permissions: object[] = [];
      let manager: LocalCodeSessionManager;
      manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "fallback-model",
        }),
        () => undefined,
        (request) => {
          permissions.push(request);
          queueMicrotask(() => {
            void manager.invoke("respondToToolPermission", [
              request.requestId,
              "once",
            ]);
          });
        },
      );
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Create a proof file",
          permissionMode: "default",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);
      await manager.invoke("stop", [started.sessionId]);

      expect(fallbackTurns).toBe(2);
      expect(permissions).toHaveLength(1);
      expect(await readFile(path.join(workspace, "fallback.txt"), "utf8")).toBe(
        "fallback provider proof",
      );
      expect(transcript.at(-1)).toEqual(
        expect.objectContaining({
          type: "result",
          result: "Fallback tool loop complete.",
        }),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("recovers a name-less textual Bash call from a provider that accepts tool schemas", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  requests.length === 1
                    ? '<tool_call>{"command":"node -p "40+2""}</tool_call>'
                    : "Hybrid textual tool loop complete.",
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing hybrid provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-code-hybrid-"),
      );
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "local-code-hybrid-root-"),
      );
      temporaryDirectories.push(directory, workspace);
      const permissions: object[] = [];
      let manager: LocalCodeSessionManager;
      manager = await LocalCodeSessionManager.create(
        directory,
        () => ({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "hybrid-model",
        }),
        () => undefined,
        (request) => {
          permissions.push(request);
          queueMicrotask(() => {
            void manager.invoke("respondToToolPermission", [
              request.requestId,
              "once",
            ]);
          });
        },
      );
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Run the proof command",
          permissionMode: "default",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);
      await manager.invoke("stop", [started.sessionId]);

      expect(requests).toHaveLength(2);
      expect(requests[0].tools).toEqual(expect.any(Array));
      expect(requests[1].tools).toBeUndefined();
      expect(permissions).toHaveLength(1);
      expect(transcript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "result",
            result: "Hybrid textual tool loop complete.",
          }),
        ]),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
