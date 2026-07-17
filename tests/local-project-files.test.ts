import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalBackend } from "../src/main/local-backend";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function call(
  backend: LocalBackend,
  pathName: string,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(`app://localhost${pathName}`);
  const response = await backend.handle(new Request(url, init), url);
  if (!response) throw new Error(`Unhandled route: ${pathName}`);
  return response;
}

describe("project knowledge-base files", () => {
  it("uploads, lists, injects into project chats, and deletes", async () => {
    const systemPrompts: string[] = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as {
        messages: Array<{ role: string; content: string }>;
      };
      systemPrompts.push(
        parsed.messages.find((message) => message.role === "system")?.content ??
          "",
      );
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Noted." } }] })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing provider test address");

    try {
      const directory = await mkdtemp(path.join(os.tmpdir(), "project-kb-"));
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      await call(backend, "/api/local/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          model: "test-model",
        }),
      });

      const created = (await (
        await call(backend, "/api/organizations/org/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "KB project" }),
        })
      ).json()) as { uuid: string };

      const form = new FormData();
      form.append(
        "file",
        new File(
          ["The launch codeword is peregrine-falcon-42."],
          "codeword.txt",
          { type: "text/plain" },
        ),
      );
      const uploaded = (await (
        await call(
          backend,
          `/api/organizations/org/projects/${created.uuid}/upload`,
          { method: "POST", body: form },
        )
      ).json()) as { uuid: string; file_name: string; file_size: number };
      expect(uploaded.file_name).toBe("codeword.txt");
      expect(uploaded.file_size).toBeGreaterThan(0);

      const listed = (await (
        await call(
          backend,
          `/api/organizations/org/projects/${created.uuid}/files`,
        )
      ).json()) as Array<{ uuid: string; file_name: string }>;
      expect(listed).toHaveLength(1);
      expect(listed[0].file_name).toBe("codeword.txt");

      const stats = (await (
        await call(
          backend,
          `/api/organizations/org/projects/${created.uuid}/kb/stats`,
        )
      ).json()) as { file_count: number; total_size_bytes: number };
      expect(stats.file_count).toBe(1);
      expect(stats.total_size_bytes).toBeGreaterThan(0);

      // A fresh chat in the project sees the file content without attaching.
      const conversationUuid = "00000000-0000-4000-8000-000000000401";
      const completion = await call(
        backend,
        `/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "What is the codeword?",
            create_conversation_params: {
              uuid: conversationUuid,
              project_uuid: created.uuid,
            },
          }),
        },
      );
      expect(completion.status).toBe(200);
      await completion.text();
      expect(systemPrompts.at(-1)).toContain("peregrine-falcon-42");
      expect(systemPrompts.at(-1)).toContain("codeword.txt");

      // Blob exists on disk until deletion.
      const filesDir = path.join(directory, "local-files");
      expect(existsSync(filesDir)).toBe(true);
      const deleteMany = await call(
        backend,
        `/api/organizations/org/projects/${created.uuid}/files/delete_many`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_uuids: [uploaded.uuid] }),
        },
      );
      expect(deleteMany.status).toBe(200);
      const afterDelete = (await (
        await call(
          backend,
          `/api/organizations/org/projects/${created.uuid}/files`,
        )
      ).json()) as unknown[];
      expect(afterDelete).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
