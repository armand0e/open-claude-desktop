const PASSTHROUGH_ENVIRONMENT_KEYS = new Set([
  "APPDATA",
  "COLORTERM",
  "COMSPEC",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "LOGNAME",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "PROGRAMW6432",
  "PSMODULEPATH",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
  "WINDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_RUNTIME_DIR",
]);

function validEnvironmentEntry(name: string, value: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 256 &&
    value.length <= 32_768 &&
    !name.includes("\0") &&
    !value.includes("\0") &&
    !name.includes("=")
  );
}

/**
 * Build a deliberately small child-process environment. API keys, provider
 * tokens, cookies, proxy credentials, and unrelated application state are not
 * inherited. Callers may add values that are explicit inputs to that child.
 */
export function childEnvironment(
  overrides: Record<string, string> = {},
  source: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(source))
    if (
      typeof value === "string" &&
      PASSTHROUGH_ENVIRONMENT_KEYS.has(name.toUpperCase()) &&
      validEnvironmentEntry(name, value)
    )
      environment[name] = value;
  for (const [name, value] of Object.entries(overrides))
    if (validEnvironmentEntry(name, value)) environment[name] = value;
  return environment;
}
