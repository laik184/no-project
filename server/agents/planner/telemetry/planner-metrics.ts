/**
 * server/agents/planner/telemetry/planner-metrics.ts
 *
 * In-process metrics for the planner agent.
 * Tracks: plan generation count, success rate, retry metrics, durations.
 */

interface RunMetrics {
  runId:           string;
  plansGenerated:  number;
  plansSucceeded:  number;
  plansFailed:     number;
  retries:         number;
  refinements:     number;
  totalDurationMs: number;
  startedAt:       number;
}

const store = new Map<string, RunMetrics>();

export const plannerMetrics = {
  initRun(runId: string): void {
    store.set(runId, {
      runId,
      plansGenerated:  0,
      plansSucceeded:  0,
      plansFailed:     0,
      retries:         0,
      refinements:     0,
      totalDurationMs: 0,
      startedAt:       Date.now(),
    });
  },

  recordPlan(runId: string, success: boolean, durationMs: number): void {
    const m = store.get(runId);
    if (!m) return;
    m.plansGenerated++;
    if (success) m.plansSucceeded++; else m.plansFailed++;
    m.totalDurationMs += durationMs;
  },

  recordRetry(runId: string): void {
    const m = store.get(runId);
    if (m) m.retries++;
  },

  recordRefinement(runId: string): void {
    const m = store.get(runId);
    if (m) m.refinements++;
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
    if (!m || m.plansGenerated === 0) return 1;
    return m.plansSucceeded / m.plansGenerated;
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
