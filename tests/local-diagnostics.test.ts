import { mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  diagnosticError,
  LocalDiagnostics,
} from "../src/main/local-diagnostics";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe("LocalDiagnostics", () => {
  it("rotates an oversized log while a burst of records is queued", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "open-claude-log-"));
    directories.push(directory);
    const diagnostics = new LocalDiagnostics(directory);
    await writeFile(diagnostics.filePath, "");
    await truncate(diagnostics.filePath, 32 * 1024 * 1024);
    for (let index = 0; index < 257; index += 1)
      diagnostics.record("test", "burst", { index });
    await diagnostics.flush();
    const rows = (await readFile(diagnostics.filePath, "utf8"))
      .trim()
      .split("\n");
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[0])).toMatchObject({ sequence: 256 });
  });

  it("does not crash observed application code on cyclic or deeply nested details", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "open-claude-log-"));
    directories.push(directory);
    const diagnostics = new LocalDiagnostics(directory);
    const details: Record<string, unknown> = {};
    details.self = details;
    expect(() => diagnostics.record("test", "cycle", details)).not.toThrow();
    await diagnostics.flush();
    expect(await readFile(diagnostics.filePath, "utf8")).toContain("truncated");
  });

  it("persists ordered debug events while redacting credentials and prompt bodies", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "open-claude-log-"));
    directories.push(directory);
    const diagnostics = new LocalDiagnostics(directory);

    diagnostics.record("code", "message.received", {
      sessionId: "session-1",
      prompt: "private user text",
      apiKey: "sk-secret",
      payload: { harmlessKey: "still private" },
      nested: { authorization: "Bearer secret", state: "queued" },
      error: diagnosticError(
        new Error("private user text C:\\Users\\test\\secret.txt sk-secret"),
      ),
    });
    diagnostics.record(
      "code",
      "agent.begin",
      { sessionId: "session-1" },
      "info",
    );
    await diagnostics.flush();

    const entries = (await readFile(diagnostics.filePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      sequence: 1,
      scope: "code",
      event: "message.received",
      level: "debug",
    });
    expect(entries[1]).toMatchObject({ sequence: 2, level: "info" });
    const serialized = JSON.stringify(entries[0]);
    expect(serialized).not.toContain("private user text");
    expect(serialized).not.toContain("sk-secret");
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("still private");
    expect(serialized).not.toContain("secret.txt");
    expect(serialized).toContain('"redacted":true');
  });
});
