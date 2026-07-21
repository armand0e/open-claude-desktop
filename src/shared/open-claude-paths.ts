export const OPEN_CLAUDE_DIRECTORY = ".open-claude";
export const RESERVED_CLAUDE_DIRECTORY = ".claude";

export function hasReservedClaudePathSegment(candidate: string): boolean {
  return candidate
    .replaceAll("\\", "/")
    .split("/")
    .some((segment) => segment.toLowerCase() === RESERVED_CLAUDE_DIRECTORY);
}

export function assertNotReservedClaudePath(candidate: string): void {
  if (hasReservedClaudePathSegment(candidate))
    throw new Error(
      `${RESERVED_CLAUDE_DIRECTORY} is reserved for Anthropic Claude and is not accessible to Open-Claude tools`,
    );
}
