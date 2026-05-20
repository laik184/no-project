import type { FrameworkSignals, OptimizationIssue } from "../types.js";

export function runConcurrencyOptimizer(input: FrameworkSignals): OptimizationIssue[] {
  const concurrency = input.concurrency;
  if (!concurrency) return [];

  const issues: OptimizationIssue[] = [];

  if ((concurrency.blockingCalls?.length ?? 0) > 0) {
    issues.push({
      type: "concurrency",
      severity: "high",
      message: "Blocking calls found on latency-sensitive paths.",
      fix: "Replace sync APIs with async equivalents and offload CPU-heavy tasks.",
    });
  }

  if ((concurrency.serialAwaits?.length ?? 0) > 0) {
    issues.push({
      type: "concurrency",
      severity: "medium",
      message: "Serial awaits reduce throughput.",
      fix: "Parallelize independent async operations with Promise.all.",
    });
  }

  if ((concurrency.eventLoopLagMs ?? 0) > 70) {
    issues.push({
      type: "concurrency",
      severity: "high",
      message: "Event loop lag indicates runtime contention.",
      fix: "Use worker queues/workers and cap per-request synchronous computation.",
    });
  }

  return issues;
}
