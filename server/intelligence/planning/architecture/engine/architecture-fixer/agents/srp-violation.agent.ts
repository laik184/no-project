import type { FixAction, FixableViolation } from "../types.js";
import type { FixStrategy } from "../types.js";

export class SrpViolationStrategy implements FixStrategy {
  readonly kind = "SRP_VIOLATION" as const;

  supports(violation: FixableViolation): boolean {
    return violation.kind === this.kind;
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    const moduleBase = violation.source.replace(/\.ts$/, "");

    return Object.freeze([
      Object.freeze({
        actionId: `${violation.id}-split`,
        violationId: violation.id,
        type: "SPLIT_FILE" as const,
        reason: "Split multi-responsibility file into focused modules.",
        params: Object.freeze({
          source: violation.source,
          primary: `${moduleBase}.core.ts`,
          secondary: `${moduleBase}.helpers.ts`,
        }),
        priority: 10,
      }),
      Object.freeze({
        actionId: `${violation.id}-rewrite-index`,
        violationId: violation.id,
        type: "REWRITE_IMPORT" as const,
        reason: "Update import surface after file split.",
        params: Object.freeze({ file: violation.source }),
        priority: 20,
      }),
    ]);
  }
}
