/**
 * server/agents/terminal/telemetry/terminal-metrics.ts
 *
 * In-process metrics for the terminal agent.
 * Tracks execution count, success/failure rate, retries, and duration.
 */

export interface RunMetrics {
  runId:          string;
  totalSteps:     number;
  successSteps:   number;
  failedSteps:    number;
  retryCount:     number;
  totalDurationMs: number;
  startedAt:      number;
}

const store = new Map<string, RunMetrics>();

function ensureRun(runId: string): RunMetrics {
  if (!store.has(runId)) {
    store.set(runId, {
      runId,
      totalSteps:     0,
      successSteps:   0,
      failedSteps:    0,
      retryCount:     0,
      totalDurationMs: 0,
      startedAt:      Date.now(),
    });
  }
  return store.get(runId)!;
}

export const terminalMetrics = {
  initRun(runId: string): void {
    ensureRun(runId);
  },

  recordStep(runId: string, success: boolean, durationMs: number, retries = 0): void {
    const m = ensureRun(runId);
    m.totalSteps++;
    m.totalDurationMs += durationMs;
    m.retryCount      += retries;
    if (success) m.successSteps++;
    else         m.failedSteps++;
  },

  getSnapshot(runId: string): RunMetrics | undefined {
    return store.get(runId);
  },

  successRate(runId: string): number {
    const m = store.get(runId);
    if (!m || m.totalSteps === 0) return 1;
    return m.successSteps / m.totalSteps;
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
