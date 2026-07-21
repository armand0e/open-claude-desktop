import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows package identity", () => {
  it("pins every visible identity field to Open-Claude 0.2.1", async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve("package.json"), "utf8"),
    ) as Record<string, any>;
    expect(manifest).toEqual(
      expect.objectContaining({
        name: "open-claude",
        productName: "Open-Claude",
        version: "0.2.1",
        description: expect.stringContaining("local-first"),
        author: "Open-Claude contributors",
      }),
    );
    expect(manifest.build).toEqual(
      expect.objectContaining({
        appId: "io.openclaude.desktop",
        productName: "Open-Claude",
      }),
    );
    expect(manifest.build.win).toEqual(
      expect.objectContaining({
        executableName: "Open-Claude",
        icon: ".package-assets/icon.ico",
      }),
    );
    expect(manifest.build.nsis).toEqual(
      expect.objectContaining({
        shortcutName: "Open-Claude",
        uninstallDisplayName: "Open-Claude",
        installerIcon: ".package-assets/icon.ico",
        uninstallerIcon: ".package-assets/icon.ico",
        installerHeaderIcon: ".package-assets/icon.ico",
      }),
    );
  });

  it("stages a real multi-resolution Windows ICO", async () => {
    const icon = await readFile(path.resolve(".package-assets", "icon.ico"));
    expect(icon.readUInt16LE(0)).toBe(0);
    expect(icon.readUInt16LE(2)).toBe(1);
    const count = icon.readUInt16LE(4);
    const sizes: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const offset = 6 + index * 16;
      sizes.push(icon[offset] || 256);
      expect(icon.readUInt16LE(offset + 6)).toBe(32);
      const imageOffset = icon.readUInt32LE(offset + 12);
      expect(icon.subarray(imageOffset, imageOffset + 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
    }
    expect(sizes).toEqual([16, 20, 24, 32, 40, 48, 64, 128, 256]);
  });
});
