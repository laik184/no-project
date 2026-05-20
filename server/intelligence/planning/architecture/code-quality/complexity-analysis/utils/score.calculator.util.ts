import type { ComplexityIssue, ComplexitySeverity } from "../types.js";
import { COMPLEX_SCORE_START, COMPLEX_DEDUCTIONS } from "../types.js";

export function computeComplexityScore(
  issues: readonly ComplexityIssue[],
): number {
  let score = COMPLEX_SCORE_START;
  for (const issue of issues) {
    score -= COMPLEX_DEDUCTIONS[issue.severity] ?? 0;
  }
  return Math.max(0, score);
}

export function countBySeverity(
  issues:   readonly ComplexityIssue[],
  severity: ComplexitySeverity,
): number {
  return issues.filter((i) => i.severity === severity).length;
}

export function sortBySeverity(
  issues: readonly ComplexityIssue[],
): readonly ComplexityIssue[] {
  const order: Record<ComplexitySeverity, number> = {
    CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
  };
  return Object.freeze(
    [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)),
  );
}

export function issuesByFile(
  issues:   readonly ComplexityIssue[],
  filePath: string,
): readonly ComplexityIssue[] {
  return Object.freeze(issues.filter((i) => i.filePath === filePath));
}

export function uniqueAffectedFiles(
  issues: readonly ComplexityIssue[],
): readonly string[] {
  return Object.freeze([...new Set(issues.map((i) => i.filePath))]);
}

export function totalRiskWeight(issues: readonly ComplexityIssue[]): number {
  return issues.reduce((acc, i) => acc + (COMPLEX_DEDUCTIONS[i.severity] ?? 0), 0);
}

export function averageMetric(issues: readonly ComplexityIssue[]): number {
  if (issues.length === 0) return 0;
  const total = issues.reduce((acc, i) => acc + i.metricValue, 0);
  return Math.round((total / issues.length) * 10) / 10;
}

export function maxMetric(issues: readonly ComplexityIssue[]): number {
  if (issues.length === 0) return 0;
  return Math.max(...issues.map((i) => i.metricValue));
}

export function topComplexFunctions(
  issues: readonly ComplexityIssue[],
  limit:  number = 5,
): readonly { functionName: string; filePath: string; metricValue: number; severity: ComplexitySeverity }[] {
  return Object.freeze(
    [...issues]
      .filter((i) => i.functionName !== null)
      .sort((a, b) => b.metricValue - a.metricValue)
      .slice(0, limit)
      .map((i) => Object.freeze({
        functionName: i.functionName!,
        filePath:     i.filePath,
        metricValue:  i.metricValue,
        severity:     i.severity,
      })),
  );
}

export function topIssueDensityFiles(
  issues: readonly ComplexityIssue[],
  limit:  number = 5,
): readonly { filePath: string; count: number; maxSeverity: ComplexitySeverity }[] {
  const fileMap = new Map<string, { count: number; maxSeverity: ComplexitySeverity }>();
  const order: Record<ComplexitySeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  for (const issue of issues) {
    const existing = fileMap.get(issue.filePath);
    if (!existing) {
      fileMap.set(issue.filePath, { count: 1, maxSeverity: issue.severity });
    } else {
      const isBetter = (order[issue.severity] ?? 4) < (order[existing.maxSeverity] ?? 4);
      fileMap.set(issue.filePath, {
        count:       existing.count + 1,
        maxSeverity: isBetter ? issue.severity : existing.maxSeverity,
      });
    }
  }

  return Object.freeze(
    [...fileMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([filePath, { count, maxSeverity }]) => Object.freeze({ filePath, count, maxSeverity })),
  );
}
