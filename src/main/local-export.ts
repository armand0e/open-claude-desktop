// Local data export: renders stored chat conversations and Code session
// transcripts as human-readable Markdown or as training-data JSONL rows
// (OpenAI chat-messages or ShareGPT shape). Everything here is pure so the
// formats stay unit-testable; file dialogs and disk writes live in local-ui.

export interface ExportContentBlock {
  type: string;
  [key: string]: unknown;
}

export interface ExportMessage {
  sender: "human" | "assistant";
  text: string;
  content?: ExportContentBlock[];
  uuid?: string;
  parent_message_uuid?: string;
  created_at?: string;
  attachments?: Array<{ file_name?: string; extracted_content?: string }>;
  files?: Array<{ file_name?: string }>;
}

export interface ExportConversation {
  uuid: string;
  name: string;
  model?: string;
  created_at?: string;
  updated_at?: string;
  is_temporary?: boolean;
  current_leaf_message_uuid?: string;
  chat_messages: ExportMessage[];
}

export interface ExportCodeSession {
  sessionId: string;
  title?: string;
  cwd?: string;
  createdAt?: number;
  lastActivityAt?: number;
  transcript: Array<Record<string, unknown>>;
}

export interface TrainingExportOptions {
  format: "markdown" | "openai" | "sharegpt";
  includeChat: boolean;
  includeCode: boolean;
  includeThinking: boolean;
  includeToolCalls: boolean;
  minAssistantTurns: number;
  after?: string;
  before?: string;
  conversationUuid?: string;
  systemPrompt?: string;
}

export const DEFAULT_EXPORT_OPTIONS: TrainingExportOptions = {
  format: "openai",
  includeChat: true,
  includeCode: false,
  includeThinking: false,
  includeToolCalls: false,
  minAssistantTurns: 1,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// The canonical thread of a conversation: the parent chain ending at the
// current leaf (edits and retries leave abandoned siblings behind).
export function conversationThread(
  conversation: ExportConversation,
): ExportMessage[] {
  const messages = conversation.chat_messages;
  if (messages.length === 0) return [];
  const byUuid = new Map(
    messages.filter((m) => m.uuid).map((m) => [m.uuid as string, m]),
  );
  const leaf =
    (conversation.current_leaf_message_uuid &&
      byUuid.get(conversation.current_leaf_message_uuid)) ||
    messages[messages.length - 1];
  const thread: ExportMessage[] = [];
  const visited = new Set<ExportMessage>();
  let cursor: ExportMessage | undefined = leaf;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    thread.unshift(cursor);
    cursor = cursor.parent_message_uuid
      ? byUuid.get(cursor.parent_message_uuid)
      : undefined;
  }
  return thread;
}

function withinRange(
  timestamp: string | number | undefined,
  options: TrainingExportOptions,
): boolean {
  if (!timestamp) return true;
  const value =
    typeof timestamp === "number" ? timestamp : Date.parse(timestamp);
  if (Number.isNaN(value)) return true;
  if (options.after && value < Date.parse(options.after)) return false;
  // An exclusive end at the following midnight keeps date-only inputs
  // intuitive ("before 2026-07-01" includes none of July 1).
  if (options.before && value >= Date.parse(options.before)) return false;
  return true;
}

function artifactTag(input: Record<string, unknown>): string {
  const id = asString(input.id) || "artifact";
  const type = asString(input.type);
  const title = asString(input.title);
  if (input.command === "update") {
    return (
      `<artifact_update identifier="${id}">\n` +
      `<old_str>${asString(input.old_str)}</old_str>\n` +
      `<new_str>${asString(input.new_str)}</new_str>\n` +
      `</artifact_update>`
    );
  }
  const attrs = [
    `identifier="${id}"`,
    type ? `type="${type}"` : "",
    title ? `title="${title}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<artifact ${attrs}>\n${asString(input.content)}\n</artifact>`;
}

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((entry) =>
      isRecord(entry) && typeof entry.text === "string"
        ? entry.text
        : JSON.stringify(entry),
    )
    .join("\n");
}

