/**
 * server/agents/coderx/telemetry/coderx-metrics.ts
 *
 * Tracks execution count, success rate, retry metrics, and duration.
 * In-process counters — no external sink dependency.
 */

interface RunMetrics {
  runId:          string;
  startedAt:      Date;
  endedAt?:       Date;
  totalSteps:     number;
  successSteps:   number;
  failedSteps:    number;
  skippedSteps:   number;
  retryAttempts:  number;
  durationMs?:    number;
}

const _runs = new Map<string, RunMetrics>();
let _globalExecutions  = 0;
let _globalSuccesses   = 0;
let _globalFailures    = 0;
let _globalRetries     = 0;

export const coderxMetrics = {

  initRun(runId: string): void {
    _runs.set(runId, {
      runId,
      startedAt:    new Date(),
      totalSteps:   0,
      successSteps: 0,
      failedSteps:  0,
      skippedSteps: 0,
      retryAttempts: 0,
    });
    _globalExecutions++;
  },

  recordStepSuccess(runId: string): void {
    const r = _runs.get(runId);
    if (!r) return;
    r.totalSteps++;
    r.successSteps++;
    _globalSuccesses++;
  },

  recordStepFailure(runId: string): void {
    const r = _runs.get(runId);
    if (!r) return;
    r.totalSteps++;
    r.failedSteps++;
    _globalFailures++;
  },

  recordStepSkipped(runId: string): void {
    const r = _runs.get(runId);
    if (!r) return;
    r.totalSteps++;
    r.skippedSteps++;
  },

  recordRetry(runId: string): void {
    const r = _runs.get(runId);
    if (!r) return;
    r.retryAttempts++;
    _globalRetries++;
  },

  finalizeRun(runId: string, ok: boolean): void {
    const r = _runs.get(runId);
    if (!r) return;
    r.endedAt   = new Date();
    r.durationMs = r.endedAt.getTime() - r.startedAt.getTime();
    if (ok) _globalSuccesses++;
    else    _globalFailures++;
  },

  getRunMetrics(runId: string): RunMetrics | undefined {
    return _runs.get(runId);
  },

  successRate(runId: string): number {
    const r = _runs.get(runId);
    if (!r || r.totalSteps === 0) return 0;
    return r.successSteps / r.totalSteps;
  },

  globalSummary(): {
    totalRuns:      number;
    globalSuccesses: number;
    globalFailures:  number;
    globalRetries:   number;
    globalSuccessRate: number;
  } {
    const total = _globalSuccesses + _globalFailures;
    return {
      totalRuns:         _globalExecutions,
      globalSuccesses:   _globalSuccesses,
      globalFailures:    _globalFailures,
      globalRetries:     _globalRetries,
      globalSuccessRate: total > 0 ? _globalSuccesses / total : 0,
    };
  },

  clearRun(runId: string): void {
    _runs.delete(runId);
  },
};
