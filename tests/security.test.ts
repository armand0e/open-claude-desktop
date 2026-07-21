import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileAccessPolicy, isPathInside } from "../src/main/file-access";
import {
  isRemoteWebRendererUrl,
  isTrustedRendererUrl,
  resolveInside,
} from "../src/shared/security";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("renderer and protocol boundaries", () => {
  it("recognizes only the intended production origins", () => {
    expect(isTrustedRendererUrl("https://claude.ai/new")).toBe(true);
    expect(isTrustedRendererUrl("app://localhost/assets/app.js")).toBe(true);
    expect(isTrustedRendererUrl("https://evil.example/claude.ai")).toBe(false);
    expect(isTrustedRendererUrl("https://claude.ai.evil.example")).toBe(false);
    expect(isTrustedRendererUrl("javascript:alert(1)")).toBe(false);
    expect(isTrustedRendererUrl("http://localhost:5173", true)).toBe(true);
    expect(isTrustedRendererUrl("https://branch.ant.dev", true)).toBe(true);
    expect(isTrustedRendererUrl("ftp://localhost/client", true)).toBe(false);
    expect(isTrustedRendererUrl("file://localhost/client", true)).toBe(true);
    expect(isRemoteWebRendererUrl("http://localhost:5173/app")).toBe(false);
    expect(isRemoteWebRendererUrl("app://localhost/new")).toBe(false);
    expect(isRemoteWebRendererUrl("https://branch.ant.dev/app")).toBe(true);
    expect(isRemoteWebRendererUrl("http://branch.ant.dev/app")).toBe(true);
    expect(isRemoteWebRendererUrl("not a URL")).toBe(true);
  });

  it("prevents app protocol path traversal", () => {
    const root = path.resolve("C:/virtual/ion-dist");
    expect(resolveInside(root, "/assets/app.js")).toBe(
      path.join(root, "assets", "app.js"),
    );
    expect(resolveInside(root, "/../../secret.txt")).toBeNull();
    expect(resolveInside(root, "/%2e%2e/%2e%2e/secret.txt")).toBeNull();
    expect(resolveInside(root, "/%E0%A4%A")).toBeNull();
  });
});

describe("filesystem capability policy", () => {
  it("limits exact-file grants and directory grants", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "claude-reconstruction-"),
    );
    temporaryDirectories.push(root);
    const nested = path.join(root, "nested");
    await mkdir(nested);
    const grantedFile = path.join(root, "granted.txt");
    const siblingFile = path.join(root, "sibling.txt");
    const nestedFile = path.join(nested, "nested.txt");
    await Promise.all([
      writeFile(grantedFile, "granted"),
      writeFile(siblingFile, "sibling"),
      writeFile(nestedFile, "nested"),
    ]);

    const exactPolicy = new FileAccessPolicy();
    await exactPolicy.grantFile(grantedFile);
    await expect(exactPolicy.requireFile(grantedFile)).resolves.toBe(
      path.resolve(grantedFile),
    );
    await expect(exactPolicy.requireFile(siblingFile)).rejects.toThrow(
      "not granted",
    );

    const rootPolicy = new FileAccessPolicy();
    await rootPolicy.grantRoot(root);
    await expect(rootPolicy.requireFile(nestedFile)).resolves.toBe(
      path.resolve(nestedFile),
    );
    await expect(rootPolicy.requireRoot(nested)).resolves.toBe(
      path.resolve(nested),
    );
    expect(isPathInside(root, nestedFile)).toBe(true);
    expect(isPathInside(root, path.resolve(root, "..", "outside.txt"))).toBe(
      false,
    );

    const percentFile = path.join(root, "literal%20name.txt");
    await writeFile(percentFile, "percent");
    const percentPolicy = new FileAccessPolicy();
    await expect(percentPolicy.grantFile(percentFile)).resolves.toBe(
      path.resolve(percentFile),
    );
    await expect(percentPolicy.requireFile(percentFile)).resolves.toBe(
      path.resolve(percentFile),
    );

    const encodedNullFile = path.join(root, "literal%00name.txt");
    await writeFile(
      encodedNullFile,
      "must not be selected through encoded NUL",
    );
    await expect(percentPolicy.grantFile(encodedNullFile)).rejects.toThrow(
      "null byte",
    );

    const spacedFile = path.join(root, "encoded name.txt");
    await writeFile(spacedFile, "encoded");
    const encodedPolicy = new FileAccessPolicy();
    await encodedPolicy.grantFile(spacedFile);
    await expect(
      encodedPolicy.requireFile(encodeURIComponent(spacedFile)),
    ).resolves.toBe(path.resolve(spacedFile));
  });
});
