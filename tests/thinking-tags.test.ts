import { describe, expect, it } from "vitest";
import {
  parseThinkingTaggedText,
  ThinkingTagParser,
} from "../src/main/thinking-tags";

describe("thinking tag parser", () => {
  it("uses think tags by default", () => {
    expect(
      parseThinkingTaggedText(
        "Before <think>private reasoning</think> visible answer",
      ),
    ).toEqual({
      text: "Before  visible answer",
      reasoning: "private reasoning",
    });
  });

  it("handles delimiters fragmented across streaming chunks", () => {
    const parser = new ThinkingTagParser();
    const deltas = [
      ...parser.push("Visible <thi"),
      ...parser.push("nk>step one</th"),
      ...parser.push("ink> done"),
      ...parser.finish(),
    ];
    expect(deltas).toEqual([
      { type: "text", text: "Visible " },
      { type: "reasoning", text: "step one" },
      { type: "text", text: " done" },
    ]);
  });

  it("supports arbitrary model-specific channel markers", () => {
    expect(
      parseThinkingTaggedText(
        "<|channel|>thoughtPlan privately<|channel|>finalAnswer visibly",
        {
          thinkingStartTag: "<|channel|>thought",
          thinkingEndTag: "<|channel|>final",
        },
      ),
    ).toEqual({ text: "Answer visibly", reasoning: "Plan privately" });
  });

  it("can be disabled by clearing both tags", () => {
    expect(
      parseThinkingTaggedText("<think>keep this visible</think>", {
        thinkingStartTag: "",
        thinkingEndTag: "",
      }),
    ).toEqual({ text: "<think>keep this visible</think>", reasoning: "" });
  });
});
