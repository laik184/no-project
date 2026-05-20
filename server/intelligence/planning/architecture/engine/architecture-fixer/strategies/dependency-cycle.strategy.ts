import type { FixableViolation, FixAction } from "../types.js";

export class DependencyCycleStrategy {
  readonly name = 'dependency-cycle';

  supports(violation: FixableViolation): boolean {
    return violation.kind === 'DEPENDENCY_CYCLE';
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    return Object.freeze([
      Object.freeze<FixAction>({
        actionId: `dc-extract-${violation.id}`,
        violationId: violation.id,
        type: "EXTRACT_INTERFACE",
        reason: "Extract interface to break cycle",
        params: Object.freeze({ source: violation.source }),
        priority: 1,
      }),
      Object.freeze<FixAction>({
        actionId: `dc-rewrite-${violation.id}`,
        violationId: violation.id,
        type: "REWRITE_IMPORT",
        reason: "Rewrite imports to use extracted interface",
        params: Object.freeze({ source: violation.source }),
        priority: 2,
      }),
    ]);
  }
}
