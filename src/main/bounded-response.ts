import { open, rm } from "node:fs/promises";

export async function readResponseBytes(
  response: Response,
  maxBytes: number,
  label = "Response",
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`${label} exceeded ${maxBytes} bytes`);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`${label} exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

export async function readResponseText(
  response: Response,
  maxBytes: number,
  label = "Response",
): Promise<string> {
  const bytes = await readResponseBytes(response, maxBytes, label);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} returned invalid UTF-8`, { cause: error });
  }
}

export async function readResponseJson(
  response: Response,
  maxBytes: number,
  label = "Response",
): Promise<unknown> {
  const text = await readResponseText(response, maxBytes, label);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export async function writeResponseFile(
  response: Response,
  destination: string,
  maxBytes: number,
  label = "Response",
): Promise<number> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`${label} exceeded ${maxBytes} bytes`);
  }
  const handle = await open(destination, "wx", 0o600);
  let total = 0;
  try {
    if (!response.body) return 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error(`${label} exceeded ${maxBytes} bytes`);
        }
        // FileHandle.write() is allowed to complete with a partial write.
        // Keep going until the entire network chunk is durably handed off.
        let offset = 0;
        while (offset < value.byteLength) {
          const { bytesWritten } = await handle.write(
            value,
            offset,
            value.byteLength - offset,
            null,
          );
          if (bytesWritten <= 0)
            throw new Error(`${label} could not be written completely`);
          offset += bytesWritten;
        }
      }
    } finally {
      reader.releaseLock();
    }
    return total;
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(destination, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await handle.close().catch(() => undefined);
  }
}
