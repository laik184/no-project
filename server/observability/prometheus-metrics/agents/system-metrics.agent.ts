import { transitionState, upsertMetricToState } from "../state.js";
import type { Metric, MetricSample, PrometheusState } from "../types.js";
import { buildMetric } from "../utils/metric-builder.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "system-metrics";

const EMPTY_LABELS = Object.freeze({});

export interface SystemMetricsResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly collected: readonly Readonly<Metric>[];
}

function measureEventLoopLagMs(): Promise<number> {
  return new Promise((resolve) => {
    const start = Date.now();
    setImmediate(() => resolve(Date.now() - start));
  });
}

export async function collectSystemMetrics(
  state: Readonly<PrometheusState>,
): Promise<Readonly<SystemMetricsResult>> {
  const mem = process.memoryUsage();
  const now = Date.now();

  const memorySamples: readonly MetricSample[] = Object.freeze([
    Object.freeze({ labels: Object.freeze({ type: "rss" }), value: mem.rss, timestampMs: now }),
    Object.freeze({ labels: Object.freeze({ type: "heap_used" }), value: mem.heapUsed, timestampMs: now }),
    Object.freeze({ labels: Object.freeze({ type: "heap_total" }), value: mem.heapTotal, timestampMs: now }),
    Object.freeze({ labels: Object.freeze({ type: "external" }), value: mem.external, timestampMs: now }),
  ]);

  const memMetric = buildMetric(
    { name: "process_memory_bytes", type: "gauge", help: "Node.js process memory usage in bytes by type" },
    memorySamples,
  );

  const uptimeMetric = buildMetric(
    { name: "process_uptime_seconds", type: "counter", help: "Total process uptime in seconds" },
    [Object.freeze({ labels: EMPTY_LABELS, value: process.uptime(), timestampMs: now })],
  );

  const heapUsedMetric = buildMetric(
    { name: "nodejs_heap_size_used_bytes", type: "gauge", help: "Node.js heap size used in bytes" },
    [Object.freeze({ labels: EMPTY_LABELS, value: mem.heapUsed, timestampMs: now })],
  );

  const heapTotalMetric = buildMetric(
    { name: "nodejs_heap_size_total_bytes", type: "gauge", help: "Node.js heap size total in bytes" },
    [Object.freeze({ labels: EMPTY_LABELS, value: mem.heapTotal, timestampMs: now })],
  );

  const externalMetric = buildMetric(
    { name: "nodejs_external_memory_bytes", type: "gauge", help: "Node.js external memory usage in bytes" },
    [Object.freeze({ labels: EMPTY_LABELS, value: mem.external, timestampMs: now })],
  );

  const lagMs = await measureEventLoopLagMs();
  const lagMetric = buildMetric(
    { name: "nodejs_eventloop_lag_seconds", type: "gauge", help: "Approximated Node.js event loop lag in seconds" },
    [Object.freeze({ labels: EMPTY_LABELS, value: lagMs / 1_000, timestampMs: now })],
  );

  const collected: readonly Metric[] = Object.freeze([
    memMetric, uptimeMetric, heapUsedMetric, heapTotalMetric, externalMetric, lagMetric,
  ]);

  let current = state;
  for (const metric of collected) {
    current = upsertMetricToState(current, metric);
  }

  const log = buildLog(
    SOURCE,
    `System metrics collected: heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB uptime=${process.uptime().toFixed(0)}s lagMs=${lagMs}`,
  );

  return {
    nextState: transitionState(current, { appendLog: log }),
    collected,
  };
}
