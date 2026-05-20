import type { SecurityIssue, SecuritySeverity } from "../types.js";
import { SEC_SCORE_START, SEC_DEDUCTIONS } from "../types.js";

export function computeSecurityScore(
  issues: readonly SecurityIssue[],
): number {
  let score = SEC_SCORE_START;
  for (const issue of issues) {
    score -= SEC_DEDUCTIONS[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function countBySeverity(
  issues:   readonly SecurityIssue[],
  severity: SecuritySeverity,
): number {
  return issues.filter((i) => i.severity === severity).length;
}

export function issuesByType(
  issues: readonly SecurityIssue[],
  type:   string,
): readonly SecurityIssue[] {
  return Object.freeze(issues.filter((i) => i.type === type));
}

export function criticalIssues(
  issues: readonly SecurityIssue[],
): readonly SecurityIssue[] {
  return Object.freeze(issues.filter((i) => i.severity === "CRITICAL"));
}

export function sortBySeverity(
  issues: readonly SecurityIssue[],
): readonly SecurityIssue[] {
  const order: Record<SecuritySeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)),
  );
}

export function issuesByFile(
  issues:   readonly SecurityIssue[],
  filePath: string,
): readonly SecurityIssue[] {
  return Object.freeze(issues.filter((i) => i.filePath === filePath));
}

export function issuesByCwe(
  issues: readonly SecurityIssue[],
  cwe:    string,
): readonly SecurityIssue[] {
  return Object.freeze(issues.filter((i) => i.cwe === cwe));
}

export function uniqueAffectedFiles(
  issues: readonly SecurityIssue[],
): readonly string[] {
  return Object.freeze([...new Set(issues.map((i) => i.filePath))]);
}

export function totalRiskWeight(issues: readonly SecurityIssue[]): number {
  return issues.reduce((acc, i) => acc + (SEC_DEDUCTIONS[i.severity] ?? 0), 0);
}
