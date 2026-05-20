/**
 * orchestration-metrics.ts
 *
 * In-process metrics collection for the orchestration layer.
 * Counters, gauges, and histograms — no external agent required.
 * Exposed via the orchestration API for dashboards and health checks.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

interface CounterEntry {
  name:   string;
  tags:   Record<string, string>;
  value:  number;
  lastTs: number;
}

interface HistogramEntry {
  name:    string;
  tags:    Record<string, string>;
  count:   number;
  sum:     number;
  min:     number;
  max:     number;
  lastTs:  number;
}

// ── Stores ────────────────────────────────────────────────────────────────────

const _counters   = new Map<string, CounterEntry>();
const _histograms = new Map<string, HistogramEntry>();
const _gauges     = new Map<string, number>();

// ── Key builder ───────────────────────────────────────────────────────────────

function makeKey(name: string, tags: Record<string, string>): string {
  const tagStr = Object.entries(tags).sort().map(([k, v]) => `${k}=${v}`).join(",");
  return tagStr ? `${name}{${tagStr}}` : name;
}

// ── Counter ───────────────────────────────────────────────────────────────────

export function incrementCounter(
  name:   string,
  tags:   Record<string, string> = {},
  by = 1,
): void {
  const key     = makeKey(name, tags);
  const existing = _counters.get(key);
  if (existing) {
    existing.value  += by;
    existing.lastTs  = Date.now();
  } else {
    _counters.set(key, { name, tags, value: by, lastTs: Date.now() });
  }
}

export function getCounter(name: string, tags: Record<string, string> = {}): number {
  return _counters.get(makeKey(name, tags))?.value ?? 0;
}

// ── Histogram (duration tracking) ─────────────────────────────────────────────

export function recordDuration(
  name:  string,
  ms:    number,
  tags:  Record<string, string> = {},
): void {
  const key      = makeKey(name, tags);
  const existing = _histograms.get(key);
  if (existing) {
    existing.count++;
    existing.sum  += ms;
    existing.min   = Math.min(existing.min, ms);
    existing.max   = Math.max(existing.max, ms);
    existing.lastTs = Date.now();
  } else {
    _histograms.set(key, { name, tags, count: 1, sum: ms, min: ms, max: ms, lastTs: Date.now() });
  }
}

export function getDurationStats(name: string, tags: Record<string, string> = {}): {
  count: number; avg: number; min: number; max: number;
} | null {
  const h = _histograms.get(makeKey(name, tags));
  if (!h) return null;
  return { count: h.count, avg: h.sum / h.count, min: h.min, max: h.max };
}

// ── Gauge ─────────────────────────────────────────────────────────────────────

export function setGauge(name: string, value: number): void {
  _gauges.set(name, value);
}

export function getGauge(name: string): number {
  return _gauges.get(name) ?? 0;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface MetricsSnapshot {
  counters:   CounterEntry[];
  histograms: Array<HistogramEntry & { avg: number }>;
  gauges:     Array<{ name: string; value: number }>;
  capturedAt: number;
}

export function snapshotMetrics(): MetricsSnapshot {
  return {
    counters: Array.from(_counters.values()),
    histograms: Array.from(_histograms.values()).map(h => ({
      ...h,
      avg: h.sum / h.count,
    })),
    gauges: Array.from(_gauges.entries()).map(([name, value]) => ({ name, value })),
    capturedAt: Date.now(),
  };
}

export function resetMetrics(): void {
  _counters.clear();
  _histograms.clear();
  _gauges.clear();
}

// ── Health summary ────────────────────────────────────────────────────────────

export function orchestrationHealthSummary(): {
  runsStarted:   number;
  runsCompleted: number;
  runsFailed:    number;
  successRate:   number;
  avgDurationMs: number;
} {
  const started   = getCounter("orchestration.runs.started");
  const completed = getCounter("orchestration.runs.completed");
  const failed    = getCounter("orchestration.runs.failed");
  const durStats  = getDurationStats("orchestration.run.duration");

  return {
    runsStarted:   started,
    runsCompleted: completed,
    runsFailed:    failed,
    successRate:   started > 0 ? completed / started : 0,
    avgDurationMs: durStats?.avg ?? 0,
  };
}
