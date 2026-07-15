import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
                          file_path: "proof.md",
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
          permissionMode: "bypassPermissions",
        },
      ])) as { sessionId: string };
      const transcript = await waitForResult(manager, started.sessionId);

      expect(await readFile(path.join(workspace, "proof.md"), "utf8")).toBe(
        "local code harness proof",
      );
      expect(requests).toHaveLength(3);
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
    const outside = path.join(workspace, "..", "outside.txt");
    expect(
      await manager.invoke("writeSessionFile", [
        started.sessionId,
        outside,
        "blocked",
      ]),
    ).toEqual({ status: "denied" });
    await waitForResult(manager, started.sessionId);
    await manager.invoke("stop", [started.sessionId]);
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
    manager.dispose();
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
});
