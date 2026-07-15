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
  // The original bundle delegates these cases to generated structural validators.
  // The derived report records that boundary without pretending the minified
  // validator name is a useful public type.
  return expected.some((part) => part.includes("validated"));
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