// Assembles one assistant turn into training text. Thinking and tool
// activity use explicit XML-ish tags so a fine-tune can learn (or a filter
// can strip) them mechanically.
export function assistantTurnText(
  message: ExportMessage,
  options: TrainingExportOptions,
): string {
  const blocks = message.content ?? [];
  if (blocks.length === 0) return message.text ?? "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "thinking") {
      if (options.includeThinking && asString(block.thinking).trim())
        parts.push(`<thinking>\n${asString(block.thinking)}\n</thinking>`);
      continue;
    }
    if (block.type === "text") {
      if (asString(block.text).trim()) parts.push(asString(block.text));
      continue;
    }
    if (block.type === "tool_use" && isRecord(block.input)) {
      if (block.name === "artifacts") {
        parts.push(artifactTag(block.input));
        continue;
      }
      if (options.includeToolCalls)
        parts.push(
          `<tool_call name="${asString(block.name)}">${JSON.stringify(block.input)}</tool_call>`,
        );
      continue;
    }
    if (block.type === "tool_result" && options.includeToolCalls) {
      const text = toolResultText(block.content);
      if (text.trim())
        parts.push(
          `<tool_result name="${asString(block.name)}">\n${text}\n</tool_result>`,
        );
    }
  }
  return parts.join("\n\n");
}

function humanTurnText(message: ExportMessage): string {
  const parts = [message.text ?? ""];
  for (const attachment of message.attachments ?? []) {
    const extracted = asString(attachment.extracted_content);
    if (extracted)
      parts.push(
        `<attachment name="${asString(attachment.file_name) || "file"}">\n${extracted}\n</attachment>`,
      );
  }
  return parts.filter((part) => part.trim()).join("\n\n");
}

interface Turn {
  role: "user" | "assistant";
  text: string;
}

function mergedTurns(turns: Turn[]): Turn[] {
  const merged: Turn[] = [];
  for (const turn of turns) {
    if (!turn.text.trim()) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.role === turn.role)
      previous.text += `\n\n${turn.text}`;
    else merged.push({ ...turn });
  }
  return merged;
}

export function chatConversationTurns(
  conversation: ExportConversation,
  options: TrainingExportOptions,
): Turn[] {
  return mergedTurns(
    conversationThread(conversation).map((message) => ({
      role: message.sender === "human" ? "user" : ("assistant" as const),
      text:
        message.sender === "human"
          ? humanTurnText(message)
          : assistantTurnText(message, options),
    })),
  );
}

export function codeSessionTurns(
  session: ExportCodeSession,
  options: TrainingExportOptions,
): Turn[] {
  const turns: Turn[] = [];
  for (const item of session.transcript) {
    if (!isRecord(item.message)) continue;
    const message = item.message;
    if (item.type === "user") {
      if (typeof message.content === "string")
        turns.push({ role: "user", text: message.content });
      else if (Array.isArray(message.content) && options.includeToolCalls) {
        const results = message.content
          .filter(
            (block): block is Record<string, unknown> =>
              isRecord(block) && block.type === "tool_result",
          )
          .map((block) => toolResultText(block.content))
          .filter((text) => text.trim())
          .map((text) => `<tool_result>\n${text}\n</tool_result>`);
        if (results.length > 0)
          turns.push({ role: "user", text: results.join("\n\n") });
      }
      continue;
    }
    if (item.type !== "assistant") continue;
    const blocks = Array.isArray(message.content) ? message.content : [];
    const parts: string[] = [];
    for (const block of blocks) {
      if (!isRecord(block)) continue;
      if (block.type === "text" && asString(block.text).trim())
        parts.push(asString(block.text));
      else if (
        block.type === "thinking" &&
        options.includeThinking &&
        asString(block.thinking).trim()
      )
        parts.push(`<thinking>\n${asString(block.thinking)}\n</thinking>`);
      else if (
        block.type === "tool_use" &&
        options.includeToolCalls &&
        isRecord(block.input)
      )
        parts.push(
          `<tool_call name="${asString(block.name)}">${JSON.stringify(block.input)}</tool_call>`,
        );
    }
    if (parts.length > 0)
      turns.push({ role: "assistant", text: parts.join("\n\n") });
  }
  return mergedTurns(turns);
}

function assistantTurnCount(turns: Turn[]): number {
  return turns.filter((turn) => turn.role === "assistant").length;
}

function trainingRow(
  turns: Turn[],
  options: TrainingExportOptions,
): Record<string, unknown> | null {
  if (turns.length === 0 || turns[0].role !== "user") return null;
  if (assistantTurnCount(turns) < Math.max(1, options.minAssistantTurns))
    return null;
  if (options.format === "sharegpt") {
    return {
      ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
      conversations: turns.map((turn) => ({
        from: turn.role === "user" ? "human" : "gpt",
        value: turn.text,
      })),
    };
  }
  return {
    messages: [
      ...(options.systemPrompt
        ? [{ role: "system", content: options.systemPrompt }]
        : []),
      ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
    ],
  };
}

