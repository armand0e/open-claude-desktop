import { readResponseJson } from "./bounded-response";

type JsonObject = Record<string, unknown>;
const MAX_PROVIDER_RESPONSE_BYTES = 16 * 1024 * 1024;

export type ProviderTransport = "openai-chat" | "anthropic-messages";

export interface ProviderTransportConfig {
  preset?: string;
  transport?: ProviderTransport;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((entry) => {
      const block = objectValue(entry);
      return block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [];
    })
    .join("");
}

export function resolvedProviderTransport(
  provider: Pick<ProviderTransportConfig, "preset" | "transport">,
): ProviderTransport {
  if (
    provider.transport === "openai-chat" ||
    provider.transport === "anthropic-messages"
  )
    return provider.transport;
  return provider.preset === "claude-code"
    ? "anthropic-messages"
    : "openai-chat";
}

export function providerEndpoint(
  provider: ProviderTransportConfig,
  resource: "completion" | "models" = "completion",
): string {
  const root = provider.baseUrl.replace(/\/+$/, "");
  if (resource === "models") return `${root}/models`;
  return resolvedProviderTransport(provider) === "anthropic-messages"
    ? `${root}/messages`
    : `${root}/chat/completions`;
}

export function providerHeaders(
  provider: ProviderTransportConfig,
  stream = false,
): Record<string, string> {
  if (resolvedProviderTransport(provider) === "anthropic-messages")
    return {
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
      "anthropic-version": "2023-06-01",
      ...(provider.apiKey ? { "x-api-key": provider.apiKey } : {}),
    };
  return {
    "Content-Type": "application/json",
    ...(stream ? { Accept: "text/event-stream" } : {}),
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
  };
}

export function openAiToAnthropicRequest(input: JsonObject): JsonObject {
  const system: string[] = [];
  const messages: JsonObject[] = [];
  for (const rawMessage of Array.isArray(input.messages)
    ? input.messages
    : []) {
    const message = objectValue(rawMessage);
    const role = String(message.role ?? "");
    if (role === "system") {
      const text = textValue(message.content);
      if (text) system.push(text);
      continue;
    }
    if (role === "tool") {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: String(message.tool_call_id ?? ""),
            content: textValue(message.content),
          },
        ],
      });
      continue;
    }
    if (role !== "user" && role !== "assistant") continue;
    const content: JsonObject[] = [];
    const text = textValue(message.content);
    if (text) content.push({ type: "text", text });
    if (role === "assistant" && Array.isArray(message.tool_calls))
      for (const rawToolCall of message.tool_calls) {
        const toolCall = objectValue(rawToolCall);
        const fn = objectValue(toolCall.function);
        let inputValue: unknown = {};
        try {
          inputValue = JSON.parse(String(fn.arguments ?? "{}"));
        } catch {
          inputValue = {};
        }
        content.push({
          type: "tool_use",
          id: String(toolCall.id ?? ""),
          name: String(fn.name ?? ""),
          input: objectValue(inputValue),
        });
      }
    messages.push({ role, content: content.length ? content : "" });
  }
  const tools = Array.isArray(input.tools)
    ? input.tools.flatMap((rawTool) => {
        const fn = objectValue(objectValue(rawTool).function);
        const name = typeof fn.name === "string" ? fn.name : "";
        if (!name) return [];
        return [
          {
            name,
            ...(typeof fn.description === "string"
              ? { description: fn.description }
              : {}),
            input_schema: objectValue(fn.parameters),
          },
        ];
      })
    : [];
  return {
    model: input.model,
    max_tokens: typeof input.max_tokens === "number" ? input.max_tokens : 8_192,
    stream: input.stream === true,
    ...(system.length ? { system: system.join("\n\n") } : {}),
    messages,
    ...(tools.length ? { tools, tool_choice: { type: "auto" } } : {}),
  };
}

function anthropicToOpenAiResponse(value: JsonObject): JsonObject {
  const content = Array.isArray(value.content) ? value.content : [];
  const text = content
    .flatMap((entry) => {
      const block = objectValue(entry);
      return block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [];
    })
    .join("");
  const toolCalls = content.flatMap((entry) => {
    const block = objectValue(entry);
    if (block.type !== "tool_use") return [];
    return [
      {
        id: String(block.id ?? ""),
        type: "function",
        function: {
          name: String(block.name ?? ""),
          arguments: JSON.stringify(objectValue(block.input)),
        },
      },
    ];
  });
  return {
    id: value.id,
    model: value.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        },
        finish_reason:
          value.stop_reason === "tool_use"
            ? "tool_calls"
            : value.stop_reason === "max_tokens"
              ? "length"
              : "stop",
      },
    ],
    usage: objectValue(value.usage),
  };
}

