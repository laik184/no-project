import type { FixAction, FixableViolation } from "../types.js";
import type { FixStrategy } from "../types.js";

export class DependencyCycleStrategy implements FixStrategy {
  readonly kind = "DEPENDENCY_CYCLE" as const;

  supports(violation: FixableViolation): boolean {
    return violation.kind === this.kind;
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    const interfacePath = `${violation.source}.port.ts`;

    return Object.freeze([
      Object.freeze({
        actionId: `${violation.id}-extract-port`,
        violationId: violation.id,
        type: "EXTRACT_INTERFACE" as const,
        reason: "Introduce stable interface to break cycle.",
        params: Object.freeze({ source: violation.source, target: interfacePath }),
        priority: 10,
      }),
      Object.freeze({
        actionId: `${violation.id}-rewrite-dep`,
        violationId: violation.id,
        type: "REWRITE_IMPORT" as const,
        reason: "Switch dependency to port interface.",
        params: Object.freeze({ file: violation.target ?? violation.source, importTo: interfacePath }),
        priority: 20,
      }),
    ]);
  }
}
