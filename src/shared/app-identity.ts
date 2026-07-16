import path from "node:path";

export const LOCAL_APP_NAME = "Claude Local";
export const LOCAL_APP_STORAGE_DIRECTORY = "Claude Local";
export const LOCAL_APP_USER_MODEL_ID = "io.github.claude-local.desktop";
export const LOCAL_DEEP_LINK_PREFIX = "claude-local://";
export const LOCAL_PROFILE_ENV = "CLAUDE_LOCAL_USER_DATA_DIR";

export interface LocalProfilePaths {
  userData: string;
  sessionData: string;
  cache: string;
  logs: string;
  crashDumps: string;
}

export function localProfilePaths(
  appDataPath: string,
  override?: string,
): LocalProfilePaths {
  const userData = path.resolve(
    override || path.join(appDataPath, LOCAL_APP_STORAGE_DIRECTORY),
  );
  return {
    userData,
    sessionData: path.join(userData, "Session Data"),
    cache: path.join(userData, "Cache"),
    logs: path.join(userData, "Logs"),
    crashDumps: path.join(userData, "Crashpad"),
  };
}

export function isLocalDeepLink(value: string): boolean {
  return value.toLowerCase().startsWith(LOCAL_DEEP_LINK_PREFIX);
}
