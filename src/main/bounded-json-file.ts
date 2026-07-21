import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { open, realpath, rename, stat } from "node:fs/promises";
import path from "node:path";

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

export async function readBoundedJsonFile(
  filePath: string,
  maxBytes: number,
  label: string,
): Promise<unknown | null> {
  let expected: string;
  try {
    expected = await realpath(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Unable to inspect ${label}`, { cause: error });
  }
  if (!samePath(expected, filePath))
    throw new Error(`${label} is not a safe regular file`);
  const handle = await open(
    expected,
    fsConstants.O_RDONLY |
      (process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW),
  );
  let bytes: Buffer;
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error(`${label} is not a regular file`);
    if (info.size > maxBytes)
      throw new Error(`${label} exceeds its ${maxBytes} byte safety limit`);
    const confirmed = await realpath(expected);
    if (!samePath(expected, confirmed))
      throw new Error(`${label} changed while it was being opened`);
    const confirmedInfo = await stat(confirmed);
    if (confirmedInfo.dev !== info.dev || confirmedInfo.ino !== info.ino)
      throw new Error(`${label} changed while it was being opened`);
    bytes = await handle.readFile();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) throw error;
    throw new Error(`Unable to read ${label}`, { cause: error });
  } finally {
    await handle.close();
  }
  // The file can change between stat() and readFile(). Re-check the bytes we
  // actually received so a concurrent writer cannot bypass the size bound.
  if (bytes.byteLength > maxBytes)
    throw new Error(`${label} exceeds its ${maxBytes} byte safety limit`);
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} contains invalid UTF-8`, { cause: error });
  }
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`${label} contains invalid JSON`, { cause: error });
  }
}

export async function readRecoverableBoundedJsonFile(
  filePath: string,
  maxBytes: number,
  label: string,
): Promise<unknown | null> {
  try {
    return await readBoundedJsonFile(filePath, maxBytes, label);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Recover only from content/size corruption. Access failures may be
    // transient or permission-related and must remain visible to the caller.
    if (
      !message.includes("invalid JSON") &&
      !message.includes("invalid UTF-8") &&
      !message.includes("safety limit")
    )
      throw error;
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) throw error;
    const quarantine = `${filePath}.corrupt-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}-${randomUUID()}`;
    try {
      await rename(filePath, quarantine);
    } catch (quarantineError) {
      throw new Error(`Unable to quarantine corrupt ${label}`, {
        cause: quarantineError,
      });
    }
    return null;
  }
}

export function assertBoundedJson(
  serialized: string,
  maxBytes: number,
  label: string,
): void {
  if (Buffer.byteLength(serialized, "utf8") > maxBytes)
    throw new Error(`${label} exceeds its ${maxBytes} byte safety limit`);
}