function openAiSseChunk(
  delta: JsonObject,
  finishReason?: string,
  usage?: unknown,
) {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason ?? null }], ...(usage ? { usage } : {}) })}\n\n`;
}

function adaptAnthropicStream(response: Response): Response {
  if (!response.body || !response.ok) return response;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const toolIndices = new Map<number, number>();
  let nextToolIndex = 0;
  let buffer = "";
  let usage: JsonObject = {};
  let receivedBytes = 0;
  let cancelled = false;
  let streamEnded = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (text: string) => controller.enqueue(encoder.encode(text));
      const processEvent = (raw: string) => {
        if (streamEnded) return;
        const data = raw
          .split(/\r?\n/u)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!data) return;
        const event = objectValue(JSON.parse(data));
        if (event.type === "message_start") {
          usage = objectValue(objectValue(event.message).usage);
          return;
        }
        if (event.type === "error") {
          streamEnded = true;
          emit(
            `data: ${JSON.stringify({ error: objectValue(event.error) })}\n\n`,
          );
          return;
        }
        if (event.type === "content_block_start") {
          const block = objectValue(event.content_block);
          if (block.type !== "tool_use") return;
          const blockIndex = Number(event.index ?? 0);
          const toolIndex = nextToolIndex++;
          toolIndices.set(blockIndex, toolIndex);
          emit(
            openAiSseChunk({
              tool_calls: [
                {
                  index: toolIndex,
                  id: String(block.id ?? ""),
                  type: "function",
                  function: { name: String(block.name ?? ""), arguments: "" },
                },
              ],
            }),
          );
          return;
        }
        if (event.type === "content_block_delta") {
          const delta = objectValue(event.delta);
          if (delta.type === "text_delta" && typeof delta.text === "string")
            emit(openAiSseChunk({ content: delta.text }));
          else if (
            delta.type === "thinking_delta" &&
            typeof delta.thinking === "string"
          )
            emit(openAiSseChunk({ reasoning_content: delta.thinking }));
          else if (
            delta.type === "input_json_delta" &&
            typeof delta.partial_json === "string"
          ) {
            const toolIndex = toolIndices.get(Number(event.index ?? 0));
            if (toolIndex !== undefined)
              emit(
                openAiSseChunk({
                  tool_calls: [
                    {
                      index: toolIndex,
                      function: { arguments: delta.partial_json },
                    },
                  ],
                }),
              );
          }
          return;
        }
        if (event.type === "message_delta") {
          const delta = objectValue(event.delta);
          usage = { ...usage, ...objectValue(event.usage) };
          emit(
            openAiSseChunk(
              {},
              delta.stop_reason === "tool_use"
                ? "tool_calls"
                : delta.stop_reason === "max_tokens"
                  ? "length"
                  : "stop",
              usage,
            ),
          );
        } else if (event.type === "message_stop") {
          streamEnded = true;
          emit("data: [DONE]\n\n");
        }
      };
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (cancelled) return;
          receivedBytes += value?.byteLength ?? 0;
          if (receivedBytes > MAX_PROVIDER_RESPONSE_BYTES)
            throw new Error(
              "Anthropic response exceeded the 16 MiB safety limit",
            );
          buffer += decoder.decode(value, { stream: !done });
          const events = buffer.split(/\r?\n\r?\n/u);
          buffer = events.pop() ?? "";
          for (const event of events) processEvent(event);
          if (done || streamEnded) break;
        }
        if (buffer.trim()) processEvent(buffer);
        controller.close();
      } catch (error) {
        if (!cancelled) controller.error(error);
        void reader.cancel(error).catch(() => undefined);
      } finally {
        if (streamEnded) void reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    },
    cancel(reason) {
      cancelled = true;
      return reader.cancel(reason);
    },
  });
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "text/event-stream");
  // The normalized body no longer has the upstream wire length or encoding.
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function fetchProviderCompletion(
  provider: ProviderTransportConfig,
  input: JsonObject,
  signal?: AbortSignal,
): Promise<Response> {
  const anthropic =
    resolvedProviderTransport(provider) === "anthropic-messages";
  const stream = input.stream === true;
  const response = await fetch(providerEndpoint(provider), {
    method: "POST",
    signal,
    headers: providerHeaders(provider, stream),
    body: JSON.stringify(anthropic ? openAiToAnthropicRequest(input) : input),
  });
  if (!anthropic || !response.ok) return response;
  if (
    response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("text/event-stream")
  )
    return adaptAnthropicStream(response);
  const payload = objectValue(
    await readResponseJson(
      response,
      MAX_PROVIDER_RESPONSE_BYTES,
      "Anthropic response",
    ),
  );
  return new Response(JSON.stringify(anthropicToOpenAiResponse(payload)), {
    status: response.status,
    statusText: response.statusText,
    headers: { "Content-Type": "application/json" },
  });
}
