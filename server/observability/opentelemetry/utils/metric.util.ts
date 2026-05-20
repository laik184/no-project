import type { Metric, MetricKind } from "../types.js";

export function buildMetric(
  name: string,
  kind: MetricKind,
  value: number,
  unit: string,
  labels: Record<string, string> = {},
): Readonly<Metric> {
  return Object.freeze({
    name,
    kind,
    value,
    unit,
    timestampMs: Date.now(),
    labels: Object.freeze({ ...labels }),
  });
}

export function sumMetrics(
  metrics: readonly Readonly<Metric>[],
  name: string,
): number {
  return metrics
    .filter((m) => m.name === name)
    .reduce((acc, m) => acc + m.value, 0);
}

export function averageMetrics(
  metrics: readonly Readonly<Metric>[],
  name: string,
): number {
  const relevant = metrics.filter((m) => m.name === name);
  if (relevant.length === 0) return 0;
  return sumMetrics(metrics, name) / relevant.length;
}

export function errorRate(
  totalRequests: number,
  errorCount: number,
): number {
  if (totalRequests === 0) return 0;
  return Number(((errorCount / totalRequests) * 100).toFixed(2));
}

export function toPrometheusLine(metric: Readonly<Metric>): string {
  const labelStr = Object.entries(metric.labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(",");
  const labelsFormatted = labelStr ? `{${labelStr}}` : "";
  return `${metric.name}${labelsFormatted} ${metric.value} ${metric.timestampMs}`;
}
