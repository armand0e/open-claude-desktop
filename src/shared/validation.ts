export interface RuntimeArgumentValidation {
  readonly name: string;
  readonly position: number;
  readonly validation: string;
}

function parts(validation: string): string[] {
  return validation.split("|").map((part) => part.trim());
}

export function contractValueMatches(
  value: unknown,
  validation: string,
): boolean {
  const expected = parts(validation);
  if (value === undefined) return expected.includes("undefined");
  if (value === null) return expected.includes("null");
  if (expected.includes("string[]"))
    return (
      Array.isArray(value) && value.every((item) => typeof item === "string")
    );
  if (expected.includes("number[]"))
    return (
      Array.isArray(value) && value.every((item) => typeof item === "number")
    );
  if (expected.some((part) => part.startsWith("array")))
    return Array.isArray(value);
  // The recovered bundle only tells us that a private validator ran. Its
  // schema can be an enum scalar or an object, so the strongest sound check
  // available here is presence. Null/undefined unions were handled above.
  if (expected.includes("custom schema validated"))
    return value !== null && value !== undefined;
  for (const primitive of [
    "string",
    "boolean",
    "number",
    "object",
    "function",
    "bigint",
  ] as const) {
    if (expected.includes(primitive) && typeof value === primitive) return true;
  }
  return false;
}

export function assertContractArguments(
  channel: string,
  args: readonly unknown[],
  validations: readonly RuntimeArgumentValidation[],
): void {
  for (const expected of validations) {
    if (!contractValueMatches(args[expected.position], expected.validation)) {
      throw new TypeError(
        `Argument "${expected.name}" at position ${expected.position} failed recovered validation (${expected.validation}) for ${channel}`,
      );
    }
  }
}
