/**
 * server/execution-history/metrics/metrics-collector.ts
 *
 * Aggregates execution metrics from history records.
 * Produces per-tool stats, per-run health, and global summaries.
 * Pure computation — no DB access, no side effects.
 */

import type { ToolExecution } from "../schema/tool-executions.schema.ts";

export interface ToolMetricSummary {
  toolName:       string;
  totalCalls:     number;
  successCount:   number;
  errorCount:     number;
  timeoutCount:   number;
  successRate:    number;       // 0–1
  avgDurationMs:  number;
  minDurationMs:  number;
  maxDurationMs:  number;
  totalDurationMs: number;
  totalRetries:   number;
  lastSeenAt:     string | null;
}

export interface RunMetricSummary {
  runId:          string;
  totalTools:     number;
  uniqueTools:    number;
  successCount:   number;
  errorCount:     number;
  successRate:    number;
  totalDurationMs: number;
  avgToolDurationMs: number;
  totalRetries:   number;
  hasFailures:    boolean;
  criticalErrors: string[];
}

export interface GlobalMetrics {
  totalExecutions:    number;
  totalSuccesses:     number;
  totalErrors:        number;
  globalSuccessRate:  number;
  avgDurationMs:      number;
  totalRetries:       number;
  mostCalledTool:     string | null;
  mostFailingTool:    string | null;
}

/** Compute per-tool metrics from a set of execution rows. */
export function computeToolMetrics(rows: ToolExecution[]): ToolMetricSummary[] {
  const byTool = new Map<string, ToolExecution[]>();
  for (const row of rows) {
    const group = byTool.get(row.toolName) ?? [];
    group.push(row);
    byTool.set(row.toolName, group);
  }

  const summaries: ToolMetricSummary[] = [];
  for (const [toolName, execs] of byTool) {
    const terminal  = execs.filter((e) => e.status !== "running");
    const successes = execs.filter((e) => e.status === "success");
    const errors    = execs.filter((e) => e.status === "error");
    const timeouts  = execs.filter((e) => e.status === "timeout");
    const durations = terminal.map((e) => e.durationMs ?? 0);

    summaries.push({
      toolName,
      totalCalls:      execs.length,
      successCount:    successes.length,
      errorCount:      errors.length,
      timeoutCount:    timeouts.length,
      successRate:     terminal.length > 0 ? successes.length / terminal.length : 0,
      avgDurationMs:   durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      minDurationMs:   durations.length > 0 ? Math.min(...durations) : 0,
      maxDurationMs:   durations.length > 0 ? Math.max(...durations) : 0,
      totalDurationMs: durations.reduce((a, b) => a + b, 0),
      totalRetries:    execs.reduce((sum, e) => sum + e.retryCount, 0),
      lastSeenAt:      execs.reduce<Date | null>((latest, e) =>
        latest == null || e.startedAt > latest ? e.startedAt : latest, null)?.toISOString() ?? null,
    });
  }

  return summaries.sort((a, b) => b.totalCalls - a.totalCalls);
}

/** Compute run-level health metrics. */
export function computeRunMetrics(runId: string, rows: ToolExecution[]): RunMetricSummary {
  const terminal      = rows.filter((e) => e.status !== "running");
  const successes     = rows.filter((e) => e.status === "success");
  const errors        = rows.filter((e) => e.status === "error" || e.status === "timeout");
  const durations     = terminal.map((e) => e.durationMs ?? 0);
  const uniqueTools   = new Set(rows.map((e) => e.toolName)).size;
  const criticalErrors = errors.map((e) => `${e.toolName}: ${(e.errorText ?? "unknown").slice(0, 100)}`);

  return {
    runId,
    totalTools:          rows.length,
    uniqueTools,
    successCount:        successes.length,
    errorCount:          errors.length,
    successRate:         terminal.length > 0 ? successes.length / terminal.length : 0,
    totalDurationMs:     durations.reduce((a, b) => a + b, 0),
    avgToolDurationMs:   durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    totalRetries:        rows.reduce((sum, e) => sum + e.retryCount, 0),
    hasFailures:         errors.length > 0,
    criticalErrors,
  };
}

/** Compute global aggregate metrics across all rows. */
export function computeGlobalMetrics(rows: ToolExecution[]): GlobalMetrics {
  const terminal    = rows.filter((e) => e.status !== "running");
  const successes   = terminal.filter((e) => e.status === "success");
  const errors      = terminal.filter((e) => e.status !== "success");
  const durations   = terminal.map((e) => e.durationMs ?? 0);

  const toolCallCounts = new Map<string, number>();
  const toolErrorCounts = new Map<string, number>();
  for (const row of terminal) {
    toolCallCounts.set(row.toolName, (toolCallCounts.get(row.toolName) ?? 0) + 1);
    if (row.status !== "success") {
      toolErrorCounts.set(row.toolName, (toolErrorCounts.get(row.toolName) ?? 0) + 1);
    }
  }

  const mostCalledTool  = [...toolCallCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const mostFailingTool = [...toolErrorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    totalExecutions:   rows.length,
    totalSuccesses:    successes.length,
    totalErrors:       errors.length,
    globalSuccessRate: terminal.length > 0 ? successes.length / terminal.length : 0,
    avgDurationMs:     durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    totalRetries:      rows.reduce((sum, e) => sum + e.retryCount, 0),
    mostCalledTool,
    mostFailingTool,
  };
}
