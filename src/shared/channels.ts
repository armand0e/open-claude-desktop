const CHANNEL_PATTERN =
  /^\$eipc_(message|event)\$_([^_]+)_\$_(.+?)_\$_([^_]+)_\$_(.+)$/;

export interface ParsedChannel {
  readonly channel: string;
  readonly kind: "message" | "event";
  readonly generatorId: string;
  readonly namespace: string;
  readonly service: string;
  readonly method: string;
}

export function parseChannel(channel: string): ParsedChannel | null {
  const match = CHANNEL_PATTERN.exec(channel);
  if (!match) return null;
  return {
    channel,
    kind: match[1] as ParsedChannel["kind"],
    generatorId: match[2],
    namespace: match[3],
    service: match[4],
    method: match[5],
  };
}

export function serviceKey(
  parsed: Pick<ParsedChannel, "namespace" | "service">,
): string {
  return `${parsed.namespace}.${parsed.service}`;
}

export function isStoreRead(method: string): boolean {
  return (
    method.endsWith("_$store$_getState") ||
    method.endsWith("_$store$_getStateSync")
  );
}

export function storeNameFromMethod(method: string): string | null {
  const marker = "_$store$_";
  const index = method.indexOf(marker);
  return index === -1 ? null : method.slice(0, index);
}