export interface ExportResult {
  rows: string[];
  conversations: number;
  skipped: number;
}

export function buildTrainingExport(
  conversations: readonly ExportConversation[],
  codeSessions: readonly ExportCodeSession[],
  options: TrainingExportOptions,
): ExportResult {
  const rows: string[] = [];
  let included = 0;
  let skipped = 0;
  if (options.includeChat)
    for (const conversation of conversations) {
      if (conversation.is_temporary) continue;
      if (
        options.conversationUuid &&
        conversation.uuid !== options.conversationUuid
      )
        continue;
      if (!withinRange(conversation.updated_at, options)) {
        skipped += 1;
        continue;
      }
      const row = trainingRow(chatConversationTurns(conversation, options), {
        ...options,
      });
      if (row) {
        rows.push(JSON.stringify(row));
        included += 1;
      } else skipped += 1;
    }
  if (options.includeCode && !options.conversationUuid)
    for (const session of codeSessions) {
      if (!withinRange(session.lastActivityAt, options)) {
        skipped += 1;
        continue;
      }
      const row = trainingRow(codeSessionTurns(session, options), options);
      if (row) {
        rows.push(JSON.stringify(row));
        included += 1;
      } else skipped += 1;
    }
  return { rows, conversations: included, skipped };
}

const FENCES: Record<string, string> = {
  "text/html": "html",
  "application/vnd.ant.code": "",
  "text/markdown": "markdown",
  "image/svg+xml": "svg",
  "application/vnd.ant.mermaid": "mermaid",
  "application/vnd.ant.react": "jsx",
};

function markdownArtifact(input: Record<string, unknown>): string {
  const title = asString(input.title) || asString(input.id) || "Artifact";
  const type = asString(input.type);
  if (input.command === "update")
    return (
      `### Artifact update: ${title}\n\n` +
      "Replaced:\n\n```\n" +
      asString(input.old_str) +
      "\n```\n\nWith:\n\n```\n" +
      asString(input.new_str) +
      "\n```"
    );
  const fence =
    FENCES[type] ?? asString(input.language) ?? (type ? "" : "text");
  return (
    `### Artifact: ${title}${type ? ` (${type})` : ""}\n\n` +
    "```" +
    fence +
    "\n" +
    asString(input.content) +
    "\n```"
  );
}

export function conversationMarkdown(
  conversation: ExportConversation,
  options: TrainingExportOptions,
): string {
  const lines: string[] = [
    `# ${conversation.name || "Untitled chat"}`,
    "",
    `- Model: ${conversation.model || "unknown"}`,
    `- Created: ${conversation.created_at || "unknown"}`,
    `- Updated: ${conversation.updated_at || "unknown"}`,
    `- Exported: ${new Date().toISOString()}`,
    "",
  ];
  for (const message of conversationThread(conversation)) {
    lines.push("---", "");
    if (message.sender === "human") {
      lines.push("## Human", "", message.text ?? "");
      for (const attachment of message.attachments ?? [])
        if (attachment.file_name)
          lines.push("", `*Attachment: ${attachment.file_name}*`);
      lines.push("");
      continue;
    }
    lines.push("## Assistant", "");
    const blocks = message.content ?? [];
    if (blocks.length === 0) {
      lines.push(message.text ?? "", "");
      continue;
    }
    for (const block of blocks) {
      if (block.type === "thinking") {
        if (options.includeThinking && asString(block.thinking).trim())
          lines.push(
            "> **Thinking**",
            ...asString(block.thinking)
              .split("\n")
              .map((line) => `> ${line}`),
            "",
          );
      } else if (block.type === "text") {
        if (asString(block.text).trim()) lines.push(asString(block.text), "");
      } else if (block.type === "tool_use" && isRecord(block.input)) {
        if (block.name === "artifacts")
          lines.push(markdownArtifact(block.input), "");
        else if (options.includeToolCalls)
          lines.push(
            `*Tool call — ${asString(block.name)}*`,
            "",
            "```json",
            JSON.stringify(block.input, null, 2),
            "```",
            "",
          );
      } else if (block.type === "tool_result" && options.includeToolCalls) {
        const text = toolResultText(block.content);
        if (text.trim())
          lines.push(
            `*Tool result — ${asString(block.name)}*`,
            "",
            "```",
            text,
            "```",
            "",
          );
      }
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || "untitled";
}
