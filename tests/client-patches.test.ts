// Every client patch must match the staged renderer snapshot exactly once —
// the app refuses to launch otherwise. This audit runs the real matcher
// against .package-assets/ion-dist and reports every drifted patch at once,
// which is the workhorse for renderer snapshot upgrades.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOCAL_CLIENT_PATCHES,
  applyClientPatchSet,
  moduleAssetPaths,
  patchedClientAssets,
} from "../src/main/client-patches";
import { RETAINED_DESKTOP_VERSION } from "../src/shared/desktop-version";

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
        await patchedClientAssets(
          root,
          indexHtml,
          [patch],
          RETAINED_DESKTOP_VERSION,
        );
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
      RETAINED_DESKTOP_VERSION,
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

  it("keeps local artifact cards in the current app document", async () => {
    const indexHtml = await readFile(path.join(root, "index.html"), "utf8");
    const galleryPatch = LOCAL_CLIENT_PATCHES.find(
      (patch) =>
        patch.id === "bind-native-artifact-gallery-to-local-desktop-store",
    );
    expect(galleryPatch).toBeDefined();
    const patched = await patchedClientAssets(
      root,
      indexHtml,
      [galleryPatch!],
      RETAINED_DESKTOP_VERSION,
    );
    const combined = [...patched.values()]
      .map((asset) => asset.source)
      .join("\n");

    expect(combined).toContain(
      "sourceSurface?`/chat/${encodeURIComponent(e.sessionId)}?artifactId=${encodeURIComponent(e.id)}`:`/epitaxy/${encodeURIComponent(e.sessionId)}?open_local_artifact=${encodeURIComponent(e.id)}`,newTab:!1",
    );
  });

  it("reuses a patch intent through versioned alternate anchors", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "renderer-patch-"));
    try {
      await mkdir(path.join(temporary, "assets"));
      const indexHtml =
        '<script type="module" src="/assets/entry.js"></script>';
      await writeFile(path.join(temporary, "index.html"), indexHtml);
      await writeFile(
        path.join(temporary, "assets", "entry.js"),
        "const route='new-renderer';",
      );
      const applied = await applyClientPatchSet(temporary, indexHtml, [
        {
          id: "portable-route",
          find: "old-renderer",
          replace: "local-route",
          variants: [
            {
              label: "1.24xxx",
              find: "new-renderer",
              replace: "local-route",
            },
          ],
        },
      ]);

      expect(applied.report).toMatchObject({
        total: 1,
        applied: 1,
        satisfied: 0,
        unresolved: 0,
      });
      expect(applied.report.results[0]).toMatchObject({
        status: "applied",
        selectedVariant: "1.24xxx",
      });
      expect([...applied.assets.values()][0]?.source).toContain("local-route");
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("accepts only an explicitly audited native disposition for the exact renderer", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "renderer-native-"));
    try {
      const indexHtml = '<script type="module" src="/entry.js"></script>';
      await writeFile(path.join(temporary, "index.html"), indexHtml);
      await writeFile(path.join(temporary, "entry.js"), "native-feature");
      const patches = [
        {
          id: "retired-gate",
          find: "old-gate",
          replace: "enabled",
          satisfiedVersions: {
            "1.24012.9": "The renderer now exposes this feature natively.",
          },
        },
      ] as const;

      const audited = await applyClientPatchSet(temporary, indexHtml, patches, {
        rendererVersion: "1.24012.9",
      });
      expect(audited.report).toMatchObject({
        applied: 0,
        satisfied: 1,
        unresolved: 0,
      });
      expect(audited.report.results[0]).toMatchObject({
        status: "satisfied",
        satisfiedReason: "The renderer now exposes this feature natively.",
      });
      await expect(
        applyClientPatchSet(temporary, indexHtml, patches, {
          rendererVersion: "1.24013.0",
        }),
      ).rejects.toThrow(/retired-gate/u);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });

  it("reports every unresolved patch while candidate mode keeps compatible edits", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "renderer-report-"));
    try {
      const indexHtml = '<script type="module" src="/entry.js"></script>';
      await writeFile(path.join(temporary, "index.html"), indexHtml);
      await writeFile(path.join(temporary, "entry.js"), "keep-me");
      const patches = [
        { id: "portable", find: "keep-me", replace: "patched" },
        { id: "missing-one", find: "not-here", replace: "one" },
        { id: "missing-two", find: "also-absent", replace: "two" },
      ] as const;

      const candidate = await applyClientPatchSet(
        temporary,
        indexHtml,
        patches,
        { mode: "compatible" },
      );
      expect(candidate.report).toMatchObject({ applied: 1, unresolved: 2 });
      expect(candidate.report.results.map((result) => result.status)).toEqual([
        "applied",
        "missing",
        "missing",
      ]);
      await expect(
        applyClientPatchSet(temporary, indexHtml, patches),
      ).rejects.toThrow(/missing-one[\s\S]*missing-two/u);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
