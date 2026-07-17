import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COMPACTION_TAIL_RATIO,
  COMPACTION_TRIGGER_RATIO,
  compactionSummaryText,
  compactionTranscript,
  estimateMessageTokens,
  estimateTokens,
  planCompaction,
  summarizeForCompaction,
} from "../src/main/context-compaction";

function message(role: string, characters: number): Record<string, unknown> {
  return { role, content: "x".repeat(characters) };
}

describe("planCompaction", () => {
  it("does not trigger below the threshold", () => {
    const window = 8_192;
    const messages = [message("user", 1_000), message("assistant", 1_000)];
    expect(planCompaction(500, messages, window)).toBeNull();
  });

  it("folds the oldest messages and keeps a bounded tail", () => {
    const window = 8_192;
    const perMessageChars = 2_000;
    const messages = Array.from({ length: 20 }, (_, index) =>
      message(index % 2 === 0 ? "user" : "assistant", perMessageChars),
    );
    const plan = planCompaction(500, messages, window);
    expect(plan).not.toBeNull();
    expect(plan!.prefixLength).toBeGreaterThanOrEqual(2);
    expect(plan!.prefixLength).toBeLessThan(messages.length);
    const tail = messages.slice(plan!.prefixLength);
    const tailTokens = tail.reduce(
      (sum, entry) => sum + estimateMessageTokens(entry),
      0,
    );
    // The verbatim tail must fit the post-compaction budget, with at least
    // the two newest messages always retained.
    expect(tail.length).toBeGreaterThanOrEqual(2);
    expect(tailTokens).toBeLessThanOrEqual(
      window * COMPACTION_TAIL_RATIO + estimateMessageTokens(tail[0]),
    );
    expect(plan!.totalTokens).toBeGreaterThan(
      window * COMPACTION_TRIGGER_RATIO,
    );
  });

  it("refuses to fold when almost everything is in the tail", () => {
    const window = 8_192;
    // One giant newest message: folding a single older message is pointless.
    const messages = [message("user", 200), message("assistant", 40_000)];
    expect(planCompaction(0, messages, window)).toBeNull();
  });
});

describe("estimates", () => {
  it("estimates tokens from characters", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("includes tool calls in message estimates", () => {
    const plain = estimateMessageTokens({ role: "assistant", content: "hi" });
    const withTools = estimateMessageTokens({
      role: "assistant",
      content: "hi",
      tool_calls: [{ id: "call_1", function: { name: "Bash" } }],
    });
    expect(withTools).toBeGreaterThan(plain);
  });
});

describe("compactionTranscript", () => {
  it("flattens roles, content, and tool calls", () => {
    const transcript = compactionTranscript([
      { role: "user", content: "first request" },
      {
        role: "assistant",
        content: "done",
        tool_calls: [{ function: { name: "Read" } }],
      },
    ]);
    expect(transcript).toContain("[user]\nfirst request");
    expect(transcript).toContain("[assistant]\ndone");
    expect(transcript).toContain('"Read"');
  });

  it("cuts the middle of an oversized transcript", () => {
    const transcript = compactionTranscript([
      { role: "user", content: "start-marker" + "x".repeat(200_000) },
      { role: "assistant", content: "y".repeat(200_000) + "end-marker" },
    ]);
    expect(transcript.length).toBeLessThan(200_000);
    expect(transcript).toContain("start-marker");
    expect(transcript).toContain("end-marker");
    expect(transcript).toContain("middle of the transcript omitted");
  });
});

describe("summarizeForCompaction", () => {
  let server: Server;
  let baseUrl: string;
  const requests: Array<Record<string, unknown>> = [];
  let nextResponse: () => { status: number; body: unknown };

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      requests.push(JSON.parse(body));
      const { status, body: payload } = nextResponse();
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}/v1`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("summarizes through the provider and strips thinking blocks", async () => {
    nextResponse = () => ({
      status: 200,
      body: {
        choices: [
          {
            message: {
              content:
                "<think>internal deliberation</think>  The user is porting an app.",
            },
          },
        ],
      },
    });
    const summary = await summarizeForCompaction(
      { baseUrl, model: "summary-model", apiKey: "secret-key" },
      [
        { role: "user", content: "port this app" },
        { role: "assistant", content: "working on it" },
      ],
    );
    expect(summary).toBe("The user is porting an app.");
    const request = requests.at(-1)!;
    expect(request.model).toBe("summary-model");
    expect(request.stream).toBe(false);
    const messages = request.messages as Array<Record<string, string>>;
    expect(messages[1].content).toContain("port this app");
  });

  it("throws on provider errors and empty summaries", async () => {
    nextResponse = () => ({ status: 500, body: { error: "boom" } });
    await expect(
      summarizeForCompaction({ baseUrl, model: "m" }, [
        { role: "user", content: "hello" },
      ]),
    ).rejects.toThrow(/HTTP 500/);
    nextResponse = () => ({
      status: 200,
      body: { choices: [{ message: { content: "" } }] },
    });
    await expect(
      summarizeForCompaction({ baseUrl, model: "m" }, [
        { role: "user", content: "hello" },
      ]),
    ).rejects.toThrow(/empty/);
  });
});

describe("compactionSummaryText", () => {
  it("wraps the summary with continuation instructions", () => {
    const text = compactionSummaryText("summary body");
    expect(text).toContain("<conversation_summary>");
    expect(text).toContain("summary body");
    expect(text).toContain("automatically compacted");
  });
});
