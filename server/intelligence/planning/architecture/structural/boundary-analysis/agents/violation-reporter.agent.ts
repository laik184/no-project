import type {
  BoundaryViolation,
  BoundaryReport,
  ViolationSeverity,
} from "../types.js";
import {
  BOUNDARY_SCORE_START,
  BOUNDARY_DEDUCTIONS,
  MAX_BOUNDARY_VIOLATIONS,
} from "../types.js";

function countBySeverity(
  violations: readonly BoundaryViolation[],
  severity:   ViolationSeverity,
): number {
  return violations.filter((v) => v.severity === severity).length;
}

function computeScore(violations: readonly BoundaryViolation[]): number {
  let score = BOUNDARY_SCORE_START;
  for (const v of violations) {
    score -= BOUNDARY_DEDUCTIONS[v.severity] ?? 0;
  }
  return Math.max(0, score);
}

function buildSummary(
  totalNodes:      number,
  totalEdges:      number,
  totalViolations: number,
  score:           number,
  critical:        number,
): string {
  if (totalNodes === 0) return "No architecture graph provided.";
  if (totalViolations === 0) {
    return `Architecture is boundary-compliant. ${totalNodes} nodes, ${totalEdges} edges checked. Score: ${score}/100.`;
  }
  const critPart = critical > 0 ? ` ${critical} critical violation(s).` : "";
  return `${totalViolations} boundary violation(s) across ${totalNodes} nodes.${critPart} Score: ${score}/100.`;
}

export function compileReport(
  reportId:    string,
  analyzedAt:  number,
  totalNodes:  number,
  totalEdges:  number,
  layerViolations:     readonly BoundaryViolation[],
  directionViolations: readonly BoundaryViolation[],
  domainViolations:    readonly BoundaryViolation[],
): BoundaryReport {
  const combined = [
    ...layerViolations,
    ...directionViolations,
    ...domainViolations,
  ].slice(0, MAX_BOUNDARY_VIOLATIONS);

  const score        = computeScore(combined);
  const criticalCount = countBySeverity(combined, "CRITICAL");
  const highCount     = countBySeverity(combined, "HIGH");
  const mediumCount   = countBySeverity(combined, "MEDIUM");
  const lowCount      = countBySeverity(combined, "LOW");

  return Object.freeze({
    reportId,
    analyzedAt,
    totalNodes,
    totalEdges,
    totalViolations: combined.length,
    violations:      Object.freeze(combined),
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallScore:    score,
    isCompliant:     combined.length === 0,
    summary:         buildSummary(totalNodes, totalEdges, combined.length, score, criticalCount),
  });
}

export function violationsByDomain(
  violations: readonly BoundaryViolation[],
  domain:     string,
): readonly BoundaryViolation[] {
  return Object.freeze(violations.filter((v) => v.domain === domain));
}

export function criticalViolations(
  violations: readonly BoundaryViolation[],
): readonly BoundaryViolation[] {
  return Object.freeze(violations.filter((v) => v.severity === "CRITICAL"));
}

export function sortedByScore(
  violations: readonly BoundaryViolation[],
): readonly BoundaryViolation[] {
  const order: Record<ViolationSeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...violations].sort(
      (a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4),
    ),
  );
}
