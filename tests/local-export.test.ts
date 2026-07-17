import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_OPTIONS,
  ExportCodeSession,
  ExportConversation,
  TrainingExportOptions,
  buildTrainingExport,
  chatConversationTurns,
  codeSessionTurns,
  conversationMarkdown,
  conversationThread,
  safeFileName,
} from "../src/main/local-export";

const options = (
  overrides: Partial<TrainingExportOptions> = {},
): TrainingExportOptions => ({ ...DEFAULT_EXPORT_OPTIONS, ...overrides });

function conversation(
  overrides: Partial<ExportConversation> = {},
): ExportConversation {
  return {
    uuid: "conv-1",
    name: "Demo chat",
    model: "local-model",
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
    chat_messages: [
      {
        uuid: "m1",
        sender: "human",
        text: "Build a page",
        content: [{ type: "text", text: "Build a page" }],
      },
      {
        uuid: "m2",
        sender: "assistant",
        text: "Here you go.",
        parent_message_uuid: "m1",
        content: [
          { type: "thinking", thinking: "Plan the page." },
          { type: "text", text: "Here you go." },
          {
            type: "tool_use",
            id: "t1",
            name: "artifacts",
            input: {
              command: "create",
              id: "page",
              type: "text/html",
              title: "Page",
              content: "<h1>Hi</h1>",
            },
          },
        ],
      },
    ],
    current_leaf_message_uuid: "m2",
    ...overrides,
  };
}

describe("local export", () => {
  it("follows the leaf branch and skips abandoned siblings", () => {
    const convo = conversation({
      chat_messages: [
        ...conversation().chat_messages,
        {
          uuid: "m2-alt",
          sender: "assistant",
          text: "Abandoned retry",
          parent_message_uuid: "m1",
          content: [{ type: "text", text: "Abandoned retry" }],
        },
      ],
    });
    const thread = conversationThread(convo);
    expect(thread.map((message) => message.uuid)).toEqual(["m1", "m2"]);
  });

  it("renders OpenAI-format rows with artifacts tagged and thinking excluded by default", () => {
    const result = buildTrainingExport([conversation()], [], options());
    expect(result.conversations).toBe(1);
    const row = JSON.parse(result.rows[0]) as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(row.messages[0]).toEqual({ role: "user", content: "Build a page" });
    expect(row.messages[1].role).toBe("assistant");
    expect(row.messages[1].content).toContain("Here you go.");
    expect(row.messages[1].content).toContain(
      '<artifact identifier="page" type="text/html" title="Page">',
    );
    expect(row.messages[1].content).toContain("<h1>Hi</h1>");
    expect(row.messages[1].content).not.toContain("<thinking>");
  });

  it("includes thinking when requested and renders ShareGPT shape", () => {
    const result = buildTrainingExport(
      [conversation()],
      [],
      options({ format: "sharegpt", includeThinking: true }),
    );
    const row = JSON.parse(result.rows[0]) as {
      conversations: Array<{ from: string; value: string }>;
    };
    expect(row.conversations[0].from).toBe("human");
    expect(row.conversations[1].from).toBe("gpt");
    expect(row.conversations[1].value).toContain(
      "<thinking>\nPlan the page.\n</thinking>",
    );
  });

  it("never exports temporary conversations", () => {
    const result = buildTrainingExport(
      [conversation({ is_temporary: true })],
      [],
      options(),
    );
    expect(result.rows).toHaveLength(0);
  });

  it("applies date and minimum-turn filters", () => {
    const outOfRange = buildTrainingExport(
      [conversation()],
      [],
      options({ after: "2026-07-03" }),
    );
    expect(outOfRange.rows).toHaveLength(0);
    expect(outOfRange.skipped).toBe(1);
    const tooShort = buildTrainingExport(
      [conversation()],
      [],
      options({ minAssistantTurns: 2 }),
    );
    expect(tooShort.rows).toHaveLength(0);
  });

  it("merges consecutive same-role turns", () => {
    const convo = conversation({
      chat_messages: [
        conversation().chat_messages[0],
        conversation().chat_messages[1],
        {
          uuid: "m3",
          sender: "assistant",
          text: "One more note.",
          parent_message_uuid: "m2",
          content: [{ type: "text", text: "One more note." }],
        },
      ],
      current_leaf_message_uuid: "m3",
    });
    const turns = chatConversationTurns(convo, options());
    expect(turns).toHaveLength(2);
    expect(turns[1].text).toContain("Here you go.");
    expect(turns[1].text).toContain("One more note.");
  });

  it("exports code session transcripts with optional tool calls", () => {
    const session: ExportCodeSession = {
      sessionId: "s1",
      title: "Fix bug",
      lastActivityAt: Date.parse("2026-07-02T10:00:00.000Z"),
      transcript: [
        { type: "user", message: { role: "user", content: "Fix the bug" } },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Looking now." },
              {
                type: "tool_use",
                name: "Bash",
                input: { command: "npm test" },
              },
            ],
          },
        },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Fixed." }],
          },
        },
      ],
    };
    const plain = codeSessionTurns(session, options());
    expect(plain).toHaveLength(2);
    expect(plain[1].text).not.toContain("tool_call");
    const withTools = codeSessionTurns(
      session,
      options({ includeToolCalls: true }),
    );
    expect(withTools[1].text).toContain('<tool_call name="Bash">');
    const result = buildTrainingExport(
      [],
      [session],
      options({ includeChat: false, includeCode: true }),
    );
    expect(result.conversations).toBe(1);
  });

  it("renders Markdown with fenced artifacts", () => {
    const markdown = conversationMarkdown(conversation(), options());
    expect(markdown).toContain("# Demo chat");
    expect(markdown).toContain("## Human");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("### Artifact: Page (text/html)");
    expect(markdown).toContain("```html\n<h1>Hi</h1>\n```");
    expect(markdown).not.toContain("**Thinking**");
    const withThinking = conversationMarkdown(
      conversation(),
      options({ includeThinking: true }),
    );
    expect(withThinking).toContain("> **Thinking**");
  });

  it("sanitizes export file names", () => {
    expect(safeFileName('What is <html>? A "guide" / notes')).toBe(
      "What is html A guide notes",
    );
    expect(safeFileName("   ")).toBe("untitled");
  });
});
