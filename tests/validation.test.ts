import { describe, expect, it } from "vitest";
import {
  assertContractArguments,
  contractValueMatches,
} from "../src/shared/validation";

describe("recovered runtime validators", () => {
  it("checks primitive, optional, nullable, and array summaries", () => {
    expect(contractValueMatches("x", "string")).toBe(true);
    expect(contractValueMatches(undefined, "undefined | boolean")).toBe(true);
    expect(contractValueMatches(null, "null | string")).toBe(true);
    expect(contractValueMatches(["a", "b"], "string[]")).toBe(true);
    expect(contractValueMatches(["a", 1], "string[]")).toBe(false);
    expect(contractValueMatches({}, "custom schema validated")).toBe(true);
  });

  it("identifies the recovered argument name and position on failure", () => {
    expect(() =>
      assertContractArguments(
        "channel",
        ["title", "not-a-boolean"],
        [
          {
            name: "restrictToHomeDir",
            position: 1,
            validation: "undefined | boolean",
          },
        ],
      ),
    ).toThrow('Argument "restrictToHomeDir" at position 1');
  });
});
