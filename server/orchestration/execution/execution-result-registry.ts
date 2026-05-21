/**
 * server/orchestration/execution/execution-result-registry.ts
 *
 * Thin shared store: tool-loop executor writes run stats after completion,
 * orchestration engine reads them for post-execution engine phases.
 *
 * No business logic. No direct coupling between layers.
 * Single responsibility: store and retrieve ExecutionStats per runId.
 */

export interface ExecutionStats {
  runId:               string;
  projectId:           number;
  goal:                string;
  success:             boolean;
  totalSteps:          number;
  stopReason:          string;
  summary:             string;
  verificationRetries: number;
  totalToolCalls:      number;
  unknownToolCalls:    number;
  failedToolCalls:     number;
  messages:            unknown[];   // ToolMessage[] — typed loosely to avoid circular dep
  error?:              string;
}

// ── In-memory registry ────────────────────────────────────────────────────────

const _results = new Map<string, ExecutionStats>();

export function storeExecutionStats(stats: ExecutionStats): void {
  _results.set(stats.runId, stats);
}

export function getExecutionStats(runId: string): ExecutionStats | undefined {
  return _results.get(runId);
}

export function clearExecutionStats(runId: string): void {
  _results.delete(runId);
}
