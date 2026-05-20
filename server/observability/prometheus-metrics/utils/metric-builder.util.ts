import type { HistogramData, Metric, MetricConfig, MetricSample, MetricType } from "../types.js";

const DEFAULT_HISTOGRAM_BUCKETS: readonly number[] = Object.freeze([
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
]);

export function buildMetric(
  config: MetricConfig,
  samples: readonly MetricSample[] = [],
  histograms: readonly HistogramData[] = [],
): Readonly<Metric> {
  const now = Date.now();
  return Object.freeze({
    name: config.name,
    type: config.type,
    help: config.help,
    samples: Object.freeze([...samples]),
    histograms: Object.freeze([...histograms]),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateMetricSamples(
  metric: Readonly<Metric>,
  samples: readonly MetricSample[],
  histograms?: readonly HistogramData[],
): Readonly<Metric> {
  return Object.freeze({
    ...metric,
    samples: Object.freeze([...samples]),
    histograms: histograms !== undefined ? Object.freeze([...histograms]) : metric.histograms,
    updatedAt: Date.now(),
  });
}

export function getDefaultBuckets(custom?: readonly number[]): readonly number[] {
  return custom ?? DEFAULT_HISTOGRAM_BUCKETS;
}

export function prometheusTypeLine(name: string, type: MetricType): string {
  const pType =
    type === "histogram" ? "histogram"
    : type === "summary" ? "summary"
    : type === "counter" ? "counter"
    : "gauge";
  return `# TYPE ${name} ${pType}`;
}

export function prometheusHelpLine(name: string, help: string): string {
  return `# HELP ${name} ${help.replace(/\n/g, " ")}`;
}
