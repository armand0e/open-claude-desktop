import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync(path.resolve("src/main/index.ts"), "utf8");

describe("main-process privileged gates", () => {
  it("keeps MCP child-process channels local-renderer only", () => {
    for (const channel of [
      "list-mcp-servers",
      "connect-to-mcp-server",
      "request-open-mcp-settings",
    ]) {
      const start = indexSource.indexOf(`ipcMain.handle("${channel}"`);
      expect(start, channel).toBeGreaterThanOrEqual(0);
      expect(indexSource.slice(start, start + 220), channel).toContain(
        "assertLocalIpcSender(event)",
      );
    }
  });

  it("does not ship an environment-variable computer-consent bypass", () => {
    expect(indexSource).not.toContain("CLAUDE_LOCAL_COMPUTER_AUTOCONSENT");
  });
});
