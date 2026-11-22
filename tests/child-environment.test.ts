import { describe, expect, it } from "vitest";
import { childEnvironment } from "../src/main/child-environment";

describe("child process environment", () => {
  it("passes operating-system basics without inheriting ambient credentials", () => {
    const environment = childEnvironment(
      { PORT: "4310", EXPLICIT_SERVICE_VALUE: "configured" },
      {
        PATH: "C:\\Windows\\System32",
        SystemRoot: "C:\\Windows",
        OPENAI_API_KEY: "must-not-leak",
        ANTHROPIC_API_KEY: "must-not-leak",
        DATABASE_URL: "must-not-leak",
        SESSION_TOKEN: "must-not-leak",
      },
    );
    expect(environment).toMatchObject({
      PATH: "C:\\Windows\\System32",
      SystemRoot: "C:\\Windows",
      PORT: "4310",
      EXPLICIT_SERVICE_VALUE: "configured",
    });
    expect(JSON.stringify(environment)).not.toContain("must-not-leak");
    expect(environment).not.toHaveProperty("OPENAI_API_KEY");
    expect(environment).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("drops malformed explicit values", () => {
    expect(childEnvironment({ "BAD=NAME": "x", GOOD: "a\0b" }, {})).toEqual({});
  });
});
