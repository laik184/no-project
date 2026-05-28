/**
 * server/orchestration/execution/execution-result-registry.ts
 *
 * Stores per-run execution statistics for observability and post-run analysis.
 * Orchestration-only — no tool execution, no filesystem access.
 */

// ── Stats shape ───────────────────────────────────────────────────────────────

export interface ExecutionStats {
  runId:               string;
  projectId:           number;
  goal:                string;
  success:             boolean;
  totalSteps:          number;
  stopReason?:         string;
  summary?:            string;
  verificationRetries: number;
  totalToolCalls:      number;
  unknownToolCalls:    number;
  failedToolCalls:     number;
  messages?:           unknown[];
  error?:              string | Error | unknown;
  recordedAt:          number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _registry = new Map<string, ExecutionStats>();

export function storeExecutionStats(
  stats: Omit<ExecutionStats, 'recordedAt'>,
): void {
  _registry.set(stats.runId, { ...stats, recordedAt: Date.now() });
}

export function getExecutionStats(runId: string): ExecutionStats | undefined {
  return _registry.get(runId);
}

export function clearExecutionStats(runId: string): void {
  _registry.delete(runId);
}

export function allStats(): ExecutionStats[] {
  return Array.from(_registry.values());
}
