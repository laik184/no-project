import type { PerformanceIssue, IssueSeverity } from "../types.js";
import { PERF_SCORE_START, PERF_DEDUCTIONS } from "../types.js";

export function computePerformanceScore(
  issues: readonly PerformanceIssue[],
): number {
  let score = PERF_SCORE_START;
  for (const issue of issues) {
    score -= PERF_DEDUCTIONS[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function countBySeverity(
  issues:   readonly PerformanceIssue[],
  severity: IssueSeverity,
): number {
  return issues.filter((i) => i.severity === severity).length;
}

export function issuesByType(
  issues: readonly PerformanceIssue[],
  type:   string,
): readonly PerformanceIssue[] {
  return Object.freeze(issues.filter((i) => i.type === type));
}

export function criticalIssues(
  issues: readonly PerformanceIssue[],
): readonly PerformanceIssue[] {
  return Object.freeze(issues.filter((i) => i.severity === "CRITICAL"));
}

export function highIssues(
  issues: readonly PerformanceIssue[],
): readonly PerformanceIssue[] {
  return Object.freeze(issues.filter((i) => i.severity === "HIGH"));
}

export function sortBySeverity(
  issues: readonly PerformanceIssue[],
): readonly PerformanceIssue[] {
  const order: Record<IssueSeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)),
  );
}

export function issuesByFile(
  issues: readonly PerformanceIssue[],
  filePath: string,
): readonly PerformanceIssue[] {
  return Object.freeze(issues.filter((i) => i.filePath === filePath));
}

export function hotFiles(
  issues:    readonly PerformanceIssue[],
  threshold: number,
): readonly string[] {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.filePath, (counts.get(issue.filePath) ?? 0) + 1);
  }
  const result: string[] = [];
  for (const [file, count] of counts.entries()) {
    if (count >= threshold) result.push(file);
  }
  return Object.freeze(result);
}

export function totalIssueWeight(issues: readonly PerformanceIssue[]): number {
  return issues.reduce((acc, i) => acc + (PERF_DEDUCTIONS[i.severity] ?? 0), 0);
}
