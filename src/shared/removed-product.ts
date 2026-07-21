export const REMOVED_COWORK_MESSAGE =
  "Cowork has been removed from Open-Claude. Use local Chat, Code, or Routines.";

export function isRemovedCoworkService(
  namespace: string,
  service: string,
): boolean {
  return (
    namespace.startsWith("claude.cowork") ||
    service.startsWith("Cowork") ||
    service === "LocalAgentModeSessions" ||
    service === "AgentModeFeedback" ||
    service === "ClaudeVM"
  );
}

export function isRemovedCoworkHttpPath(pathname: string): boolean {
  return /(?:^|\/)cowork(?:\/|$)/i.test(pathname);
}
