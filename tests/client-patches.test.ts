// Every client patch must match the staged renderer snapshot exactly once —
// the app refuses to launch otherwise. This audit runs the real matcher
// against .package-assets/ion-dist and reports every drifted patch at once,
// which is the workhorse for renderer snapshot upgrades.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_CLIENT_PATCHES,
  moduleAssetPaths,
  patchedClientAssets,
} from "../src/main/client-patches";

const root = path.resolve(".package-assets", "ion-dist");

describe("client patches against the staged renderer snapshot", () => {
  it("every patch matches exactly once", async () => {
    const indexHtml = await readFile(path.join(root, "index.html"), "utf8");
    expect(moduleAssetPaths(indexHtml).length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const patch of LOCAL_CLIENT_PATCHES) {
      try {
        await patchedClientAssets(root, indexHtml, [patch]);
      } catch (error) {
        failures.push(
          `${patch.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    expect(
      failures,
      `Patches out of sync with the staged snapshot:\n${failures.join("\n")}`,
    ).toEqual([]);
  }, 120_000);
});
