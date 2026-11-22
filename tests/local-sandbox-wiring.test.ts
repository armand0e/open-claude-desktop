import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalBackend,
  type LocalSandboxSource,
} from "../src/main/local-backend";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function fakeSandbox(workspaceRoot: string) {
  const calls: Array<{
    conversationUuid: string;
    command: string;
    allowNetwork: boolean;
  }> = [];
  const sandbox: LocalSandboxSource = {
    status: async () => ({ docker: "ok", image: "ready" }),
    startImageBuild: () => undefined,
    runCommand: async (conversationUuid, command, options) => {
      calls.push({
        conversationUuid,
        command,
        allowNetwork: options.allowNetwork,
      });
      return {
        output: "hi from sandbox",
        generatedFiles: [{ path: "outputs/result.csv", size_bytes: 8 }],
      };
    },
    stageUpload: async () => undefined,
    stageSkillFiles: async () => undefined,
    workspaceFile: async (conversationUuid, relativePath) => {
      if (relativePath.includes("..")) return null;
      const absolutePath = path.join(
        workspaceRoot,
        conversationUuid,
        relativePath,
      );
      try {
        const { stat } = await import("node:fs/promises");
        const info = await stat(absolutePath);
        return info.isFile() ? { absolutePath, size_bytes: info.size } : null;
      } catch {
        return null;
      }
    },
  };
  return { sandbox, calls };
}

async function withMockProvider(
  turns: Array<Record<string, unknown>[]>,
  run: (baseUrl: string, requests: unknown[]) => Promise<void>,
): Promise<void> {
  const requests: unknown[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    const deltas = turns[Math.min(requests.length, turns.length) - 1];
    for (const delta of deltas)
      response.write(`data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`);
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing provider test address");
  try {
    await run(`http://127.0.0.1:${address.port}/v1`, requests);
  } finally {
    server.close();
  }
}

async function preparedBackend(baseUrl: string): Promise<LocalBackend> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "local-sbx-"));
  temporaryDirectories.push(directory);
  const backend = await LocalBackend.create(directory);
  await backend.handle(
    new Request("app://localhost/api/local/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, model: "test-model" }),
    }),
    new URL("app://localhost/api/local/config"),
  );
  return backend;
}

const CODE_TOOL_TURN = [
  {
    tool_calls: [
      {
        index: 0,
        id: "call_1",
        function: {
          name: "bash_code_execution",
          arguments: JSON.stringify({ command: "echo hi" }),
        },
      },
    ],
  },
];

