import { describe, expect, it } from "vitest";
import policy from "../analysis/compatibility-policy.json";
import { IPC_SERVICES } from "../src/generated/ipc-contract";

describe("explicit compatibility policy", () => {
  it("classifies every retained compatibility method by exact qualified name", () => {
    const services = [
      ...policy.compatibilityOnlyServices,
      ...policy.fallbackServices,
    ];
    const expected = services.flatMap((service) =>
      IPC_SERVICES[service as keyof typeof IPC_SERVICES].methods.map(
        ({ method }) => `${service}.${method}`,
      ),
    );
    expect(Object.keys(policy.methods).sort()).toEqual(
      [...new Set(expected)].sort(),
    );
  });

  it("fails closed for mutation-shaped methods except named renderer signals", () => {
    const mutation =
      /^(?:delete|remove|set|update|write|save|archive|unarchive|stop|interrupt|cancel|clear|report|notify|mark|revoke|respond|replace|disconnect|detach|close|hide|show|focus|resize|navigate|open|request|submit|sync|warm|prepare|patch|apply|add|install|uninstall|start|run)/;
    const signals = new Set(policy.rendererSignals);
    for (const [qualifiedMethod, outcome] of Object.entries(policy.methods)) {
      const method = qualifiedMethod.slice(
        qualifiedMethod.lastIndexOf(".") + 1,
      );
      if (!mutation.test(method)) continue;
      expect(
        outcome === "unavailable" ||
          (outcome === "renderer-signal" && signals.has(qualifiedMethod)),
        qualifiedMethod,
      ).toBe(true);
    }
  });
});
