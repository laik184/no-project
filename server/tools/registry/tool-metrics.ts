/**
 * server/tools/registry/tool-metrics.ts
 *
 * Centralized per-tool metrics store.
 * Extracted from tool-registry.ts (Fix #8 — SRP split).
 *
 * Consumers: tool-dispatcher.ts (writes), tools.routes.ts (reads via unifiedRegistry).
 */

export interface ToolMetrics {
  invocations:  number;
  failures:     number;
  retries:      number;
  timeouts:     number;
  avgDurationMs: number;
}

const metricsStore = new Map<string, ToolMetrics>();

export function recordMetric(
  name:       string,
  ok:         boolean,
  durationMs: number,
  retries     = 0,
  timedOut    = false,
): void {
  const prev = metricsStore.get(name) ?? {
    invocations: 0, failures: 0, retries: 0, timeouts: 0, avgDurationMs: 0,
  };
  const invocations = prev.invocations + 1;
  const failures    = prev.failures  + (ok ? 0 : 1);
  const timeouts    = prev.timeouts  + (timedOut ? 1 : 0);
  const avgDurationMs = Math.round(
    (prev.avgDurationMs * prev.invocations + durationMs) / invocations,
  );
  metricsStore.set(name, {
    invocations,
    failures,
    retries:  prev.retries + retries,
    timeouts,
    avgDurationMs,
  });
}

export function getMetrics(name: string): ToolMetrics {
  return metricsStore.get(name) ?? {
    invocations: 0, failures: 0, retries: 0, timeouts: 0, avgDurationMs: 0,
  };
}

export function getAllMetricsSnapshot(): Record<string, ToolMetrics> {
  return Object.fromEntries(metricsStore.entries());
}

export function resetMetrics(name?: string): void {
  if (name) {
    metricsStore.delete(name);
  } else {
    metricsStore.clear();
  }
}
