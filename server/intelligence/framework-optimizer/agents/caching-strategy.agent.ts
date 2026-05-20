import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runCachingStrategy(input: FrameworkSignals): OptimizationIssue[] {
  const caching = input.caching;
  if (!caching) return [];

  const issues: OptimizationIssue[] = [];

  if ((caching.cacheHitRate ?? 1) < 0.6) {
    issues.push({
      type: "caching",
      severity: "medium",
      message: "Cache hit rate is below healthy threshold.",
      fix: "Add Redis or in-memory cache for hot read paths with sensible TTL.",
    });
  }

  if ((caching.uncachedHotPaths?.length ?? 0) > 0) {
    issues.push({
      type: "caching",
      severity: "medium",
      message: "High-frequency uncached execution paths found.",
      fix: "Introduce route/query level caching for read-heavy operations.",
    });
  }

  if ((caching.invalidationMissing?.length ?? 0) > 0) {
    issues.push({
      type: "caching",
      severity: "high",
      message: "Cache invalidation rules missing for mutable resources.",
      fix: "Define key versioning and write-through/write-behind invalidation strategy.",
    });
  }

  return issues;
}
