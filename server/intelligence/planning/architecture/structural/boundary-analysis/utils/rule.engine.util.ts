import type {
  HvpLayer,
  BoundaryViolationType,
  ViolationSeverity,
} from "../types.js";
import {
  HVP_ALLOWED_DIRECTIONS,
  FORBIDDEN_DOMAIN_PAIRS,
  INFRASTRUCTURE_DOMAINS,
} from "../types.js";

export interface RuleMatch {
  readonly violated:  boolean;
  readonly type:      BoundaryViolationType;
  readonly severity:  ViolationSeverity;
  readonly rule:      string;
  readonly detail:    string;
}

export function checkLayerDirection(
  fromLayer: HvpLayer,
  toLayer:   HvpLayer,
  fromPath:  string,
  toPath:    string,
): RuleMatch {
  const allowed = HVP_ALLOWED_DIRECTIONS[fromLayer];
  if (!allowed || !(allowed as readonly number[]).includes(toLayer)) {
    const isUpward = toLayer < fromLayer;
    return Object.freeze({
      violated: true,
      type:     isUpward ? "UPWARD_IMPORT" : "LAYER_BOUNDARY_VIOLATION",
      severity: isUpward ? "CRITICAL" : "HIGH",
      rule:     `Layer ${fromLayer} must not import from layer ${toLayer}. Allowed targets for layer ${fromLayer}: ${HVP_ALLOWED_DIRECTIONS[fromLayer]?.join(", ") ?? "none"}`,
      detail:   `"${fromPath}" (L${fromLayer}) → "${toPath}" (L${toLayer})`,
    });
  }
  return Object.freeze({
    violated: false,
    type:     "LAYER_BOUNDARY_VIOLATION",
    severity: "LOW",
    rule:     "",
    detail:   "",
  });
}

export function checkDependencyDirection(
  fromRole: string,
  toRole:   string,
  fromPath: string,
  toPath:   string,
): RuleMatch {
  const forbidden = new Map<string, readonly string[]>([
    ["util",  ["agent", "orchestrator", "service"]],
    ["state", ["agent", "orchestrator", "service"]],
    ["type",  ["agent", "orchestrator", "service", "util", "state"]],
    ["agent", ["orchestrator"]],
  ]);

  const forbiddenTargets = forbidden.get(fromRole);
  if (forbiddenTargets && (forbiddenTargets as string[]).includes(toRole)) {
    return Object.freeze({
      violated: true,
      type:     "ILLEGAL_DEPENDENCY_DIRECTION",
      severity: fromRole === "type" ? "HIGH" : "MEDIUM",
      rule:     `Role '${fromRole}' must not import from role '${toRole}'. Direction must flow from orchestrator → agent → util/type.`,
      detail:   `"${fromPath}" (${fromRole}) → "${toPath}" (${toRole})`,
    });
  }
  return Object.freeze({
    violated: false,
    type:     "ILLEGAL_DEPENDENCY_DIRECTION",
    severity: "LOW",
    rule:     "",
    detail:   "",
  });
}

export function checkDomainLeakage(
  fromDomain: string,
  toDomain:   string,
  fromPath:   string,
  toPath:     string,
): RuleMatch {
  for (const [forbidFrom, forbidTo] of FORBIDDEN_DOMAIN_PAIRS) {
    if (fromDomain === forbidFrom && toDomain === forbidTo) {
      return Object.freeze({
        violated: true,
        type:     "CROSS_DOMAIN_LEAKAGE",
        severity: "CRITICAL",
        rule:     `Domain '${fromDomain}' must not import from domain '${toDomain}'. Cross-domain dependency violates bounded context isolation.`,
        detail:   `"${fromPath}" [${fromDomain}] → "${toPath}" [${toDomain}]`,
      });
    }
  }
  return Object.freeze({
    violated: false,
    type:     "CROSS_DOMAIN_LEAKAGE",
    severity: "LOW",
    rule:     "",
    detail:   "",
  });
}

export function checkInfrastructureLeakage(
  fromDomain: string,
  toDomain:   string,
  fromPath:   string,
  toPath:     string,
): RuleMatch {
  const fromIsInfra = (INFRASTRUCTURE_DOMAINS as readonly string[]).includes(fromDomain);
  const toIsDomain  = !(INFRASTRUCTURE_DOMAINS as readonly string[]).includes(toDomain) &&
                       toDomain !== fromDomain;

  if (fromIsInfra && toIsDomain) {
    return Object.freeze({
      violated: true,
      type:     "INFRASTRUCTURE_LEAKAGE",
      severity: "HIGH",
      rule:     `Infrastructure domain '${fromDomain}' must not import into domain '${toDomain}'. Infrastructure must not leak into business/domain layers.`,
      detail:   `"${fromPath}" [${fromDomain}] → "${toPath}" [${toDomain}]`,
    });
  }
  return Object.freeze({
    violated: false,
    type:     "INFRASTRUCTURE_LEAKAGE",
    severity: "LOW",
    rule:     "",
    detail:   "",
  });
}

export function severityRank(s: ViolationSeverity): number {
  const ranks: Record<ViolationSeverity, number> = {
    CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
  };
  return ranks[s] ?? 0;
}

export function sortBySeverity(
  violations: readonly { severity: ViolationSeverity }[],
): number {
  return violations.reduce(
    (sum, v) => sum + severityRank(v.severity),
    0,
  );
}
