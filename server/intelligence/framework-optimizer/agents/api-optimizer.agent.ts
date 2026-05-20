import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runApiOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const api = input.api;
  if (!api) return [];

  const issues: OptimizationIssue[] = [];

  if ((api.p95LatencyMs ?? 0) > 700) {
    issues.push({
      type: "api",
      severity: "high",
      message: "High API latency observed at p95.",
      fix: "Introduce endpoint-level profiling, optimize handlers, and reduce downstream blocking calls.",
    });
  }

  if ((api.avgPayloadKb ?? 0) > 150) {
    issues.push({
      type: "api",
      severity: "medium",
      message: "Large API payload size increases transfer and parse time.",
      fix: "Trim response fields, compress payloads, and return view-specific DTOs.",
    });
  }

  if ((api.unpaginatedEndpoints?.length ?? 0) > 0 || (api.missingBatching?.length ?? 0) > 0) {
    issues.push({
      type: "api",
      severity: "medium",
      message: "Batching/pagination gaps detected in API design.",
      fix: "Enforce pagination defaults and batch related data fetches.",
    });
  }

  return issues;
}
