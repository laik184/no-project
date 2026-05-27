interface RunMetrics {
  runId:         string;
  executions:    number;
  failures:      number;
  totalDurationMs: number;
  restarts:      number;
  startedAt:     Date;
}

const store = new Map<string, RunMetrics>();

function getOrCreate(runId: string): RunMetrics {
  if (!store.has(runId)) {
    store.set(runId, {
      runId,
      executions:      0,
      failures:        0,
      totalDurationMs: 0,
      restarts:        0,
      startedAt:       new Date(),
    });
  }
  return store.get(runId)!;
}

export const runtimeMetrics = {
  recordExecution(runId: string, durationMs: number, success: boolean): void {
    const m = getOrCreate(runId);
    m.executions++;
    m.totalDurationMs += durationMs;
    if (!success) m.failures++;
  },

  recordRestart(runId: string): void {
    getOrCreate(runId).restarts++;
  },

  getMetrics(runId: string): RunMetrics | undefined {
    return store.get(runId);
  },

  failureRate(runId: string): number {
    const m = store.get(runId);
    if (!m || m.executions === 0) return 0;
    return m.failures / m.executions;
  },

  clear(runId: string): void {
    store.delete(runId);
  },
};
