import type { FrameworkOptimizerState, OptimizationIssue } from "../types.js";

export function buildStateMetrics(
  score: number,
  issues: readonly OptimizationIssue[]
): FrameworkOptimizerState["metrics"] {
  return {
    performanceScore: score,
    bottlenecks: issues.map((issue) => issue.message),
    suggestions: issues.map((issue) => issue.fix),
  };
}
