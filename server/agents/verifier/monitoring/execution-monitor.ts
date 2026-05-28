/**
 * monitoring/execution-monitor.ts
 * Monitors tool dispatch execution patterns and anomalies.
 */

import { executionHistory } from '../state/execution-history.ts';
import { verifierMetrics }  from '../telemetry/verifier-metrics.ts';
import { verifierLogger }   from '../telemetry/verifier-logger.ts';

export interface ExecutionHealthReport {
  runId:         string;
  totalDispatches: number;
  failedDispatches: number;
  retryCount:    number;
  avgDurationMs: number;
  slowestTool?:  string;
  mostFailed?:   string;
}

export const executionMonitor = {
  recordDispatchMetric(
    runId:      string,
    toolName:   string,
    durationMs: number,
    ok:         boolean,
  ): void {
    verifierMetrics.recordDispatch(runId, toolName, durationMs, ok);
    if (!ok) {
      verifierLogger.warn(runId, `Dispatch failed: ${toolName}`, { durationMs });
    }
    if (durationMs > 30_000) {
      verifierLogger.warn(runId, `Slow dispatch detected: ${toolName}`, { durationMs });
    }
  },

  getHealthReport(runId: string): ExecutionHealthReport {
    const dispatches = executionHistory.getDispatches(runId);
    const total    = dispatches.length;
    const failed   = dispatches.filter((d) => !d.ok).length;
    const retries  = dispatches.filter((d) => d.attempt > 1).length;
    const avgMs    = total > 0 ? dispatches.reduce((s, d) => s + d.durationMs, 0) / total : 0;

    const toolCounts: Record<string, number> = {};
    const toolFailures: Record<string, number> = {};
    const toolDurations: Record<string, number> = {};

    for (const d of dispatches) {
      toolCounts[d.toolName]    = (toolCounts[d.toolName] ?? 0) + 1;
      toolDurations[d.toolName] = Math.max(toolDurations[d.toolName] ?? 0, d.durationMs);
      if (!d.ok) toolFailures[d.toolName] = (toolFailures[d.toolName] ?? 0) + 1;
    }

    const slowestTool = Object.entries(toolDurations).sort(([, a], [, b]) => b - a)[0]?.[0];
    const mostFailed  = Object.entries(toolFailures).sort(([, a], [, b]) => b - a)[0]?.[0];

    return { runId, totalDispatches: total, failedDispatches: failed, retryCount: retries, avgDurationMs: avgMs, slowestTool, mostFailed };
  },

  hasAnomalies(runId: string): boolean {
    const report = this.getHealthReport(runId);
    return report.failedDispatches > 3 || report.avgDurationMs > 30_000;
  },
};
