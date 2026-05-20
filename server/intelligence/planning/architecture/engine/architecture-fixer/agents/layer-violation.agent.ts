import type { FixAction, FixableViolation } from "../types.js";
import type { FixStrategy } from "../types.js";

function buildLayerTargetPath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  if (normalized.includes("/domain/")) return normalized;
  if (normalized.includes("/orchestrator/")) {
    return normalized.replace("/orchestrator/", "/domain/");
  }
  if (normalized.includes("/infrastructure/")) return normalized;
  return normalized.replace("/", "/domain/");
}

export class LayerViolationStrategy implements FixStrategy {
  readonly kind = "LAYER_VIOLATION" as const;

  supports(violation: FixableViolation): boolean {
    return violation.kind === this.kind;
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    const destination = buildLayerTargetPath(violation.source);

    return Object.freeze([
      Object.freeze({
        actionId: `${violation.id}-move`,
        violationId: violation.id,
        type: "MOVE_FILE" as const,
        reason: "Move file to layer-compliant location.",
        params: Object.freeze({ from: violation.source, to: destination }),
        priority: 10,
      }),
      Object.freeze({
        actionId: `${violation.id}-import-rewrite`,
        violationId: violation.id,
        type: "REWRITE_IMPORT" as const,
        reason: "Rewrite imports after file move.",
        params: Object.freeze({ file: destination, from: violation.source }),
        priority: 20,
      }),
    ]);
  }
}
