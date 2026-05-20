import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runMiddlewareOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const middleware = input.middleware;
  if (!middleware) return [];

  const issues: OptimizationIssue[] = [];

  if ((middleware.chainLength ?? 0) > 8) {
    issues.push({
      type: "middleware",
      severity: "medium",
      message: "Middleware chain is too long for request lifecycle.",
      fix: "Remove non-essential middlewares and move expensive work off hot path.",
    });
  }

  if ((middleware.redundantMiddlewares?.length ?? 0) > 0) {
    issues.push({
      type: "middleware",
      severity: "low",
      message: "Redundant middleware handlers detected.",
      fix: "Consolidate duplicate middleware behavior into a shared layer.",
    });
  }

  if ((middleware.orderIssues?.length ?? 0) > 0) {
    issues.push({
      type: "middleware",
      severity: "high",
      message: "Middleware execution order can cause unnecessary work.",
      fix: "Place auth/validation before expensive transformations and logging.",
    });
  }

  return issues;
}
