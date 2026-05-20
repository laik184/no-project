import type { FixableViolation, FixAction } from "../types.js";

export class DomainLeakageStrategy {
  readonly name = 'domain-leakage';

  supports(violation: FixableViolation): boolean {
    return violation.kind === 'DOMAIN_LEAKAGE';
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    return Object.freeze([
      Object.freeze<FixAction>({
        actionId: `dl-move-${violation.id}`,
        violationId: violation.id,
        type: "MOVE_FILE",
        reason: "Move file to correct domain boundary",
        params: Object.freeze({ source: violation.source }),
        priority: 1,
      }),
      Object.freeze<FixAction>({
        actionId: `dl-rewrite-${violation.id}`,
        violationId: violation.id,
        type: "REWRITE_IMPORT",
        reason: "Rewrite imports after domain move",
        params: Object.freeze({ source: violation.source }),
        priority: 2,
      }),
    ]);
  }
}
