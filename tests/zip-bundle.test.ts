import { describe, expect, it } from "vitest";
import { zipEntries } from "../src/main/local-extract";
import { createZipBundle } from "../src/main/zip-bundle";

describe("diagnostic ZIP bundles", () => {
  it("writes standards-compatible UTF-8 stored entries", () => {
    const bundle = createZipBundle([
      { name: "manifest.json", data: '{"ok":true}\n' },
      { name: "logs/Open-Claude.log", data: "ready\n" },
    ]);
    const entries = zipEntries(bundle);

    expect(
      Buffer.from(entries.get("manifest.json") ?? []).toString("utf8"),
    ).toBe('{"ok":true}\n');
    expect(
      Buffer.from(entries.get("logs/Open-Claude.log") ?? []).toString("utf8"),
    ).toBe("ready\n");
  });

  it("rejects traversal and unbounded payloads", () => {
    expect(() =>
      createZipBundle([{ name: "../secret.txt", data: "no" }]),
    ).toThrow("Unsafe ZIP entry name");
    expect(() =>
      createZipBundle([
        { name: "huge.bin", data: Buffer.alloc(32 * 1024 * 1024 + 1) },
      ]),
    ).toThrow("ZIP payload limit exceeded");
  });
});
