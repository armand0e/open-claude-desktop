import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("persists native account profile and settings changes locally", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "local-account-"));
    temporaryDirectories.push(directory);
    const backend = await LocalBackend.create(directory);

    await backend.updateAccountProfile({
      full_name: "Local Person",
      display_name: "Local",
      conversation_preferences: "Keep answers concise.",
    });
    await backend.updateAccountSettings({
      theme: "dark",
      chat_font: "anthropic-serif",
    });

    const reopened = await LocalBackend.create(directory);
    expect(reopened.accountProfile()).toEqual(
      expect.objectContaining({
        full_name: "Local Person",
        display_name: "Local",
        conversation_preferences: "Keep answers concise.",
      }),
    );
    expect(reopened.accountSettings()).toEqual(
      expect.objectContaining({ theme: "dark", chat_font: "anthropic-serif" }),
    );
  });

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
            enableThinking: true,
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
            body: JSON.stringify({
              uuid: conversationUuid,
              name: "",
              model: "stale-ui-model",
            }),
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
          extra_body: { enable_thinking: true },
          chat_template_kwargs: { enable_thinking: true },
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
            expect.objectContaining({
              role: "system",
              content: expect.stringMatching(
                /Current local date and time:[\s\S]+Current UTC date and time:[\s\S]+Local timezone:/,
              ),
            }),
            { role: "user", content: "Say hello" },
          ],
        }),
      );

      await backend.handle(
        new Request("app://localhost/api/local/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "replacement-model",
            enableThinking: false,
          }),
        }),
        new URL("app://localhost/api/local/config"),
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
          model: "replacement-model",
          stream: true,
          extra_body: { enable_thinking: false },
          chat_template_kwargs: { enable_thinking: false },
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
          model: "replacement-model",
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

  it("returns provider setup failures as retryable Chat request errors", async () => {
    const server = createServer(async (request, response) => {
      for await (const _chunk of request) {
        // Consume the request before returning the intentional failure.
      }
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ error: { message: "provider unavailable" } }),
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider error test address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-backend-error-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      await backend.handle(
        new Request("app://localhost/api/local/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "error-model",
          }),
        }),
        new URL("app://localhost/api/local/config"),
      );
      const conversationUuid = "00000000-0000-4000-8000-000000000108";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Retry this message",
            create_conversation_params: { uuid: conversationUuid },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000109",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000110",
            },
          }),
        }),
        completionUrl,
      );
      expect(completion?.status).toBe(502);
      expect(await completion?.json()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "api_error",
            message: expect.stringContaining("Provider returned HTTP 503"),
          }),
        }),
      );

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        conversations: Array<{ chat_messages: Array<{ sender: string }> }>;
      };
      expect(stored.conversations[0].chat_messages).toEqual([
        expect.objectContaining({ sender: "human" }),
      ]);

      const retriedCompletion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Retry this message",
            parent_message_uuid: "00000000-0000-4000-8000-000000000109",
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000111",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000112",
            },
          }),
        }),
        completionUrl,
      );
      expect(retriedCompletion?.status).toBe(502);
      const retriedStored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        conversations: Array<{ chat_messages: Array<{ sender: string }> }>;
      };
      expect(retriedStored.conversations[0].chat_messages).toEqual([
        expect.objectContaining({ sender: "human" }),
      ]);
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
      expect(events).toContain('"type":"thinking"');
      expect(events).toContain(
        '"type":"thinking_delta","thinking":"Planning silently."',
      );
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
      ).toEqual([
        expect.objectContaining({ thinking: "Planning silently." }),
        expect.objectContaining({ thinking: "Planning silently." }),
      ]);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("routes configured content-stream thinking tags into native Chat reasoning", async () => {
    const server = createServer(async (_request, response) => {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const content of [
        "<|channel|>ana",
        "lysisPlan privately.",
        "<|channel|>fi",
        "nalAnswer visibly.",
      ])
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
        throw new Error("Missing tagged-reasoning provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-backend-thinking-tags-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory);
      const configUrl = new URL("app://localhost/api/local/config");
      const configured = await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "tagged-reasoning-chat-model",
            thinkingStartTag: "<|channel|>analysis",
            thinkingEndTag: "<|channel|>final",
          }),
        }),
        configUrl,
      );
      expect(configured?.status).toBe(200);

      const conversationUuid = "00000000-0000-4000-8000-000000000181";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Use channel markers",
            create_conversation_params: {
              uuid: conversationUuid,
              model: "stale-ui-model",
            },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000182",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000183",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();
      expect(events).toContain('"type":"thinking_delta"');
      expect(events).toContain('"thinking":"Plan privately."');
      expect(events).toContain('"type":"text_delta"');
      expect(events).toContain('"text":"Answer visibly."');
      expect(events).not.toContain("<|channel|>");

      const reopened = await LocalBackend.create(directory);
      expect(reopened.provider()).toEqual(
        expect.objectContaining({
          thinkingStartTag: "<|channel|>analysis",
          thinkingEndTag: "<|channel|>final",
        }),
      );
      const treeUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}?tree=True&rendering_mode=messages`,
      );
      const tree = await reopened.handle(new Request(treeUrl), treeUrl);
      const conversation = (await tree?.json()) as {
        chat_messages: Array<{
          sender: string;
          text: string;
          content: Array<{ type: string; thinking?: string; text?: string }>;
        }>;
      };
      expect(conversation.chat_messages.at(-1)).toEqual(
        expect.objectContaining({
          sender: "assistant",
          text: "Answer visibly.",
          content: [
            expect.objectContaining({
              type: "thinking",
              thinking: "Plan privately.",
            }),
            expect.objectContaining({ type: "text", text: "Answer visibly." }),
          ],
        }),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("streams and persists native web-tool activity in Chat", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    let providerTimeoutSpy: { mockRestore: () => void } | undefined;
    const webCalls: Array<{ name: string; input: Record<string, unknown> }> =
      [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      if (providerRequests.length === 1) {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Checking current sources. " } }] })}\n\n`,
        );
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_web_1",
                      function: {
                        name: "web_search",
                        arguments: JSON.stringify({ query: "runtime proof" }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        );
      } else {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "The live source confirms the runtime proof." } }] })}\n\n`,
        );
      }
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing web provider test address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-web-chat-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory, {
        async execute(name, input) {
          webCalls.push({ name, input });
          return JSON.stringify({
            success: true,
            results: [
              {
                title: "Runtime proof source",
                url: "https://example.com/runtime-proof",
                snippet: "A deterministic local test source.",
              },
            ],
            searched_on: "2026-07-16",
          });
        },
      });
      const configUrl = new URL("app://localhost/api/local/config");
      await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "web-test-model",
          }),
        }),
        configUrl,
      );

      const conversationUuid = "00000000-0000-4000-8000-000000000191";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      providerTimeoutSpy = vi.spyOn(AbortSignal, "timeout");
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Find current runtime proof",
            create_conversation_params: { uuid: conversationUuid },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000192",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000193",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();

      expect(providerTimeoutSpy).not.toHaveBeenCalled();
      expect(providerRequests).toHaveLength(2);
      expect(webCalls).toEqual([
        { name: "web_search", input: { query: "runtime proof" } },
      ]);
      expect(events).toContain('"type":"tool_use"');
      expect(events).toContain('"name":"web_search"');
      expect(events).toContain('\\"query\\":\\"runtime proof\\"');
      expect(events).toContain('"type":"tool_result"');
      expect(events).toContain('"title":"Runtime proof source"');
      expect(events).toContain('"url":"https://example.com/runtime-proof"');
      expect(events).toContain("The live source confirms the runtime proof.");
      expect(events).toContain('"stop_reason":"end_turn"');

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        conversations: Array<{
          chat_messages: Array<{
            sender: string;
            content: Array<Record<string, unknown>>;
          }>;
        }>;
      };
      const assistant = stored.conversations[0].chat_messages.find(
        (message) => message.sender === "assistant",
      );
      expect(assistant?.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "tool_use",
            name: "web_search",
            input: { query: "runtime proof" },
          }),
          expect.objectContaining({
            type: "tool_result",
            name: "web_search",
            content: [
              expect.objectContaining({
                type: "knowledge",
                title: "Runtime proof source",
                url: "https://example.com/runtime-proof",
              }),
            ],
          }),
        ]),
      );
    } finally {
      providerTimeoutSpy?.mockRestore();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("removes and fail-closes web tools when Web search is disabled", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    const webCalls: Array<{ name: string; input: Record<string, unknown> }> =
      [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      if (providerRequests.length === 1) {
        // Prove the execution boundary is fail-closed even when a provider
        // hallucinates a call that was not included in the request schema.
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_disabled_web",
                      function: {
                        name: "web_search",
                        arguments: JSON.stringify({ query: "must not run" }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        );
      } else {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "I cannot verify that live while Web search is disabled." } }] })}\n\n`,
        );
      }
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );

    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing disabled-web provider test address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-disabled-web-chat-"),
      );
      temporaryDirectories.push(directory);
      const backend = await LocalBackend.create(directory, {
        async execute(name, input) {
          webCalls.push({ name, input });
          return "This must never be returned";
        },
      });
      const configUrl = new URL("app://localhost/api/local/config");
      await backend.handle(
        new Request(configUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl: `http://127.0.0.1:${address.port}/v1`,
            model: "disabled-web-test-model",
          }),
        }),
        configUrl,
      );
      await backend.updateAccountSettings({ enabled_web_search: false });

      const conversationUuid = "00000000-0000-4000-8000-000000000194";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "What happened today?",
            // Model the retained new-chat race: the saved account toggle is
            // already off while the composer still submits its old value.
            enabled_web_search: true,
            create_conversation_params: {
              uuid: conversationUuid,
              enabled_web_search: true,
            },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000195",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000196",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();

      expect(providerRequests).toHaveLength(2);
      for (const providerRequest of providerRequests) {
        const tools = providerRequest.tools as Array<{
          function?: { name?: string };
        }>;
        expect(tools.map((tool) => tool.function?.name)).toEqual([
          "artifacts",
          "skill",
        ]);
        expect(providerRequest.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining(
                "Web search is disabled for this conversation",
              ),
            }),
          ]),
        );
      }
      expect(webCalls).toEqual([]);
      expect(events).not.toContain('"name":"web_search"');
      expect(events).toContain(
        "I cannot verify that live while Web search is disabled.",
      );

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      ) as {
        conversations: Array<{ settings: Record<string, unknown> }>;
      };
      expect(stored.conversations[0].settings.enabled_web_search).toBe(false);
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
      // The artifacts tool_use block streams the provider's raw argument
      // fragments as they arrive (live generating card), so the content
      // spans two input_json_delta events.
      expect(events).toContain("<h1>Hello ");
      expect(events).toContain("artifact</h1>");
      expect(events).toContain('"stop_reason":"tool_use"');
      expect(events).toContain('"type":"thinking"');
      expect(events).toContain(
        '"type":"thinking_delta","thinking":"Planning the artifact."',
      );

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
      expect(revisionEvents).toContain('"type":"thinking"');

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
      expect(stored.conversations[0].chat_messages.at(-1)?.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "tool_use",
            name: "artifacts",
            input: expect.objectContaining({
              id: "local-demo",
              title: "Local demo",
              type: "text/html",
            }),
          }),
        ]),
      );
      expect(backend.artifactSummaries()).toEqual([
        expect.objectContaining({
          id: "local-demo",
          artifactUuid: stored.artifacts[0].uuid,
          title: "Local demo",
          sessionId: conversationUuid,
          sourceSurface: "chat",
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
      const conversationVersionsUrl = new URL(
        `app://localhost/api/organizations/org/artifacts/${conversationUuid}/versions`,
      );
      const conversationVersionsResponse = await backend.handle(
        new Request(conversationVersionsUrl),
        conversationVersionsUrl,
      );
      expect(await conversationVersionsResponse?.json()).toEqual({
        artifact_versions: [
          expect.objectContaining({
            result_state: "<h1>Hello artifact</h1>",
          }),
          expect.objectContaining({
            result_state: "<h1>Revised artifact</h1>",
          }),
        ],
      });

      const publishedVersionUuid = stored.artifacts[0].versions[1].uuid;
      const publishUrl = new URL(
        "app://localhost/api/organizations/org/publish_artifact",
      );
      const publish = await backend.handle(
        new Request(publishUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_uuid: conversationUuid,
            artifact_identifier: "local-demo",
            artifact_version_uuid: publishedVersionUuid,
            message_uuid: "00000000-0000-4000-8000-000000000205",
          }),
        }),
        publishUrl,
      );
      expect(await publish?.json()).toEqual({
        published_artifact_uuid: "local-demo",
        slug: "local-demo",
      });

      const repeatPublish = await backend.handle(
        new Request(publishUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifact_version_uuid: publishedVersionUuid,
          }),
        }),
        publishUrl,
      );
      expect(await repeatPublish?.json()).toEqual({
        published_artifact_uuid: "local-demo",
        slug: "local-demo",
      });

      const publicApiUrl = new URL(
        "app://localhost/api/published_artifacts/local-demo",
      );
      const publicJsonUrl = new URL(
        "app://localhost/public/artifacts/local-demo/json",
      );
      const publicApi = await backend.handle(
        new Request(publicApiUrl),
        publicApiUrl,
      );
      expect(await publicApi?.json()).toEqual(
        expect.objectContaining({
          title: "Local demo",
          type: "text/html",
          content: "<h1>Revised artifact</h1>",
          published_artifact_uuid: "local-demo",
        }),
      );

      const reopened = await LocalBackend.create(directory);
      const persistedPublicJson = await reopened.handle(
        new Request(publicJsonUrl),
        publicJsonUrl,
      );
      expect(await persistedPublicJson?.json()).toEqual(
        expect.objectContaining({
          content: "<h1>Revised artifact</h1>",
          published_artifact_uuid: "local-demo",
        }),
      );

      const userArtifactsUrl = new URL(
        "app://localhost/api/organizations/org/user_artifacts",
      );
      const userArtifacts = await reopened.handle(
        new Request(userArtifactsUrl),
        userArtifactsUrl,
      );
      expect(await userArtifacts?.json()).toEqual({
        artifacts: [
          expect.objectContaining({
            latest_published_artifact_uuid: "local-demo",
          }),
        ],
      });
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

  it("materializes inline artifact tags when a provider rejects function tools", async () => {
    const providerRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const parsed = JSON.parse(body) as Record<string, unknown>;
      providerRequests.push(parsed);
      if (Array.isArray(parsed.tools)) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({ error: { message: "tools unsupported" } }),
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                content:
                  '<antArtifact identifier="fallback-demo" type="text/html" title="Fallback demo"><h1>Fallback artifact</h1></antArtifact>',
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
        throw new Error("Missing fallback artifact provider address");
      const directory = await mkdtemp(
        path.join(os.tmpdir(), "local-artifact-fallback-"),
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
            model: "fallback-artifact-model",
          }),
        }),
        configUrl,
      );
      const conversationUuid = "00000000-0000-4000-8000-000000000211";
      const completionUrl = new URL(
        `app://localhost/api/organizations/org/chat_conversations/${conversationUuid}/completion`,
      );
      const completion = await backend.handle(
        new Request(completionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Build an artifact without function tools",
            create_conversation_params: { uuid: conversationUuid },
            turn_message_uuids: {
              human_message_uuid: "00000000-0000-4000-8000-000000000212",
              assistant_message_uuid: "00000000-0000-4000-8000-000000000213",
            },
          }),
        }),
        completionUrl,
      );
      const events = await completion?.text();
      expect(events).toContain('"name":"artifacts"');
      expect(events).toContain("Fallback demo");

      const stored = JSON.parse(
        await readFile(path.join(directory, "local-backend.json"), "utf8"),
      );
      expect(stored.artifacts).toEqual([
        expect.objectContaining({
          artifact_identifier: "fallback-demo",
          title: "Fallback demo",
          versions: [
            expect.objectContaining({
              content: "<h1>Fallback artifact</h1>",
            }),
          ],
        }),
      ]);
      expect(providerRequests).toHaveLength(2);
      expect(providerRequests[0].tools).toBeDefined();
      expect(providerRequests[1].tools).toBeUndefined();
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
