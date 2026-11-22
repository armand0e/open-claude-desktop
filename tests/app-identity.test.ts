import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isLocalDeepLink,
  LOCAL_APP_NAME,
  LOCAL_APP_STORAGE_DIRECTORY,
  LOCAL_APP_USER_MODEL_ID,
  LOCAL_DEEP_LINK_PREFIX,
  LOCAL_PROFILE_ENV,
  localProfilePaths,
} from "../src/shared/app-identity";

describe("standalone application identity", () => {
  it("uses names that cannot collide with Anthropic Claude Desktop", () => {
    expect(LOCAL_APP_NAME).toBe("Open-Claude");
    expect(LOCAL_APP_STORAGE_DIRECTORY).toBe("Open-Claude");
    expect(LOCAL_APP_USER_MODEL_ID).not.toContain("com.anthropic");
    expect(LOCAL_DEEP_LINK_PREFIX).toBe("open-claude://");
    expect(LOCAL_PROFILE_ENV).toBe("OPEN_CLAUDE_USER_DATA_DIR");
  });

  it("keeps every mutable Electron path beneath the local profile", () => {
    const appData = path.resolve("C:/Users/test/AppData/Roaming");
    const paths = localProfilePaths(appData);
    const expectedRoot = path.join(appData, "Open-Claude");
    expect(paths.userData).toBe(expectedRoot);
    for (const candidate of Object.values(paths)) {
      expect(path.relative(expectedRoot, candidate)).not.toMatch(/^\.\./);
      expect(candidate).not.toContain(`${path.sep}Claude${path.sep}`);
    }
  });

  it("allows arbitrary overrides only in development", () => {
    const override = path.resolve("C:/isolated/local-profile");
    expect(localProfilePaths("C:/ignored", override).userData).toBe(override);
    expect(isLocalDeepLink("open-claude://chat/123")).toBe(true);
    expect(isLocalDeepLink("claude-local://chat/123")).toBe(false);
    expect(isLocalDeepLink("claude://chat/123")).toBe(false);
  });

  it("restricts packaged profile overrides to an isolated temporary child", () => {
    const temporaryRoot = path.resolve("C:/Users/test/AppData/Local/Temp");
    const isolated = path.join(temporaryRoot, "open-claude-probe-123");
    expect(
      localProfilePaths("C:/ignored", isolated, {
        packaged: true,
        temporaryRoot,
      }).userData,
    ).toBe(isolated);
    expect(() =>
      localProfilePaths("C:/ignored", "C:/Users/test/.claude", {
        packaged: true,
        temporaryRoot,
      }),
    ).toThrow(/temporary profile/);
    expect(() =>
      localProfilePaths("C:/ignored", temporaryRoot, {
        packaged: true,
        temporaryRoot,
      }),
    ).toThrow(/temporary profile/);
  });
});
