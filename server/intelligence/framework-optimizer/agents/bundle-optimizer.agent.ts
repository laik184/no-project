import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runBundleOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const bundle = input.bundle;
  if (!bundle) return [];

  const issues: OptimizationIssue[] = [];

  if ((bundle.totalJsKb ?? 0) > 350) {
    issues.push({
      type: "bundle",
      severity: "high",
      message: "JavaScript bundle size is above recommended threshold.",
      fix: "Enable granular code splitting and remove heavy client-side dependencies.",
    });
  }

  if ((bundle.duplicatedDeps?.length ?? 0) > 0) {
    issues.push({
      type: "bundle",
      severity: "medium",
      message: "Duplicated dependencies found in the bundle graph.",
      fix: "Deduplicate dependencies and align versions across packages.",
    });
  }

  if ((bundle.routesWithoutSplitting?.length ?? 0) > 0) {
    issues.push({
      type: "bundle",
      severity: "medium",
      message: "Routes without code splitting increase initial load.",
      fix: "Use dynamic imports for route boundaries.",
    });
  }

  return issues;
}
