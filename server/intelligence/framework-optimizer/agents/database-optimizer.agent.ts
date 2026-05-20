import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runDatabaseOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const database = input.database;
  if (!database) return [];

  const issues: OptimizationIssue[] = [];

  if ((database.slowQueries?.length ?? 0) > 0) {
    issues.push({
      type: "database",
      severity: "high",
      message: "Slow database queries detected.",
      fix: "Analyze query plans, reduce scans, and add selective predicates.",
    });
  }

  if ((database.missingIndexes?.length ?? 0) > 0) {
    issues.push({
      type: "database",
      severity: "high",
      message: "Index opportunities detected for frequently filtered columns.",
      fix: "Create composite/covering indexes for top read paths.",
    });
  }

  if ((database.nPlusOnePatterns?.length ?? 0) > 0) {
    issues.push({
      type: "database",
      severity: "medium",
      message: "N+1 query pattern detected.",
      fix: "Use eager loading, joins, or dataloader-style batching.",
    });
  }

  return issues;
}
