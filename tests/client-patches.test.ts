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
  it("discovers module assets regardless of HTML attribute order", () => {
    expect(
      moduleAssetPaths(
        '<script src="/entry.js" defer type="module"></script><link href="/chunk.js" crossorigin rel="modulepreload">',
      ),
    ).toEqual(["/entry.js", "/chunk.js"]);
  });

  it("every patch matches its declared release-gate count", async () => {
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

  it("removes Anthropic .claude paths from the retained local client", async () => {
    const indexHtml = await readFile(path.join(root, "index.html"), "utf8");
    const patched = await patchedClientAssets(
      root,
      indexHtml,
      LOCAL_CLIENT_PATCHES,
    );
    const reservedPath =
      /(?<![A-Za-z0-9])\.claude(?:\.local)?(?=(?:\\[\\/]|[\\/\[]))/gu;
    const combined = [...patched.values()]
      .map((asset) => asset.source)
      .join("\n");
    const reservedMatches = [...patched.entries()].flatMap(
      ([assetPath, asset]) =>
        [...asset.source.matchAll(reservedPath)].map((match) => ({
          asset: path.basename(assetPath),
          token: match[0],
          context: asset.source.slice(
            Math.max(0, (match.index ?? 0) - 80),
            (match.index ?? 0) + 160,
          ),
        })),
    );

    expect(reservedMatches).toEqual([]);
    expect(combined).toContain(".open-claude/launch.json");
    expect(combined).toContain(
      "This folder belongs to Anthropic Claude and cannot be used by Open-Claude tools.",
    );
  }, 120_000);
});
