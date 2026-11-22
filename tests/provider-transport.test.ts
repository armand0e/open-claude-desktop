import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchProviderCompletion,
  openAiToAnthropicRequest,
  providerEndpoint,
} from "../src/main/provider-transport";

afterEach(() => vi.unstubAllGlobals());

describe("provider transports", () => {
  const anthropic = {
    preset: "claude-code",
    transport: "anthropic-messages" as const,
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-opus-5",
    apiKey: "anthropic-secret",
  };

  it("uses the native Anthropic endpoint and request contract", () => {
    expect(providerEndpoint(anthropic)).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(
      openAiToAnthropicRequest({
        model: anthropic.model,
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "hello" },
          {
            role: "assistant",
            tool_calls: [
              {
                id: "tool-1",
                function: { name: "Read", arguments: '{"file":"a"}' },
              },
            ],
          },
          { role: "tool", tool_call_id: "tool-1", content: "done" },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "Read",
              description: "Read a file",
              parameters: { type: "object" },
            },
          },
        ],
      }),
    ).toMatchObject({
      model: "claude-opus-5",
      system: "system",
      messages: [
        { role: "user", content: [{ type: "text", text: "hello" }] },
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Read",
              input: { file: "a" },
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "tool-1", content: "done" },
          ],
        },
      ],
      tools: [
        {
          name: "Read",
          description: "Read a file",
          input_schema: { type: "object" },
        },
      ],
    });
  });

  it("normalizes Anthropic streaming text and tool deltas for the agent loop", async () => {
    let request: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        request = init;
        const events = [
          {
            type: "message_start",
            message: {
              usage: { input_tokens: 4, cache_read_input_tokens: 100 },
            },
          },
          {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "hello" },
          },
          {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", id: "t1", name: "Read" },
          },
          {
            type: "content_block_delta",
            index: 1,
            delta: { type: "input_json_delta", partial_json: '{"file":"a"}' },
          },
          {
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
            usage: { output_tokens: 9 },
          },
          { type: "message_stop" },
        ]
          .map(
            (event) =>
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          )
          .join("");
        return new Response(events, {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    const response = await fetchProviderCompletion(anthropic, {
      model: anthropic.model,
      stream: true,
      messages: [{ role: "user", content: "hello" }],
    });
    const stream = await response.text();
    expect(stream).toContain('"content":"hello"');
    expect(stream).toContain('"name":"Read"');
    expect(stream).toContain('"arguments":"{\\"file\\":\\"a\\"}"');
    expect(stream).toContain('"finish_reason":"tool_calls"');
    expect(stream).toContain(
      '"usage":{"input_tokens":4,"cache_read_input_tokens":100,"output_tokens":9}',
    );
    expect(stream).toContain("data: [DONE]");
    expect(request?.headers).toMatchObject({
      "anthropic-version": "2023-06-01",
      "x-api-key": "anthropic-secret",
    });
    expect(JSON.parse(String(request?.body))).not.toHaveProperty(
      "stream_options",
    );
  });

  it("accepts a JSON completion when the provider ignores the stream flag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "message-1",
              content: [{ type: "text", text: "Visible answer" }],
              stop_reason: "end_turn",
              usage: { input_tokens: 12, output_tokens: 3 },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const response = await fetchProviderCompletion(anthropic, {
      model: anthropic.model,
      stream: true,
      messages: [],
    });
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toMatchObject({
      choices: [{ message: { content: "Visible answer" } }],
      usage: { input_tokens: 12, output_tokens: 3 },
    });
  });

  it("cancels the upstream body after malformed streaming data", async () => {
    const cancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {broken}\n\n"));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(upstream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
      ),
    );
    const response = await fetchProviderCompletion(anthropic, { stream: true });
    await expect(response.text()).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
    expect(upstream.locked).toBe(false);
  });

  it("bounds native responses before translating them", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new ReadableStream({ cancel }), {
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(17 * 1024 * 1024),
            },
          }),
      ),
    );
    await expect(fetchProviderCompletion(anthropic, {})).rejects.toThrow(
      /exceeded/,
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("closes a native stream at message_stop and releases upstream resources", async () => {
    const cancel = vi.fn();
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"type":"message_stop"}\n\n'),
        );
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(upstream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Content-Length": "999",
            },
          }),
      ),
    );
    const response = await fetchProviderCompletion(anthropic, { stream: true });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.has("content-length")).toBe(false);
    await expect(response.text()).resolves.toBe("data: [DONE]\n\n");
    expect(cancel).toHaveBeenCalledOnce();
    expect(upstream.locked).toBe(false);
  });

  it("keeps OpenAI-compatible providers on chat completions", async () => {
    const called: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        called.push(url);
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    await fetchProviderCompletion(
      {
        preset: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "model",
      },
      { model: "model", messages: [] },
    );
    expect(called).toEqual(["https://openrouter.ai/api/v1/chat/completions"]);
  });
});
