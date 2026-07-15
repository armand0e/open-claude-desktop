import { contextBridge, ipcRenderer } from "electron";
import { PRELOAD_CHANNELS } from "../generated/ipc-contract";
import { parseChannel } from "../shared/channels";

// The retained desktop client legitimately mounts more than Node's default ten
// independent store subscriptions on several shared IPC event channels.
// Electron's warning is therefore a false positive, while unsubscriptions are
// still handled per callback below.
ipcRenderer.setMaxListeners(100);

type BridgeObject = Record<string, unknown>;
type Callback = (...args: unknown[]) => void;

function isTrustedRendererUrl(
  rawUrl: string,
  allowDevelopment: boolean,
): boolean {
  try {
    const url = new URL(rawUrl);
    // WebContentsView preloads execute once against the initial about:blank
    // document before the already-guarded main-frame navigation commits.
    if (url.href === "about:blank") return true;
    const origin =
      url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
    if (
      [
        "https://claude.ai",
        "https://preview.claude.ai",
        "https://claude.com",
        "https://preview.claude.com",
        "app://localhost",
      ].includes(origin)
    )
      return true;
    if (url.protocol === "file:") return true;
    return (
      allowDevelopment &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".ant.dev"))
    );
  } catch {
    return false;
  }
}

function setPath(
  target: BridgeObject,
  path: readonly string[],
  value: unknown,
): void {
  let current = target;
  for (const segment of path.slice(0, -1)) {
    const existing = current[segment];
    if (!existing || typeof existing !== "object" || Array.isArray(existing))
      current[segment] = {};
    current = current[segment] as BridgeObject;
  }
  current[path.at(-1)!] = value;
}

function methodFor(
  contract: (typeof PRELOAD_CHANNELS)[number],
): (...args: unknown[]) => unknown {
  if ((contract.rendererOperations as readonly string[]).includes("sendSync")) {
    return (...args: unknown[]) => {
      const response = ipcRenderer.sendSync(contract.channel, ...args) as
        { result?: unknown; error?: string } | null | undefined;
      if (!response)
        throw new Error(`No reply for synchronous IPC ${contract.channel}`);
      if (response.error) throw new Error(response.error);
      return response.result;
    };
  }

  if ((contract.rendererOperations as readonly string[]).includes("invoke")) {
    return (...args: unknown[]) =>
      ipcRenderer.invoke(contract.channel, ...args);
  }

  return (callback: unknown) => {
    if (typeof callback !== "function")
      throw new TypeError("Event subscription requires a callback");
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      (callback as Callback)(...args);
    ipcRenderer.on(contract.channel, listener);
    return () => ipcRenderer.removeListener(contract.channel, listener);
  };
}

export function exposeContract(
  preloadFile: string,
): Record<string, BridgeObject> {
  const allowDevelopment = process.env.CLAUDE_ALLOW_DEV_ORIGINS === "1";
  if (!isTrustedRendererUrl(window.location.href, allowDevelopment)) return {};

  const namespaces: Record<string, BridgeObject> = {};
  for (const contract of PRELOAD_CHANNELS) {
    if (!(contract.files as readonly string[]).includes(preloadFile)) continue;
    const parsed = parseChannel(contract.channel);
    const publicPath = contract.publicPaths[0];
    if (!parsed || !publicPath) continue;
    const namespace = (namespaces[parsed.namespace] ??= {});
    const service = (namespace[parsed.service] ??= {}) as BridgeObject;
    setPath(service, publicPath.split("."), methodFor(contract));
  }

  for (const [namespace, value] of Object.entries(namespaces)) {
    contextBridge.exposeInMainWorld(namespace, value);
  }
  return namespaces;
}

export function exposeSanitizedProcess(appVersion: string): void {
  contextBridge.exposeInMainWorld("process", {
    arch: process.arch,
    platform: process.platform,
    type: process.type,
    versions: process.versions,
    version: appVersion,
    env: process.env.CI ? { CI: process.env.CI } : {},
  });
  contextBridge.exposeInMainWorld("desktopEssentialTelemetryDisabled", true);
}

export function argumentJson(prefix: string): unknown {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  if (!argument) return undefined;
  try {
    return JSON.parse(argument.slice(prefix.length));
  } catch {
    return undefined;
  }
}
