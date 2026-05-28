/**
 * server/agents/supervisor/telemetry/supervisor-metrics.ts
 *
 * In-process metrics for the supervisor agent.
 * Tracks: execution count, success rate, retry metrics, durations.
 */

interface RunMetrics {
  runId:          string;
  tasksTotal:     number;
  tasksOk:        number;
  tasksFailed:    number;
  retries:        number;
  escalations:    number;
  totalDurationMs: number;
  startedAt:      number;
}

const store = new Map<string, RunMetrics>();

export const supervisorMetrics = {
  initRun(runId: string): void {
    store.set(runId, {
      runId,
      tasksTotal:      0,
      tasksOk:         0,
      tasksFailed:     0,
      retries:         0,
      escalations:     0,
      totalDurationMs: 0,
      startedAt:       Date.now(),
    });
  },

  recordTask(runId: string, success: boolean, durationMs: number): void {
    const m = store.get(runId);
    if (!m) return;
    m.tasksTotal++;
    if (success) m.tasksOk++; else m.tasksFailed++;
    m.totalDurationMs += durationMs;
  },

  recordRetry(runId: string): void {
    const m = store.get(runId);
    if (m) m.retries++;
  },

  recordEscalation(runId: string): void {
    const m = store.get(runId);
    if (m) m.escalations++;
  },

  finalise(runId: string): RunMetrics | undefined {
    const m = store.get(runId);
    if (m) m.totalDurationMs = Date.now() - m.startedAt;
    return m;
  },

  snapshot(runId: string): RunMetrics | undefined {
    return store.get(runId);
  },

  successRate(runId: string): number {
    const m = store.get(runId);
    if (!m || m.tasksTotal === 0) return 1;
    return m.tasksOk / m.tasksTotal;
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
