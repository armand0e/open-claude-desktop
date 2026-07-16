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
    expect(LOCAL_APP_NAME).toBe("Claude Local");
    expect(LOCAL_APP_STORAGE_DIRECTORY).toBe("Claude Local");
    expect(LOCAL_APP_USER_MODEL_ID).not.toContain("com.anthropic");
    expect(LOCAL_DEEP_LINK_PREFIX).toBe("claude-local://");
    expect(LOCAL_PROFILE_ENV).toBe("CLAUDE_LOCAL_USER_DATA_DIR");
  });

  it("keeps every mutable Electron path beneath the local profile", () => {
    const appData = path.resolve("C:/Users/test/AppData/Roaming");
    const paths = localProfilePaths(appData);
    const expectedRoot = path.join(appData, "Claude Local");
    expect(paths.userData).toBe(expectedRoot);
    for (const candidate of Object.values(paths)) {
      expect(path.relative(expectedRoot, candidate)).not.toMatch(/^\.\./);
      expect(candidate).not.toContain(`${path.sep}Claude${path.sep}`);
    }
  });

  it("honors only the explicit local profile override", () => {
    const override = path.resolve("C:/isolated/local-profile");
    expect(localProfilePaths("C:/ignored", override).userData).toBe(override);
    expect(isLocalDeepLink("claude-local://chat/123")).toBe(true);
    expect(isLocalDeepLink("claude://chat/123")).toBe(false);
  });
});
