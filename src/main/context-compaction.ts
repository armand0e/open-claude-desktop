// Automatic context compaction shared by local Chat and Code. When the
// estimated prompt size crosses COMPACTION_TRIGGER_RATIO of the configured
// context window, the older part of the conversation is replaced by a
// model-written summary and only a recent tail is kept verbatim.

type JsonObject = Record<string, unknown>;

export interface CompactionProviderConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export const COMPACTION_TRIGGER_RATIO = 0.75;
// Fraction of the context window the verbatim tail may occupy afterwards.
export const COMPACTION_TAIL_RATIO = 0.25;
// A conservative chars-per-token that holds across OpenAI-compatible
// tokenizers; overestimating usage only compacts a little earlier.
const CHARS_PER_TOKEN = 4;
// The summarization request itself must fit the model, so the flattened
// transcript sent for summarization is capped and cut from the middle.
const MAX_SUMMARY_INPUT_CHARS = 160_000;
const SUMMARY_TIMEOUT_MS = 120_000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(message: unknown): number {
  try {
    return estimateTokens(JSON.stringify(message) ?? "");
  } catch {
    return 0;
  }
}

export interface CompactionPlan {
  // Indices are positions in the messages array given to planCompaction.
  prefixLength: number;
  totalTokens: number;
}

export function planCompaction(
  reservedTokens: number,
  messages: readonly unknown[],
  contextWindow: number,
): CompactionPlan | null {
  const window = Math.max(4_096, Math.floor(contextWindow));
  const sizes = messages.map(estimateMessageTokens);
  const totalTokens =
    reservedTokens + sizes.reduce((sum, size) => sum + size, 0);
  if (totalTokens <= window * COMPACTION_TRIGGER_RATIO) return null;
  const tailBudget = window * COMPACTION_TAIL_RATIO;
  let tailTokens = 0;
  let tailCount = 0;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (tailCount >= 2 && tailTokens + sizes[index] > tailBudget) break;
    tailTokens += sizes[index];
    tailCount += 1;
  }
  const prefixLength = messages.length - tailCount;
  // Folding fewer than two messages cannot meaningfully shrink the prompt;
  // an oversized tail is handled by the callers' hard budget instead.
  if (prefixLength < 2) return null;
  return { prefixLength, totalTokens };
}

const COMPACTION_SYSTEM_PROMPT = [
  "You compact an ongoing conversation so the assistant can continue it with less context.",
  "Write a dense factual summary of the conversation transcript the user provides. It must let the assistant continue seamlessly, so include:",
  "- the user's overall goal, requirements, and constraints",
  "- key decisions made and why",
  "- important facts, names, file paths, code identifiers, URLs, and tool results",
  "- the current state of the work",
  "- unresolved tasks, open questions, and anything the user is waiting on",
  "Output only the summary text with no preamble, headers, or commentary.",
].join("\n");

function flattenedContent(message: JsonObject): string {
  const parts: string[] = [];
  if (typeof message.content === "string" && message.content)
    parts.push(message.content);
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    try {
      parts.push(`tool_calls: ${JSON.stringify(message.tool_calls)}`);
    } catch {
      // Unserializable tool calls are omitted from the summary input.
    }
  }
  return parts.join("\n");
}

export function compactionTranscript(messages: readonly JsonObject[]): string {
  const blocks = messages.map((message) => {
    const role = typeof message.role === "string" ? message.role : "user";
    return `[${role}]\n${flattenedContent(message)}`;
  });
  let transcript = blocks.join("\n\n");
  if (transcript.length > MAX_SUMMARY_INPUT_CHARS) {
    const head = Math.floor(MAX_SUMMARY_INPUT_CHARS * 0.3);
    const tail = MAX_SUMMARY_INPUT_CHARS - head;
    transcript = `${transcript.slice(0, head)}\n\n[... middle of the transcript omitted for length ...]\n\n${transcript.slice(-tail)}`;
  }
  return transcript;
}

function strippedThinking(text: string): string {
  // Some local models prepend an inline thinking block even to plain
  // completions; the summary must not carry it forward.
  return text.replace(/^\s*<think>[\s\S]*?<\/think>\s*/u, "").trim();
}

export async function summarizeForCompaction(
  provider: CompactionProviderConfig,
  messages: readonly JsonObject[],
  signal?: AbortSignal,
): Promise<string> {
  const timeout = AbortSignal.timeout(SUMMARY_TIMEOUT_MS);
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: {
      "Content-Type": "application/json",
      ...(provider.apiKey
        ? { Authorization: `Bearer ${provider.apiKey}` }
        : {}),
    },
    body: JSON.stringify({
      model: provider.model,
      stream: false,
      messages: [
        { role: "system", content: COMPACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Summarize this conversation transcript for compaction:\n\n${compactionTranscript(messages)}`,
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Compaction summary failed: HTTP ${response.status}`);
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  const summary = strippedThinking(typeof content === "string" ? content : "");
  if (!summary) throw new Error("Compaction summary was empty");
  return summary;
}

export function compactionSummaryText(summary: string): string {
  return [
    "<conversation_summary>",
    summary,
    "</conversation_summary>",
    "The messages before this point were automatically compacted into the summary above to stay within the model's context window. Treat the summary as authoritative history and continue the conversation from it.",
  ].join("\n");
}

export function traceCompaction(surface: string, detail: JsonObject): void {
  if (process.env.CLAUDE_TRACE_LOCAL_API === "1")
    console.error(`[local-compaction] ${surface} ${JSON.stringify(detail)}`);
}
