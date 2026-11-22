import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalCodeSessionManager } from "../src/main/local-code";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function transcript(
  manager: LocalCodeSessionManager,
  sessionId: string,
): Promise<Array<Record<string, unknown>>> {
  return (await manager.invoke("getTranscript", [sessionId])) as Array<
    Record<string, unknown>
  >;
}

async function waitUntil<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let attempt = 0; attempt < 250; attempt += 1) {
    const value = await read();
    if (value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for background-task state");
}

describe("Code background agents", () => {
  it("runs three concurrently, queues the fourth, supports per-task stop, and exposes drill-down transcripts", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    let activeChildren = 0;
    let maximumChildren = 0;
    let releaseChildren!: () => void;
    const childGate = new Promise<void>((resolve) => {
      releaseChildren = resolve;
    });
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      const system = String(parsed.messages?.[0]?.content ?? "");
      const isChild = system.includes("background subagent launched");
      if (isChild) {
        activeChildren += 1;
        maximumChildren = Math.max(maximumChildren, activeChildren);
        await childGate;
        const prompt = String(parsed.messages?.[1]?.content ?? "task");
        activeChildren -= 1;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: `Completed ${prompt}`,
                },
              },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 30 },
          }),
        );
        return;
      }

      const serializedMessages = JSON.stringify(parsed.messages ?? []);
      const completed = (serializedMessages.match(/<background-task /g) ?? [])
        .length;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [
            {
              message:
                serializedMessages.includes('"name":"Task"') ||
                serializedMessages.includes("async_launched")
                  ? {
                      role: "assistant",
                      content:
                        completed === 4
                          ? "Integrated all four background results."
                          : "Foreground mapping is complete; waiting for background results.",
                    }
                  : {
                      role: "assistant",
                      content: "Launching independent mapping tasks.",
                      tool_calls: [1, 2, 3, 4].map((index) => ({
                        id: `call_background_${index}`,
                        type: "function",
                        function: {
                          name: "Task",
                          arguments: JSON.stringify({
                            description: `Background ${index}`,
                            prompt: `background-${index}`,
                          }),
                        },
                      })),
                    },
            },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 10 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing background provider address");
    const events: Array<Record<string, unknown>> = [];
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => ({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "background-test-model",
        contextWindow: 32_000,
      }),
      (event) => events.push(event),
      () => undefined,
    );
    manager.setWorkflowsEnabled(() => true);

    try {
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Map four independent areas in parallel",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const taskRows = await waitUntil(async () => {
        const rows = (await transcript(manager, started.sessionId)).filter(
          (entry) => entry.subtype === "task_started",
        );
        return rows.length === 4 ? rows : undefined;
      });
      await waitUntil(async () => (maximumChildren === 3 ? true : undefined));
      const fourthId = String(taskRows[3].task_id);
      await manager.invoke("stopTask", [started.sessionId, fourthId]);

      const stopped = await waitUntil(async () =>
        (await transcript(manager, started.sessionId)).find(
          (entry) =>
            entry.subtype === "task_notification" &&
            entry.task_id === fourthId &&
            entry.status === "stopped",
        ),
      );
      expect(stopped.summary).toContain("before the agent started");
      expect(
        (await manager.invoke("getSession", [started.sessionId])) as {
          isRunning: boolean;
        },
      ).toMatchObject({ isRunning: true });

      releaseChildren();
      const finalTranscript = await waitUntil(async () => {
        const rows = await transcript(manager, started.sessionId);
        return rows.some(
          (entry) =>
            entry.type === "result" &&
            entry.result === "Integrated all four background results.",
        )
          ? rows
          : undefined;
      });
      expect(maximumChildren).toBe(3);
      const notifications = finalTranscript.filter(
        (entry) => entry.subtype === "task_notification",
      );
      expect(notifications).toHaveLength(4);
      expect(
        notifications.filter((entry) => entry.status === "completed"),
      ).toHaveLength(3);
      expect(
        notifications
          .filter((entry) => entry.status === "completed")
          .every(
            (entry) =>
              Number((entry.usage as Record<string, unknown>).total_tokens) ===
              150,
          ),
      ).toBe(true);

      const firstTask = taskRows[0];
      const drillDown = (await manager.invoke("readCliTranscript", [
        firstTask.task_id,
        0,
        100,
      ])) as { messages: Array<Record<string, unknown>> };
      expect(drillDown.messages.length).toBeGreaterThanOrEqual(2);
      expect(
        drillDown.messages.every(
          (entry) => entry.parent_tool_use_id === firstTask.tool_use_id,
        ),
      ).toBe(true);
      expect(events.some((event) => event.type === "error")).toBe(false);
    } finally {
      releaseChildren();
      await manager.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("stops immediately when a background API hook ignores cancellation", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-stop-api-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-stop-api-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    let releaseHook!: () => void;
    const hookGate = new Promise<void>((resolve) => {
      releaseHook = resolve;
    });
    let signalHookEntered!: () => void;
    const hookEntered = new Promise<void>((resolve) => {
      signalHookEntered = resolve;
    });
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      const system = String(parsed.messages?.[0]?.content ?? "");
      const serialized = JSON.stringify(parsed.messages ?? []);
      response.writeHead(200, { "Content-Type": "application/json" });
      if (system.includes("background subagent launched")) {
        response.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "call_stuck_hook_write",
                      type: "function",
                      function: {
                        name: "Write",
                        arguments: JSON.stringify({
                          file_path: "never-written.txt",
                          content: "stop me",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
        );
        return;
      }
      response.end(
        JSON.stringify({
          choices: [
            {
              message: serialized.includes('"name":"Task"')
                ? { role: "assistant", content: "Waiting for the child." }
                : {
                    role: "assistant",
                    content: "",
                    tool_calls: [
                      {
                        id: "call_stuck_hook_task",
                        type: "function",
                        function: {
                          name: "Task",
                          arguments: JSON.stringify({
                            description: "Stuck API hook",
                            prompt: "Run the blocked write task",
                          }),
                        },
                      },
                    ],
                  },
            },
          ],
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing stop-api provider address");
    const events: Array<Record<string, unknown>> = [];
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => ({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "background-stop-api-test",
      }),
      (event) => events.push(event),
      () => undefined,
    );
    manager.setWorkflowsEnabled(() => true);
    manager.setPluginSource({
      enabledCustomizations: async () => [],
      readEnabledSkill: async () => null,
      runHooks: async (event, context) => {
        if (event === "PreToolUse" && typeof context.taskId === "string") {
          signalHookEntered();
          await hookGate;
        }
        return [];
      },
    });

    try {
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Launch a background task",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      await hookEntered;

      await expect(
        Promise.race([
          manager.invoke("stop", [started.sessionId]).then(() => "stopped"),
          new Promise<"timed-out">((resolve) =>
            setTimeout(() => resolve("timed-out"), 500),
          ),
        ]),
      ).resolves.toBe("stopped");
      expect(
        events.some(
          (event) =>
            event.type === "session_updated" &&
            (event.session as Record<string, unknown>)?.isRunning === false,
        ),
      ).toBe(true);
      const stopped = await waitUntil(async () =>
        (await transcript(manager, started.sessionId)).find(
          (entry) =>
            entry.subtype === "task_notification" && entry.status === "stopped",
        ),
      );
      expect(stopped.summary).toBe("Stopped by the user.");
    } finally {
      releaseHook();
      await manager.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("stops only a child that is waiting for tool permission", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-permission-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-permission-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      const system = String(parsed.messages?.[0]?.content ?? "");
      const serialized = JSON.stringify(parsed.messages ?? []);
      const message = system.includes("background subagent launched")
        ? {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "call_child_bash",
                type: "function",
                function: {
                  name: "Bash",
                  arguments: JSON.stringify({ command: "echo child" }),
                },
              },
            ],
          }
        : serialized.includes("<background-task ")
          ? { role: "assistant", content: "Integrated stopped child." }
          : serialized.includes('"name":"Task"')
            ? { role: "assistant", content: "Waiting for the child." }
            : {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_permission_child",
                    type: "function",
                    function: {
                      name: "Task",
                      arguments: JSON.stringify({
                        description: "Permission child",
                        prompt: "Run the requested command",
                      }),
                    },
                  },
                ],
              };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message }],
          usage: { prompt_tokens: 20, completion_tokens: 5 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing background provider address");
    const permissions: Array<{ taskId?: string; toolName: string }> = [];
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => ({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "background-permission-model",
        contextWindow: 32_000,
      }),
      () => undefined,
      (request) =>
        permissions.push({
          ...(request.taskId ? { taskId: request.taskId } : {}),
          toolName: request.toolName,
        }),
    );
    manager.setWorkflowsEnabled(() => true);

    try {
      const started = (await manager.invoke("start", [
        { cwd: workspace, message: "Launch one child" },
      ])) as { sessionId: string };
      const taskStarted = await waitUntil(async () =>
        (await transcript(manager, started.sessionId)).find(
          (entry) => entry.subtype === "task_started",
        ),
      );
      const permission = await waitUntil(async () =>
        permissions.find((entry) => entry.taskId === taskStarted.task_id),
      );
      expect(permission.toolName).toBe("Bash");

      await expect(
        Promise.race([
          manager.invoke("stopTask", [started.sessionId, taskStarted.task_id]),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("stopTask hung on child permission")),
              1_000,
            ),
          ),
        ]),
      ).resolves.toBeUndefined();

      const finalTranscript = await waitUntil(async () => {
        const rows = await transcript(manager, started.sessionId);
        return rows.some(
          (entry) =>
            entry.subtype === "task_notification" &&
            entry.task_id === taskStarted.task_id &&
            entry.status === "stopped",
        ) &&
          rows.some(
            (entry) =>
              entry.type === "result" &&
              entry.result === "Integrated stopped child.",
          )
          ? rows
          : undefined;
      });
      expect(finalTranscript).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subtype: "task_notification",
            task_id: taskStarted.task_id,
            status: "stopped",
          }),
        ]),
      );
      await expect(
        manager.invoke("getSession", [started.sessionId]),
      ).resolves.toEqual(
        expect.objectContaining({
          isRunning: false,
          pendingToolPermissions: [],
        }),
      );
    } finally {
      await manager.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails a child closed when its reported usage exceeds the token budget", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-budget-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-budget-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages?: Array<{ role?: string; content?: unknown }>;
      };
      const system = String(parsed.messages?.[0]?.content ?? "");
      const serialized = JSON.stringify(parsed.messages ?? []);
      const message = system.includes("background subagent launched")
        ? { role: "assistant", content: "Oversized child response" }
        : serialized.includes("<background-task ")
          ? { role: "assistant", content: "Integrated budget failure." }
          : serialized.includes('"name":"Task"')
            ? { role: "assistant", content: "Waiting for budget result." }
            : {
                role: "assistant",
                content: "",
                tool_calls: [
                  {
                    id: "call_budget_child",
                    type: "function",
                    function: {
                      name: "Task",
                      arguments: JSON.stringify({
                        description: "Budget child",
                        prompt: "Exceed the budget",
                      }),
                    },
                  },
                ],
              };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message }],
          usage: system.includes("background subagent launched")
            ? { prompt_tokens: 200_001, completion_tokens: 1 }
            : { prompt_tokens: 20, completion_tokens: 5 },
        }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing background provider address");
    const manager = await LocalCodeSessionManager.create(
      directory,
      () => ({
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "background-budget-model",
        contextWindow: 32_000,
      }),
      () => undefined,
      () => undefined,
    );
    manager.setWorkflowsEnabled(() => true);
    try {
      const started = (await manager.invoke("start", [
        {
          cwd: workspace,
          message: "Launch a budget child",
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const rows = await waitUntil(async () => {
        const current = await transcript(manager, started.sessionId);
        return current.some(
          (entry) =>
            entry.type === "result" &&
            entry.result === "Integrated budget failure.",
        )
          ? current
          : undefined;
      });
      const notification = rows.find(
        (entry) => entry.subtype === "task_notification",
      );
      expect(notification).toEqual(
        expect.objectContaining({
          status: "failed",
          summary: expect.stringMatching(/200,000-token budget/i),
          usage: expect.objectContaining({ total_tokens: 200_002 }),
        }),
      );
    } finally {
      await manager.dispose();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("recovers an unfinished persisted task as stopped instead of phantom-running it", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-recovery-"),
    );
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "local-code-background-recovery-ws-"),
    );
    temporaryDirectories.push(directory, workspace);
    const sessionId = "recovery-session";
    await writeFile(
      path.join(directory, "local-code-sessions.json"),
      JSON.stringify({
        version: 1,
        sessions: [
          {
            sessionId,
            cwd: workspace,
            originCwd: workspace,
            isRunning: true,
            model: "recovery-model",
            effort: "medium",
            createdAt: Date.now() - 10_000,
            lastActivityAt: Date.now(),
            isArchived: false,
            title: "Recovery proof",
            homePath: os.homedir(),
            folderExists: true,
            pendingToolPermissions: [],
            permissionMode: "acceptEdits",
            rootDetected: false,
            additionalDirectories: [],
            canonicalRoots: [workspace],
            transcript: [],
            artifacts: [],
            backgroundTasks: [
              {
                taskId: "task_recovery",
                toolUseId: "call_recovery",
                taskType: "local_agent",
                description: "Interrupted mapping",
                prompt: "map it",
                status: "running",
                createdAt: Date.now() - 9_000,
                startedAt: Date.now() - 8_000,
                usage: { totalTokens: 50, toolUses: 2, durationMs: 7_000 },
              },
            ],
            backgroundTaskSuggestions: [
              {
                id: "suggestion-one",
                title: "Follow-up one",
                prompt: "Investigate the first follow-up",
                tldr: "First durable suggestion",
                cwd: workspace,
              },
              {
                id: "suggestion-two",
                title: "Follow-up two",
                prompt: "Investigate the second follow-up",
              },
            ],
          },
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
    try {
      const restored = await transcript(manager, sessionId);
      expect(restored).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subtype: "task_notification",
            task_id: "task_recovery",
            status: "stopped",
            summary: "Stopped because Open-Claude restarted.",
          }),
        ]),
      );
      await expect(manager.invoke("getSession", [sessionId])).resolves.toEqual(
        expect.objectContaining({
          isRunning: false,
          backgroundTaskSuggestions: [
            expect.objectContaining({ id: "suggestion-one" }),
            expect.objectContaining({ id: "suggestion-two" }),
          ],
        }),
      );
      await expect(
        manager.invoke("popBackgroundTaskSuggestionById", [
          sessionId,
          "missing",
          false,
        ]),
      ).resolves.toBe(false);
      await expect(
        manager.invoke("popBackgroundTaskSuggestionById", [
          sessionId,
          "suggestion-two",
          true,
        ]),
      ).resolves.toBe(true);
      await expect(
        manager.invoke("popBackgroundTaskSuggestion", [sessionId, false]),
      ).resolves.toBeUndefined();
      await expect(manager.invoke("getSession", [sessionId])).resolves.toEqual(
        expect.not.objectContaining({
          backgroundTaskSuggestions: expect.anything(),
        }),
      );
    } finally {
      await manager.dispose();
    }
  });
});
