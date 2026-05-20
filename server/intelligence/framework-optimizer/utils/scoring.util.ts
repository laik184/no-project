import type { OptimizationIssue } from "../types.js";

const SEVERITY_WEIGHT = Object.freeze({
  low: 6,
  medium: 12,
  high: 20,
});

export function calculateScore(issues: readonly OptimizationIssue[]): number {
  const deduction = issues.reduce((sum, issue) => sum + SEVERITY_WEIGHT[issue.severity], 0);
  return Math.max(0, 100 - deduction);
}
