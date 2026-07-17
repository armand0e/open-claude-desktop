import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const MOCK_MODEL = "mock-stream-model";
export const MOCK_REASONING = "I should verify the native reasoning surface.";
export const MOCK_ASSISTANT_TEXT =
  "I’ll create Local Artifact Demo now. The streamed artifact is ready.";
export const MOCK_ARTIFACT = {
  command: "create",
  id: "local-artifact-smoke",
  title: "Local Artifact Demo",
  type: "text/html",
  content:
    "<!doctype html><html><body><h1>Local Artifact Demo</h1><p>Reasoning, text, and a fragmented tool call arrived in one stream.</p></body></html>",
};

function json(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

async function requestJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sse(response, value) {
  response.write(`data: ${JSON.stringify(value)}\n\n`);
}

function delta(value, finishReason = null) {
  return {
    id: "chatcmpl_mock_mixed_stream",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: MOCK_MODEL,
    choices: [{ index: 0, delta: value, finish_reason: finishReason }],
  };
}

function requestSummary(body) {
  return {
    model: body.model,
    stream: body.stream,
    messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    messages: Array.isArray(body.messages)
      ? body.messages.map((message) => ({
          role: message?.role,
          name: message?.name,
          toolCallId: message?.tool_call_id,
          contentLength:
            typeof message?.content === "string" ? message.content.length : 0,
          content:
            typeof message?.content === "string"
              ? message.content.slice(0, 500)
              : message?.content,
          toolCalls: message?.tool_calls,
        }))
      : [],
    toolNames: Array.isArray(body.tools)
      ? body.tools
          .map((tool) => tool?.function?.name)
          .filter((name) => typeof name === "string")
      : [],
    toolChoice: body.tool_choice,
    reasoningEffort: body.reasoning_effort,
    chatTemplateKwargs: body.chat_template_kwargs,
  };
}

export function createMockOpenAiHandler({
  requests = [],
  delayMs = 90,
  log = null,
} = {}) {
  const pause = () =>
    delayMs > 0
      ? new Promise((resolve) => setTimeout(resolve, delayMs))
      : Promise.resolve();

  return async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { ok: true, model: MOCK_MODEL });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/models") {
      json(response, 200, {
        object: "list",
        data: [
          {
            id: MOCK_MODEL,
            object: "model",
            context_length: 128_000,
          },
        ],
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/debug/requests") {
      json(response, 200, { requests });
      return;
    }
    if (request.method === "DELETE" && url.pathname === "/debug/requests") {
      requests.splice(0, requests.length);
      json(response, 200, { ok: true });
      return;
    }
    if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
      json(response, 404, { error: { message: "Route not found" } });
      return;
    }

    let body;
    try {
      body = await requestJson(request);
    } catch (error) {
      json(response, 400, {
        error: {
          message: error instanceof Error ? error.message : "Invalid JSON body",
        },
      });
      return;
    }
    requests.push(body);
    log?.(requestSummary(body));

    const toolCall = {
      id: "call_mock_mixed_stream",
      type: "function",
      function: {
        name: "artifacts",
        arguments: JSON.stringify(MOCK_ARTIFACT),
      },
    };
    if (body.stream !== true) {
      json(response, 200, {
        id: "chatcmpl_mock_mixed_stream",
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: MOCK_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: "tool_calls",
            message: {
              role: "assistant",
              reasoning_content: MOCK_REASONING,
              content: MOCK_ASSISTANT_TEXT,
              tool_calls: [toolCall],
            },
          },
        ],
        usage: { prompt_tokens: 64, completion_tokens: 48, total_tokens: 112 },
      });
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders?.();

    sse(response, delta({ role: "assistant" }));
    await pause();
    sse(response, delta({ reasoning_content: MOCK_REASONING.slice(0, 20) }));
    await pause();
    sse(response, delta({ reasoning_content: MOCK_REASONING.slice(20) }));
    await pause();
    sse(response, delta({ content: MOCK_ASSISTANT_TEXT.slice(0, 22) }));
    await pause();
    sse(response, delta({ content: MOCK_ASSISTANT_TEXT.slice(22, 38) }));
    await pause();

    const argumentsJson = toolCall.function.arguments;
    const firstSplit = Math.floor(argumentsJson.length / 3);
    const secondSplit = Math.floor((argumentsJson.length * 2) / 3);
    sse(
      response,
      delta({
        tool_calls: [
          {
            index: 0,
            id: toolCall.id,
            type: "function",
            function: {
              name: "arti",
              arguments: argumentsJson.slice(0, firstSplit),
            },
          },
        ],
      }),
    );
    await pause();
    sse(
      response,
      delta({
        tool_calls: [
          {
            index: 0,
            function: {
              name: "facts",
              arguments: argumentsJson.slice(firstSplit, secondSplit),
            },
          },
        ],
      }),
    );
    await pause();
    sse(
      response,
      delta({
        tool_calls: [
          {
            index: 0,
            function: { arguments: argumentsJson.slice(secondSplit) },
          },
        ],
      }),
    );
    await pause();
    sse(response, delta({ content: MOCK_ASSISTANT_TEXT.slice(38) }));
    await pause();
    sse(response, delta({}, "tool_calls"));
    response.end("data: [DONE]\n\n");
  };
}

export async function startMockOpenAiServer({
  host = "127.0.0.1",
  port = 1235,
  delayMs = 90,
  log = null,
} = {}) {
  const requests = [];
  const server = createServer(
    createMockOpenAiHandler({ requests, delayMs, log }),
  );
  await new Promise((resolve, reject) =>
    server.listen(port, host, resolve).once("error", reject),
  );
  const address = server.address();
  const actualPort =
    address && typeof address === "object" ? address.port : Number(port);
  return {
    server,
    requests,
    baseUrl: `http://${host}:${actualPort}/v1`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const host = option("--host", process.env.MOCK_OPENAI_HOST || "127.0.0.1");
  const port = Number(option("--port", process.env.MOCK_OPENAI_PORT || "1235"));
  const delayMs = Number(
    option("--delay-ms", process.env.MOCK_OPENAI_DELAY_MS || "90"),
  );
  const runtime = await startMockOpenAiServer({
    host,
    port,
    delayMs,
    log: (summary) =>
      process.stdout.write(
        `[mock-openai] request ${JSON.stringify(summary)}\n`,
      ),
  });
  process.stdout.write(
    `[mock-openai] listening on ${runtime.baseUrl} with model ${MOCK_MODEL}\n`,
  );
  const shutdown = async () => {
    await runtime.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
