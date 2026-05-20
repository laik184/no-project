import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runRenderOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const ui = input.ui;
  if (!ui) return [];

  const issues: OptimizationIssue[] = [];

  if ((ui.rerenders ?? 0) > 120 || (ui.missingMemoization ?? 0) > 5) {
    issues.push({
      type: "render",
      severity: "high",
      message: "Excessive re-renders detected in UI tree.",
      fix: "Apply React.memo/useMemo/useCallback and split stateful boundaries.",
    });
  }

  if ((ui.largeComponents ?? 0) > 8 || (ui.heavyRoutes?.length ?? 0) > 0) {
    issues.push({
      type: "render",
      severity: "medium",
      message: "Large render surfaces detected for route-level components.",
      fix: "Use lazy loading and route-level code splitting for heavy screens.",
    });
  }

  return issues;
}
