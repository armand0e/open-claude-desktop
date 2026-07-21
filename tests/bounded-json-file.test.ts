import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertBoundedJson,
  readBoundedJsonFile,
  readRecoverableBoundedJsonFile,
} from "../src/main/bounded-json-file";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("bounded JSON stores", () => {
  it("distinguishes a missing first-run file from corrupt persisted data", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bounded-json-"));
    roots.push(root);
    const file = path.join(root, "store.json");
    await expect(
      readBoundedJsonFile(file, 128, "test store"),
    ).resolves.toBeNull();
    await writeFile(file, "not-json");
    await expect(readBoundedJsonFile(file, 128, "test store")).rejects.toThrow(
      "invalid JSON",
    );
  });

  it("rejects oversized reads and writes before they exhaust memory", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bounded-json-"));
    roots.push(root);
    const file = path.join(root, "store.json");
    await writeFile(file, JSON.stringify({ value: "too large" }));
    await expect(readBoundedJsonFile(file, 4, "test store")).rejects.toThrow(
      "safety limit",
    );
    expect(() => assertBoundedJson("12345", 4, "test store")).toThrow(
      "safety limit",
    );
  });

  it("quarantines malformed data but does not hide ordinary access errors", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "bounded-json-"));
    roots.push(root);
    const file = path.join(root, "store.json");
    await writeFile(file, "not-json");
    await expect(
      readRecoverableBoundedJsonFile(file, 128, "test store"),
    ).resolves.toBeNull();
    const quarantined = (await readdir(root)).find((entry) =>
      entry.startsWith("store.json.corrupt-"),
    );
    expect(quarantined).toBeDefined();
    await expect(readFile(path.join(root, quarantined!), "utf8")).resolves.toBe(
      "not-json",
    );

    const directory = path.join(root, "not-a-file.json");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(directory));
    await expect(
      readRecoverableBoundedJsonFile(directory, 128, "test store"),
    ).rejects.toThrow();
  });
});
