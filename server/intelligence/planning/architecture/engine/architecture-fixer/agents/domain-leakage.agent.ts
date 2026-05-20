import type { FixAction, FixableViolation } from "../types.js";
import type { FixStrategy } from "../types.js";

function toDomainPath(source: string): string {
  if (source.includes("/domain/")) return source;
  if (source.includes("/infrastructure/")) return source.replace("/infrastructure/", "/domain/");
  return `domain/${source}`.replace(/\/\/+/g, "/");
}

export class DomainLeakageStrategy implements FixStrategy {
  readonly kind = "DOMAIN_LEAKAGE" as const;

  supports(violation: FixableViolation): boolean {
    return violation.kind === this.kind;
  }

  buildActions(violation: FixableViolation): readonly FixAction[] {
    const domainPath = toDomainPath(violation.source);

    return Object.freeze([
      Object.freeze({
        actionId: `${violation.id}-isolate-domain`,
        violationId: violation.id,
        type: "MOVE_FILE" as const,
        reason: "Move leaked domain logic to domain layer.",
        params: Object.freeze({ from: violation.source, to: domainPath }),
        priority: 10,
      }),
      Object.freeze({
        actionId: `${violation.id}-rewrite-imports`,
        violationId: violation.id,
        type: "REWRITE_IMPORT" as const,
        reason: "Update import paths after domain isolation.",
        params: Object.freeze({ file: domainPath, previous: violation.source }),
        priority: 20,
      }),
    ]);
  }
}
