import type { FixableViolation, FixAction } from "../types.js";

export class LayerViolationStrategy {
  readonly name = 'layer-violation';

  supports(violation: FixableViolation): boolean {
    return violation.kind === 'LAYER_VIOLATION';
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    return Object.freeze([
      Object.freeze<FixAction>({
        actionId: `la-move-${violation.id}`,
        violationId: violation.id,
        type: "MOVE_FILE",
        reason: "Move file to correct layer",
        params: Object.freeze({ source: violation.source }),
        priority: 1,
      }),
      Object.freeze<FixAction>({
        actionId: `la-rewrite-${violation.id}`,
        violationId: violation.id,
        type: "REWRITE_IMPORT",
        reason: "Rewrite import after file move",
        params: Object.freeze({ source: violation.source }),
        priority: 2,
      }),
    ]);
  }
}
