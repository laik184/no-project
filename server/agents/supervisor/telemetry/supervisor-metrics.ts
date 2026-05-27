import { metricsCollector } from '../../../orchestration/telemetry/metrics.ts';

interface MetricSnapshot {
  counters: Record<string, number>;
  timings: Record<string, { avg: number; min: number; max: number; count: number } | null>;
  capturedAt: Date;
}

export const supervisorMetrics = {
  increment(runId: string, metric: string, by = 1): void {
    metricsCollector.increment(runId, metric, by);
  },

  timing(runId: string, metric: string, ms: number): void {
    metricsCollector.timing(runId, metric, ms);
  },

  record(runId: string, metric: string, value: number, unit = 'count'): void {
    metricsCollector.record(runId, metric, value, unit);
  },

  snapshot(runId: string): MetricSnapshot {
    const raw = metricsCollector.getSnapshot(runId);
    return {
      counters: raw.counters,
      timings: raw.timings,
      capturedAt: new Date(),
    };
  },

  getCounter(runId: string, metric: string): number {
    return metricsCollector.getCounter(runId, metric);
  },

  clearRun(runId: string): void {
    metricsCollector.clearRun(runId);
  },
};
