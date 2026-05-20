import type { FixableViolation, FixAction } from "../types.js";

export class SrpViolationStrategy {
  readonly name = 'srp-violation';

  supports(violation: FixableViolation): boolean {
    return violation.kind === 'SRP_VIOLATION';
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    return Object.freeze([
      Object.freeze<FixAction>({
        actionId: `srp-split-${violation.id}`,
        violationId: violation.id,
        type: "SPLIT_FILE",
        reason: "Split file to enforce single responsibility",
        params: Object.freeze({ source: violation.source }),
        priority: 1,
      }),
      Object.freeze<FixAction>({
        actionId: `srp-rewrite-${violation.id}`,
        violationId: violation.id,
        type: "REWRITE_IMPORT",
        reason: "Rewrite imports after file split",
        params: Object.freeze({ source: violation.source }),
        priority: 2,
      }),
    ]);
  }
}
