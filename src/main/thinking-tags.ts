export interface ThinkingTagConfig {
  thinkingStartTag?: string;
  thinkingEndTag?: string;
}

export interface ThinkingTagDelta {
  type: "text" | "reasoning";
  text: string;
}

export const DEFAULT_THINKING_START_TAG = "<think>";
export const DEFAULT_THINKING_END_TAG = "</think>";

function appendDelta(
  output: ThinkingTagDelta[],
  type: ThinkingTagDelta["type"],
  text: string,
): void {
  if (!text) return;
  const previous = output.at(-1);
  if (previous?.type === type) previous.text += text;
  else output.push({ type, text });
}

function partialTagSuffixLength(value: string, tag: string): number {
  for (
    let length = Math.min(value.length, Math.max(0, tag.length - 1));
    length > 0;
    length -= 1
  ) {
    if (tag.startsWith(value.slice(-length))) return length;
  }
  return 0;
}

/**
 * Separates reasoning embedded in the normal content stream. It deliberately
 * retains a possible partial delimiter between chunks so split tokens such as
 * `<thi` + `nk>` never flash in the visible answer.
 */
export class ThinkingTagParser {
  readonly startTag: string;
  readonly endTag: string;
  #buffer = "";
  #reasoning = false;
  #finished = false;

  constructor(config: ThinkingTagConfig = {}) {
    this.startTag =
      config.thinkingStartTag === undefined
        ? DEFAULT_THINKING_START_TAG
        : config.thinkingStartTag;
    this.endTag =
      config.thinkingEndTag === undefined
        ? DEFAULT_THINKING_END_TAG
        : config.thinkingEndTag;
  }

  push(value: string): ThinkingTagDelta[] {
    if (this.#finished || !value) return [];
    if (!this.startTag || !this.endTag || this.startTag === this.endTag)
      return [{ type: "text", text: value }];

    this.#buffer += value;
    const output: ThinkingTagDelta[] = [];
    while (this.#buffer) {
      const target = this.#reasoning ? this.endTag : this.startTag;
      const index = this.#buffer.indexOf(target);
      if (index >= 0) {
        appendDelta(
          output,
          this.#reasoning ? "reasoning" : "text",
          this.#buffer.slice(0, index),
        );
        this.#buffer = this.#buffer.slice(index + target.length);
        this.#reasoning = !this.#reasoning;
        continue;
      }

      const retained = partialTagSuffixLength(this.#buffer, target);
      appendDelta(
        output,
        this.#reasoning ? "reasoning" : "text",
        this.#buffer.slice(0, this.#buffer.length - retained),
      );
      this.#buffer = retained ? this.#buffer.slice(-retained) : "";
      break;
    }
    return output;
  }

  finish(): ThinkingTagDelta[] {
    if (this.#finished) return [];
    this.#finished = true;
    if (!this.#buffer) return [];
    const output = [
      {
        type: this.#reasoning ? "reasoning" : "text",
        text: this.#buffer,
      } satisfies ThinkingTagDelta,
    ];
    this.#buffer = "";
    return output;
  }
}

export function parseThinkingTaggedText(
  value: string,
  config: ThinkingTagConfig = {},
): { text: string; reasoning: string } {
  const parser = new ThinkingTagParser(config);
  const deltas = [...parser.push(value), ...parser.finish()];
  return {
    text: deltas
      .filter((delta) => delta.type === "text")
      .map((delta) => delta.text)
      .join(""),
    reasoning: deltas
      .filter((delta) => delta.type === "reasoning")
      .map((delta) => delta.text)
      .join(""),
  };
}
