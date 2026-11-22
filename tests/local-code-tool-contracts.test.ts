import { describe, expect, it } from "vitest";
import {
  fallbackToolCalls,
  looksLikeForegroundServerCommand,
} from "../src/main/local-code";

describe("Code tool contracts", () => {
  it("routes common resident servers away from the finite Bash tool", () => {
    expect(looksLikeForegroundServerCommand("python -m http.server 8080")).toBe(
      true,
    );
    expect(
      looksLikeForegroundServerCommand("npx -y http-server . -p 8080"),
    ).toBe(true);
    expect(looksLikeForegroundServerCommand("npm run dev")).toBe(true);
    expect(looksLikeForegroundServerCommand("node server.js")).toBe(true);
    expect(looksLikeForegroundServerCommand("start /b node server.js")).toBe(
      true,
    );
    expect(looksLikeForegroundServerCommand("node .\\dev-server.mjs")).toBe(
      true,
    );
    expect(
      looksLikeForegroundServerCommand("uvicorn app:api --port 8000"),
    ).toBe(true);
  });

  it("keeps finite commands and help probes available", () => {
    expect(looksLikeForegroundServerCommand("npm test")).toBe(false);
    expect(looksLikeForegroundServerCommand("npx vite --help")).toBe(false);
    expect(looksLikeForegroundServerCommand("python -m compileall src")).toBe(
      false,
    );
    expect(looksLikeForegroundServerCommand("node tests/server.test.js")).toBe(
      false,
    );
  });

  it("requires an explicit textual tool envelope", () => {
    expect(
      fallbackToolCalls('{"name":"preview_start","arguments":{"name":"web"}}'),
    ).toEqual([]);
    expect(
      fallbackToolCalls(
        '<tool_call>{"name":"preview_start","arguments":{"name":"web"}}</tool_call>',
      ),
    ).toEqual([
      expect.objectContaining({
        name: "preview_start",
        arguments: { name: "web" },
      }),
    ]);
    expect(
      fallbackToolCalls(
        '{"tool_calls":[{"name":"Read","arguments":{"file_path":"README.md"}}]}',
      ),
    ).toEqual([]);
  });
});
