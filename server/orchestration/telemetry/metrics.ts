interface MetricEntry {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

interface MetricSummary {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  unit: string;
}

const counters = new Map<string, Map<string, number>>();
const timings = new Map<string, Map<string, number[]>>();
const rawEntries = new Map<string, MetricEntry[]>();

function runCounters(runId: string): Map<string, number> {
  if (!counters.has(runId)) counters.set(runId, new Map());
  return counters.get(runId)!;
}

function runTimings(runId: string): Map<string, number[]> {
  if (!timings.has(runId)) timings.set(runId, new Map());
  return timings.get(runId)!;
}

function runEntries(runId: string): MetricEntry[] {
  if (!rawEntries.has(runId)) rawEntries.set(runId, []);
  return rawEntries.get(runId)!;
}

export const metricsCollector = {
  increment(runId: string, metric: string, by = 1): void {
    const m = runCounters(runId);
    m.set(metric, (m.get(metric) ?? 0) + by);
  },

  timing(runId: string, metric: string, ms: number): void {
    const m = runTimings(runId);
    if (!m.has(metric)) m.set(metric, []);
    m.get(metric)!.push(ms);
  },

  record(runId: string, metric: string, value: number, unit = 'ms'): void {
    runEntries(runId).push({ name: metric, value, unit, timestamp: new Date() });
  },

  getCounter(runId: string, metric: string): number {
    return runCounters(runId).get(metric) ?? 0;
  },

  getTimingSummary(runId: string, metric: string): MetricSummary | null {
    const values = runTimings(runId).get(metric);
    if (!values || values.length === 0) return null;
    const total = values.reduce((a, b) => a + b, 0);
    return {
      count: values.length,
      total,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: total / values.length,
      unit: 'ms',
    };
  },

  getAllCounters(runId: string): Record<string, number> {
    return Object.fromEntries(runCounters(runId).entries());
  },

  getSnapshot(runId: string): {
    counters: Record<string, number>;
    timings: Record<string, MetricSummary | null>;
  } {
    const c = Object.fromEntries(runCounters(runId).entries());
    const t: Record<string, MetricSummary | null> = {};
    for (const key of runTimings(runId).keys()) {
      t[key] = metricsCollector.getTimingSummary(runId, key);
    }
    return { counters: c, timings: t };
  },

  clearRun(runId: string): void {
    counters.delete(runId);
    timings.delete(runId);
    rawEntries.delete(runId);
  },
};
