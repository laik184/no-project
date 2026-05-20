import { ValidationIssue, IssueSeverity } from "../types";

const SEVERITY_DEDUCTIONS: Record<IssueSeverity, number> = {
  critical: 25,
  high:     12,
  medium:    5,
  low:       2,
};

export function computeScore(issues: readonly ValidationIssue[]): number {
  const deduction = issues.reduce(
    (total, issue) => total + (SEVERITY_DEDUCTIONS[issue.severity] ?? 0),
    0
  );
  return Math.max(Math.min(100 - deduction, 100), 0);
}

export function isPassingScore(score: number, threshold = 60): boolean {
  return score >= threshold;
}

export function hasCriticalIssues(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "critical");
}

export function summarySeverity(issues: readonly ValidationIssue[]): Record<IssueSeverity, number> {
  const counts: Record<IssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) counts[issue.severity]++;
  return counts;
}
