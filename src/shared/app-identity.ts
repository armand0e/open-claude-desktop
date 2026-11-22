import path from "node:path";

export const LOCAL_APP_NAME = "Open-Claude";
export const LOCAL_APP_STORAGE_DIRECTORY = "Open-Claude";
export const LOCAL_APP_USER_MODEL_ID = "io.openclaude.desktop";
export const LOCAL_DEEP_LINK_PREFIX = "open-claude://";
export const LOCAL_PROFILE_ENV = "OPEN_CLAUDE_USER_DATA_DIR";

export interface LocalProfilePaths {
  userData: string;
  sessionData: string;
  cache: string;
  logs: string;
  crashDumps: string;
}

export interface LocalProfilePathOptions {
  packaged?: boolean;
  temporaryRoot?: string;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  );
}

export function localProfilePaths(
  appDataPath: string,
  override?: string,
  options: LocalProfilePathOptions = {},
): LocalProfilePaths {
  const defaultProfile = path.join(appDataPath, LOCAL_APP_STORAGE_DIRECTORY);
  const requestedProfile = override?.trim()
    ? path.resolve(override)
    : path.resolve(defaultProfile);
  if (
    override?.trim() &&
    options.packaged === true &&
    (!options.temporaryRoot ||
      !isInside(options.temporaryRoot, requestedProfile))
  )
    throw new Error(
      `${LOCAL_PROFILE_ENV} may only select an isolated temporary profile in packaged builds`,
    );
  const userData = requestedProfile;
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
