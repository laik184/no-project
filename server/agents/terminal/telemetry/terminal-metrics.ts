/**
 * server/agents/terminal/telemetry/terminal-metrics.ts
 *
 * In-process metrics for the terminal agent.
 * Tracks: execution count, success/failure rate, retry metrics, durations.
 */

interface RunMetrics {
  runId:        string;
  stepsTotal:   number;
  stepsOk:      number;
  stepsFailed:  number;
  retries:      number;
  durationMs:   number;
  startedAt:    number;
}

const store = new Map<string, RunMetrics>();

export const terminalMetrics = {
  initRun(runId: string): void {
    store.set(runId, {
      runId, stepsTotal: 0, stepsOk: 0, stepsFailed: 0,
      retries: 0, durationMs: 0, startedAt: Date.now(),
    });
  },

  recordStep(runId: string, success: boolean, durationMs: number): void {
    const m = store.get(runId);
    if (!m) return;
    m.stepsTotal++;
    if (success) m.stepsOk++; else m.stepsFailed++;
    m.durationMs += durationMs;
  },

  recordRetry(runId: string): void {
    const m = store.get(runId);
    if (m) m.retries++;
  },

  finalise(runId: string): RunMetrics | undefined {
    const m = store.get(runId);
    if (m) m.durationMs = Date.now() - m.startedAt;
    return m;
  },

  snapshot(runId: string): RunMetrics | undefined { return store.get(runId); },

  clear(runId: string): void { store.delete(runId); },

  successRate(runId: string): number {
    const m = store.get(runId);
    if (!m || m.stepsTotal === 0) return 1;
    return m.stepsOk / m.stepsTotal;
  },
};
