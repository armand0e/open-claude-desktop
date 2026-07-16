import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

describe("LocalBackend", () => {
  it("persists conversations and translates OpenAI streaming output", async () => {
    const requests: unknown[] = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body));
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const parts =
        requests.length === 1
          ? ["Hello", " locally"]
          : requests.length === 2
            ? ["Still here"]
            : ["Replacement answer"];
      for (const content of parts)
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
        );
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider test address");
      const directory = await mkdtemp(path.join(os.tmpdir(), "local-backend-"));
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      await backend.handle(
        new Request("app://localhost/api/local/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "test-model",
          }),
        }),
        new URL("app://localhost/api/local/config"),
      );

      const conversationUuid = "00000000-0000-4000-8000-000000000101";
      const created = await backend.handle(
        new Request(
          "app://localhost/api/organizations/org/chat_conversations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uuid: conversationUuid, name: "" }),
          },
        ),
        new URL("app://localhost/api/organizations/org/chat_conversations"),
      );
      expect(created?.status).toBe(200);

      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Say hello",
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000102",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000103",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();
      expect(events).toContain("event: message_start");
      expect(events).toContain('"text":"Hello"');
      expect(events).toContain('"text":" locally"');
      expect(events).toContain("event: message_stop");
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual(
        expect.objectContaining({
          model: "test-model",
          stream: true,
          tool_choice: "auto",
          tools: expect.arrayContaining([
            expect.objectContaining({
              function: expect.objectContaining({ name: "artifacts" }),
            }),
            expect.objectContaining({
              function: expect.objectContaining({ name: "web_search" }),
            }),
            expect.objectContaining({
              function: expect.objectContaining({ name: "visit_website" }),
            }),
          ]),
          messages: [
            expect.objectContaining({ role: "system" }),
            { role: "user", content: "Say hello" },
          ],
        }),
      );

      const followUp = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Are you there?",
            parent_message_uuid: "00000000-0000-4000-8000-000000000103",
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000104",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000105",
            },
          }),
        }),
        completionUrl,
      );
      expect(await followUp?.text()).toContain('"text":"Still here"');
      expect(requests[1]).toEqual(
        expect.objectContaining({
          model: "test-model",
          stream: true,
          messages: [
            expect.objectContaining({ role: "system" }),
            { role: "user", content: "Say hello" },
            { role: "assistant", content: "Hello locally" },
            { role: "user", content: "Are you there?" },
          ],
        }),
      );

      const retryUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/retry_completion`,
      );
      const retry = await backend.handle(
        new Request(retryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "",
            parent_message_uuid: "00000000-0000-4000-8000-000000000105",
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000106",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000107",
            },
          }),
        }),
        retryUrl,
      );
      expect(await retry?.text()).toContain('"text":"Replacement answer"');
      expect(requests[2]).toEqual(
        expect.objectContaining({
          model: "test-model",
          messages: [
            expect.objectContaining({ role: "system" }),
            { role: "user", content: "Say hello" },
            { role: "assistant", content: "Hello locally" },
            { role: "user", content: "Are you there?" },
          ],
        }),
      );

      const reopened = await LocalBackend.create(directory);
      const treeUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}?tree=True&rendering_mode=messages`,
      );
      const tree = await reopened.handle(new Request(treeUrl), treeUrl);
      const conversation = (await tree?.json()) as {
        name: string;
        current_leaf_message_uuid: string;
        chat_messages: Array<{
          uuid: string;
          sender: string;
          text: string;
          parent_message_uuid?: string;
        }>;
      };
      expect(conversation.name).toBe("Say hello");
      expect(conversation.chat_messages).toEqual([
        expect.objectContaining({ sender: "human", text: "Say hello" }),
        expect.objectContaining({
          sender: "assistant",
          text: "Hello locally",
        }),
        expect.objectContaining({ sender: "human", text: "Are you there?" }),
        expect.objectContaining({ sender: "assistant", text: "Still here" }),
        expect.objectContaining({
          uuid: "00000000-0000-4000-8000-000000000107",
          sender: "assistant",
          text: "Replacement answer",
          parent_message_uuid: "00000000-0000-4000-8000-000000000104",
        }),
      ]);
      expect(conversation.current_leaf_message_uuid).toBe(
        "00000000-0000-4000-8000-000000000107",
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("retries reasoning-only chat streams before persisting a visible answer", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta:
                providerRequests.length < 3
                  ? { reasoning_content: "Planning silently." }
                  : { content: "Recovered visible Chat reply." },
            },
          ],
        })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing reasoning-only provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-backend-empty-turn-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      const configUrl = new URL("app://localhost/api/local/config");
      await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "reasoning-chat-model",
          }),
        }),
        configUrl,
      );

      const conversationUuid = "00000000-0000-4000-8000-000000000151";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Reply visibly",
            create_conversation_params: {
              uuid: conversationUuid,
              model: "reasoning-chat-model",
            },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000152",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000153",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();
      expect(events).not.toContain('"type":"thinking"');
      expect(events).not.toContain('"type":"thinking_delta"');
      expect(events).toContain('"text":"Recovered visible Chat reply."');
      expect(providerRequests).toHaveLength(3);
      expect(providerRequests[1].messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("no visible answer"),
          }),
        ]),
      );

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        conversations: Array<{
          chat_messages: Array<{
            sender: string;
            text: string;
            content: Array<{ type: string; thinking?: string }>;
          }>;
        }>;
      };
      expect(stored.conversations[0].chat_messages.at(-1)).toEqual(
        expect.objectContaining({
          sender: "assistant",
          text: "Recovered visible Chat reply.",
        }),
      );
      expect(
        stored.conversations[0].chat_messages
          .at(-1)
          ?.content.filter((block) => block.type === "thinking"),
      ).toEqual([]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("streams and persists native artifact tool blocks and versions", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "Planning the artifact." } }] })}\n\n`,
      );
      if (providerRequests.length > 1) {
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_artifact_2",
                      function: {
                        name: "artifacts",
                        arguments: JSON.stringify({
                          command: "rewrite",
                          id: "local-demo",
                          title: "Local demo",
                          type: "text/html",
                          content: "<h1>Revised artifact</h1>",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        );
        response.end("data: [DONE]\n\n");
        return;
      }
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_artifact_1",
                    function: {
                      name: "artifacts",
                      arguments:
                        '{"command":"create","id":"local-demo","title":"Local demo","type":"text/html","content":"<h1>Hello ',
                    },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: 'artifact</h1>"}' },
                  },
                ],
              },
            },
          ],
        })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider test address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-artifact-backend-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      const configUrl = new URL("app://localhost/api/local/config");
      await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "artifact-model",
          }),
        }),
        configUrl,
      );

      const conversationUuid = "00000000-0000-4000-8000-000000000201";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Build an HTML artifact",
            create_conversation_params: {
              uuid: conversationUuid,
              model: "artifact-model",
            },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000202",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000203",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();
      expect(events).toContain('"type":"tool_use"');
      expect(events).toContain('"name":"artifacts"');
      expect(events).toContain('"type":"input_json_delta"');
      expect(events).toContain("<h1>Hello artifact</h1>");
      expect(events).toContain('"stop_reason":"tool_use"');
      expect(events).not.toContain('"type":"thinking"');

      const revision = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Revise the artifact heading",
            parent_message_uuid: "00000000-0000-4000-8000-000000000203",
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000204",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000205",
            },
          }),
        }),
        completionUrl,
      );
      const revisionEvents = await revision?.text();
      expect(revisionEvents).toContain("<h1>Revised artifact</h1>");
      expect(revisionEvents).toContain('"stop_reason":"tool_use"');
      expect(revisionEvents).not.toContain('"type":"thinking"');

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        version: number;
        artifacts: Array<{
          uuid: string;
          versions: Array<{ uuid: string; content: string }>;
        }>;
        conversations: Array<{
          chat_messages: Array<{ content: Array<{ type: string }> }>;
        }>;
      };
      expect(stored.version).toBe(3);
      expect(stored.artifacts).toHaveLength(1);
      expect(stored.artifacts[0].versions).toHaveLength(2);
      expect(stored.artifacts[0].versions[0].content).toBe(
        "<h1>Hello artifact</h1>",
      );
      expect(stored.artifacts[0].versions[1].content).toBe(
        "<h1>Revised artifact</h1>",
      );
      expect(stored.conversations[0].chat_messages.at(-1)?.content).toEqual([
        expect.objectContaining({
          type: "tool_use",
          name: "artifacts",
          input: expect.objectContaining({
            id: "local-demo",
            title: "Local demo",
            type: "text/html",
          }),
        }),
      ]);

      const versionUuid = stored.artifacts[0].versions[0].uuid;
      const versionUrl = new URL(
        `app://localhost/api/organizations/org/artifact-versions/${versionUuid}`,
      );
      const versionResponse = await backend.handle(
        new Request(versionUrl),
        versionUrl,
      );
      expect(await versionResponse?.json()).toEqual(
        expect.objectContaining({
          uuid: versionUuid,
          type: "text/html",
          title: "Local demo",
          result_state: "<h1>Hello artifact</h1>",
        }),
      );
      const latestVersionUrl = new URL(
        `app://localhost/api/organizations/org/artifact-versions/by-artifact/${stored.artifacts[0].uuid}`,
      );
      const latestVersionResponse = await backend.handle(
        new Request(latestVersionUrl),
        latestVersionUrl,
      );
      expect(await latestVersionResponse?.json()).toEqual(
        expect.objectContaining({
          result_state: "<h1>Revised artifact</h1>",
        }),
      );
      expect(providerRequests).toHaveLength(2);
      expect(providerRequests[0].tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            function: expect.objectContaining({ name: "artifacts" }),
          }),
        ]),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("extracts, persists, and forwards local file attachments", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "Attachment received" } }] })}\n\n`,
      );
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider test address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-attachment-backend-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      const configUrl = new URL("app://localhost/api/local/config");
      await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "attachment-model",
          }),
        }),
        configUrl,
      );

      const conversionUrl = new URL(
        "app://localhost/api/organizations/org/convert_document",
      );
      const conversionForm = new FormData();
      conversionForm.append(
        "file",
        new File(["local attachment proof phrase"], "proof.txt", {
          type: "text/plain",
        }),
      );
      const conversion = await backend.handle(
        new Request(conversionUrl, {
          method: "POST",
          body: conversionForm,
        }),
        conversionUrl,
      );
      const attachment = (await conversion?.json()) as Record<string, unknown>;
      expect(attachment).toEqual(
        expect.objectContaining({
          file_name: "proof.txt",
          extracted_content: "local attachment proof phrase",
        }),
      );

      const uploadUrl = new URL("app://localhost/api/org/upload");
      const uploadForm = new FormData();
      uploadForm.append(
        "file",
        new File(["second persisted file phrase"], "stored.md", {
          type: "text/markdown",
        }),
      );
      const upload = await backend.handle(
        new Request(uploadUrl, { method: "POST", body: uploadForm }),
        uploadUrl,
      );
      const uploaded = (await upload?.json()) as Record<string, unknown>;
      expect(uploaded).toEqual(
        expect.objectContaining({
          file_name: "stored.md",
          file_kind: "blob",
        }),
      );

      const conversationUuid = "00000000-0000-4000-8000-000000000301";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Read both files",
            attachments: [attachment],
            files: [uploaded.file_uuid],
            create_conversation_params: {
              uuid: conversationUuid,
              model: "attachment-model",
            },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000302",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000303",
            },
          }),
        }),
        completionUrl,
      );
      expect(await completion?.text()).toContain("Attachment received");

      const messages = providerRequests[0].messages as Array<{
        role: string;
        content: string;
      }>;
      expect(messages.at(-1)?.content).toContain(
        "local attachment proof phrase",
      );
      expect(messages.at(-1)?.content).toContain(
        "second persisted file phrase",
      );

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        files: unknown[];
        conversations: Array<{
          chat_messages: Array<{
            attachments: unknown[];
            files: unknown[];
          }>;
        }>;
      };
      expect(stored.files).toHaveLength(1);
      expect(stored.conversations[0].chat_messages[0].attachments).toHaveLength(
        1,
      );
      expect(stored.conversations[0].chat_messages[0].files).toHaveLength(1);
      expect(
        await readFile(
          path.join(directory, "local-files", String(uploaded.file_uuid)),
          "utf8",
        ),
      ).toBe("second persisted file phrase");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
