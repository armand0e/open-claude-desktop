import path from "node:path";

export const TRUSTED_REMOTE_ORIGINS = new Set([
  "https://claude.ai",
  "https://preview.claude.ai",
  "https://claude.com",
  "https://preview.claude.com",
]);

export function originOf(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
  } catch {
    return null;
  }
}

export function isTrustedRendererUrl(
  rawUrl: string,
  allowDevelopment = false,
): boolean {
  try {
    const url = new URL(rawUrl);
    const origin = originOf(rawUrl);
    if (origin && TRUSTED_REMOTE_ORIGINS.has(origin)) return true;
    if (origin === "app://localhost") return true;
    if (url.protocol === "file:") return true;
    return (
      allowDevelopment &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname.endsWith(".ant.dev"))
    );
  } catch {
    return false;
  }
}

export function isRemoteWebRendererUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "[::1]"
    );
  } catch {
    // An invalid sender URL must never gain privileged service access.
    return true;
  }
}

export function resolveInside(
  root: string,
  requestPath: string,
): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const absoluteRoot = path.resolve(root);
  const candidate = path.resolve(
    absoluteRoot,
    `.${path.sep}${decoded.replace(/^[/\\]+/, "")}`,
  );
  const relative = path.relative(absoluteRoot, candidate);
  if (relative === "") return candidate;
  if (
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  )
    return null;
  return candidate;
}