async function runCompletion(backend: LocalBackend): Promise<string> {
  const conversationUuid = "00000000-0000-4000-8000-000000000201";
  const url = new URL(
    `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
  );
  const response = await backend.handle(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Run echo hi" }),
    }),
    url,
  );
  expect(response?.status).toBe(200);
  return await response!.text();
}

describe("LocalBackend code-execution wiring", () => {
  it("reports whether an image build was accepted instead of claiming nonexistent work", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-sbx-build-"));
    temporaryDirectories.push(directory);
    const backend = await LocalBackend.create(directory);
    const url = new URL("app://localhost/api/local/sandbox/build");

    const unavailable = await backend.handle(
      new Request(url, { method: "POST" }),
      url,
    );
    expect(unavailable?.status).toBe(503);
    await expect(unavailable?.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringMatching(/unavailable/i),
        }),
      }),
    );

    let image = "absent";
    let buildCalls = 0;
    const { sandbox } = fakeSandbox(directory);
    sandbox.status = async () => ({ docker: "ok", image });
    sandbox.startImageBuild = () => {
      buildCalls += 1;
      image = "building";
    };
    backend.setSandboxSource(sandbox);
    const accepted = await backend.handle(
      new Request(url, { method: "POST" }),
      url,
    );
    expect(accepted?.status).toBe(202);
    await expect(accepted?.json()).resolves.toEqual({
      ok: false,
      accepted: true,
      state: "building",
      detail: null,
    });
    expect(buildCalls).toBe(1);

    image = "ready";
    const ready = await backend.handle(
      new Request(url, { method: "POST" }),
      url,
    );
    expect(ready?.status).toBe(200);
    await expect(ready?.json()).resolves.toEqual({
      ok: true,
      accepted: false,
      state: "ready",
      detail: null,
    });
    expect(buildCalls).toBe(1);
  });

  it("reports sandbox status and exposes the enable flag", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-sbx-"));
    temporaryDirectories.push(directory);
    const backend = await LocalBackend.create(directory);
    const url = new URL("app://localhost/api/local/sandbox/status");
    const withoutSource = await backend.handle(new Request(url), url);
    expect(await withoutSource?.json()).toEqual(
      expect.objectContaining({ enabled: false, docker: "missing" }),
    );

    const { sandbox } = fakeSandbox(directory);
    backend.setSandboxSource(sandbox);
    await backend.updateAccountSettings({ enabled_wiggle: true });
    const withSource = await backend.handle(new Request(url), url);
    expect(await withSource?.json()).toEqual(
      expect.objectContaining({ enabled: true, docker: "ok", image: "ready" }),
    );
  });

  it("executes bash_code_execution calls and reports generated files", async () => {
    await withMockProvider(
      [CODE_TOOL_TURN, [{ content: "Ran it." }]],
      async (baseUrl, requests) => {
        const backend = await preparedBackend(baseUrl);
        const { sandbox, calls } = fakeSandbox("unused");
        backend.setSandboxSource(sandbox);
        await backend.updateAccountSettings({ enabled_wiggle: true });

        const body = await runCompletion(backend);
        expect(calls).toEqual([
          {
            conversationUuid: "00000000-0000-4000-8000-000000000201",
            command: "echo hi",
            allowNetwork: false,
          },
        ]);
        expect(body).toContain("File/data workspace · echo hi");
        expect(body).toContain("hi from sandbox");
        expect(body).toContain(
          "/api/local/sandbox/files/00000000-0000-4000-8000-000000000201/outputs/result.csv",
        );
        // The provider's follow-up request carries the tool result.
        expect(JSON.stringify(requests.at(-1))).toContain("hi from sandbox");
        const initialRequest = JSON.stringify(requests[0]);
        expect(initialRequest).toContain(
          "A private file-processing and data-analysis workspace is enabled",
        );
        expect(initialRequest).toContain(
          "This is not Code mode and not a general software-development environment",
        );
        expect(initialRequest).toContain(
          "Only files under /workspace persist between calls",
        );
        expect(initialRequest).toContain(
          "must not be used for project development, dev servers, deployment, general browsing, or ordinary text-only answers",
        );
        expect(initialRequest).not.toContain(
          "persistent sandboxed Linux container",
        );
      },
    );
  });

  it("fails closed when code execution is disabled", async () => {
    await withMockProvider(
      [CODE_TOOL_TURN, [{ content: "Understood." }]],
      async (baseUrl, requests) => {
        const backend = await preparedBackend(baseUrl);
        const { sandbox, calls } = fakeSandbox("unused");
        backend.setSandboxSource(sandbox);

        const body = await runCompletion(backend);
        expect(calls).toEqual([]);
        expect(body).not.toContain("File/data workspace");
        expect(JSON.stringify(requests.at(-1))).toContain(
          "Code execution is disabled",
        );
      },
    );
  });

  it("serves workspace downloads and blocks traversal", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-sbx-"));
    temporaryDirectories.push(directory);
    const backend = await LocalBackend.create(directory);
    const { sandbox } = fakeSandbox(directory);
    backend.setSandboxSource(sandbox);
    const conversation = "00000000-0000-4000-8000-000000000301";
    await rm(path.join(directory, conversation), {
      recursive: true,
      force: true,
    });
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(directory, conversation, "outputs"), {
      recursive: true,
    });
    await writeFile(
      path.join(directory, conversation, "outputs", "result.csv"),
      "a,b\n1,2\n",
    );

    const good = new URL(
      `app://localhost/api/local/sandbox/files/${conversation}/outputs/result.csv`,
    );
    const served = await backend.handle(new Request(good), good);
    expect(served?.status).toBe(200);
    expect(await served?.text()).toBe("a,b\n1,2\n");
    expect(served?.headers.get("Content-Disposition")).toContain("result.csv");
    expect(served?.headers.get("Content-Length")).toBe("8");
    expect(served?.headers.get("Cache-Control")).toBe("no-store");
    expect(served?.headers.get("X-Content-Type-Options")).toBe("nosniff");

    const bad = new URL(
      `app://localhost/api/local/sandbox/files/${conversation}/..%2F..%2Fsecret.txt`,
    );
    const blocked = await backend.handle(new Request(bad), bad);
    expect(blocked?.status).toBe(404);
  });
});
