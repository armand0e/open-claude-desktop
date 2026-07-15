import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { StateStore } from "../src/main/state";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("persistent desktop state", () => {
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
});
