import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});
import { StateStore } from "../src/main/state";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("persistent desktop state", () => {
  it("preserves a valid profile when reading it fails transiently", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-state-"));
    temporaryDirectories.push(root);
    const file = path.join(root, "claude-local-desktop.json");
    const original = JSON.stringify({ locale: "fr-FR" });
    await writeFile(file, original);
    vi.spyOn(fs, "readFileSync").mockImplementationOnce(() => {
      throw Object.assign(new Error("Temporarily locked"), { code: "EACCES" });
    });
    expect(() => new StateStore(root)).toThrow("Temporarily locked");
    expect(await readFile(file, "utf8")).toBe(original);
    expect(await readdir(root)).toEqual(["claude-local-desktop.json"]);
    expect(new StateStore(root).get("locale")).toBe("fr-FR");
  });

  it("serializes concurrent updates through an atomic file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-state-"));
    temporaryDirectories.push(root);
    const state = new StateStore(root);

    await Promise.all([
      state.update((draft) => {
        draft.locale = "fr-FR";
      }),
      state.update((draft) => {
        draft.menuBarEnabled = true;
      }),
      state.update((draft) => {
        draft.appConfig.preferences.theme = "dark";
      }),
    ]);

    const persisted = JSON.parse(await readFile(state.filePath, "utf8"));
    expect(persisted.locale).toBe("fr-FR");
    expect(persisted.menuBarEnabled).toBe(true);
    expect(persisted.appConfig.preferences.theme).toBe("dark");
  });

  it("normalizes malformed persisted fields instead of trusting type casts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-state-"));
    temporaryDirectories.push(root);
    await writeFile(
      path.join(root, "claude-local-desktop.json"),
      JSON.stringify({
        locale: { invalid: true },
        coworkFilesRoot: "C:\\legacy-files",
        coworkGlobalInstructions: "legacy instructions",
        appConfig: {
          features: { enabled: true, poisoned: "yes" },
          preferences: {
            theme: "dark",
            coworkHipaaRestricted: true,
            coworkScheduledTasksEnabled: true,
          },
          isUsingBuiltInNodeForMcp: "yes",
          isDxtAutoUpdatesEnabled: null,
        },
      }),
    );
    const state = new StateStore(root);
    expect(state.get("locale")).toBe("en-US");
    expect(
      (state.snapshot() as unknown as Record<string, unknown>).coworkFilesRoot,
    ).toBeUndefined();
    expect(
      (state.snapshot() as unknown as Record<string, unknown>)
        .coworkGlobalInstructions,
    ).toBeUndefined();
    expect(state.get("appConfig").features).toEqual({ enabled: true });
    expect(state.get("appConfig").preferences).toMatchObject({ theme: "dark" });
    expect(
      state.get("appConfig").preferences.coworkHipaaRestricted,
    ).toBeUndefined();
    expect(
      state.get("appConfig").preferences.coworkScheduledTasksEnabled,
    ).toBeUndefined();
    expect(state.get("appConfig").isUsingBuiltInNodeForMcp).toBe(true);
    expect(state.get("appConfig").isDxtAutoUpdatesEnabled).toBe(true);
  });

  it("quarantines invalid JSON instead of overwriting the only persisted copy", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-state-"));
    temporaryDirectories.push(root);
    const file = path.join(root, "claude-local-desktop.json");
    await writeFile(file, "{broken");

    const state = new StateStore(root);
    expect(state.get("locale")).toBe("en-US");
    const quarantined = (await readdir(root)).find((entry) =>
      entry.startsWith("claude-local-desktop.json.corrupt-"),
    );
    expect(quarantined).toBeDefined();
    await expect(readFile(path.join(root, quarantined!), "utf8")).resolves.toBe(
      "{broken",
    );
  });

  it("flushes queued writes and refuses updates after disposal", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "claude-state-"));
    temporaryDirectories.push(root);
    const state = new StateStore(root);
    const pending = state.update((draft) => {
      draft.locale = "de-DE";
    });
    await state.dispose();
    await expect(pending).resolves.toMatchObject({ locale: "de-DE" });
    await expect(
      state.update((draft) => {
        draft.locale = "es-ES";
      }),
    ).rejects.toThrow("closed");
    expect(JSON.parse(await readFile(state.filePath, "utf8")).locale).toBe(
      "de-DE",
    );
  });
});
