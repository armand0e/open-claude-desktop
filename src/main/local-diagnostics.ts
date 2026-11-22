import { appendFile, rename, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const MAX_LOG_BYTES = 32 * 1024 * 1024;
const ROTATE_EVERY_RECORDS = 256;
const MAX_STRING_CHARS = 4_096;
const SECRET_FIELD =
  /(?:api[_-]?key|authorization|cookie|credential|password|secret|token|prompt|content|body|payload|message|stack|attachment|audio|command|stdout|stderr|output|path|url)/i;
const SAFE_TEXT_FIELD =
  /^(?:scope|event|level|name|kind|type|status|state|phase|mode|method|service|channel|category|transport|preset|model|platform|arch|protocol|operation|source|target|reasonCode|[a-z]+Id)$/i;

export type DiagnosticsDetails = Record<string, unknown>;

/**
 * A durable, append-only trace for diagnosing the local desktop runtime.
 *
 * This intentionally records complete control-flow metadata rather than chat
 * bodies or credentials. A handoff archive is safe to share by default while
 * still showing the order, latency, status, and failure point of every local
 * operation.
 */
export class LocalDiagnostics {
  readonly filePath: string;
  #sequence = 0;
  #writes = Promise.resolve();

  constructor(logDirectory: string) {
    this.filePath = path.join(logDirectory, "diagnostics.jsonl");
  }

  record(
    scope: string,
    event: string,
    details: DiagnosticsDetails = {},
    level: "debug" | "info" | "warn" | "error" = "debug",
  ): void {
    const sequence = ++this.#sequence;
    const entry = JSON.stringify({
      version: 1,
      at: new Date().toISOString(),
      sequence,
      level,
      scope,
      event,
      details: sanitizeDiagnosticValue(details),
    });
    this.#writes = this.#writes
      .catch(() => undefined)
      .then(async () => {
        if (sequence % ROTATE_EVERY_RECORDS === 0) await this.#rotateIfNeeded();
        await appendFile(this.filePath, `${entry}\n`, { encoding: "utf8" });
      })
      // Diagnostics must never take down the app path that it is observing.
      .catch(() => undefined);
  }

  async flush(): Promise<void> {
    await this.#writes;
  }

  async #rotateIfNeeded(): Promise<void> {
    const size = await stat(this.filePath)
      .then((value) => value.size)
      .catch(() => 0);
    if (size < MAX_LOG_BYTES) return;
    const rotated = `${this.filePath}.1`;
    await rm(rotated, { force: true }).catch(() => undefined);
    await rename(this.filePath, rotated).catch(() => undefined);
  }
}

export function diagnosticError(error: unknown): DiagnosticsDetails {
  const value = error instanceof Error ? error.message : String(error);
  return {
    name: error instanceof Error ? error.name : typeof error,
    messageLength: value.length,
    messageFingerprint: createHash("sha256")
      .update(value)
      .digest("hex")
      .slice(0, 16),
    ...(error instanceof Error && error.stack
      ? { stackFrameCount: error.stack.split("\n").length }
      : {}),
  };
}

export function diagnosticShape(value: unknown): unknown {
  return sanitizeDiagnosticValue(value);
}

function sanitizeDiagnosticValue(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth >= 12) return { truncated: true };
  if (SECRET_FIELD.test(key))
    return typeof value === "string"
      ? { redacted: true, length: value.length }
      : { redacted: true, type: Array.isArray(value) ? "array" : typeof value };
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (typeof value === "string")
    return SAFE_TEXT_FIELD.test(key)
      ? value.length > MAX_STRING_CHARS
        ? `${value.slice(0, MAX_STRING_CHARS)}…[truncated:${value.length}]`
        : value
      : {
          redacted: true,
          length: value.length,
          fingerprint: createHash("sha256")
            .update(value)
            .digest("hex")
            .slice(0, 16),
        };
  if (value instanceof Error) return diagnosticError(value);
  if (typeof value === "object") {
    if (seen.has(value)) return { truncated: true };
    seen.add(value);
  }
  if (Array.isArray(value))
    return value
      .slice(0, 64)
      .map((item) => sanitizeDiagnosticValue(item, "", depth + 1, seen));
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(input)
        .slice(0, 64)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitizeDiagnosticValue(entryValue, entryKey, depth + 1, seen),
        ]),
    );
  }
  return String(value);
}
