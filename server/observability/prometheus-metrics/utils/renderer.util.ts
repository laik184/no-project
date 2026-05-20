import type { Metric } from "../types.js";
import { histogramToLines } from "./histogram.util.js";
import { labelsToString } from "./label-normalizer.util.js";
import { prometheusHelpLine, prometheusTypeLine } from "./metric-builder.util.js";

export function renderMetricToLines(metric: Readonly<Metric>): string[] {
  const lines: string[] = [
    prometheusHelpLine(metric.name, metric.help),
    prometheusTypeLine(metric.name, metric.type),
  ];

  if (metric.type === "histogram" && metric.histograms?.length) {
    for (const h of metric.histograms) {
      lines.push(...histogramToLines(metric.name, h));
    }
  } else {
    for (const sample of metric.samples) {
      const labelStr = labelsToString(sample.labels);
      const ts = sample.timestampMs ? ` ${sample.timestampMs}` : "";
      lines.push(`${metric.name}${labelStr} ${sample.value}${ts}`);
    }
  }

  return lines;
}

export function renderAllMetrics(metrics: readonly Readonly<Metric>[]): string {
  const lines: string[] = [];
  for (const metric of metrics) {
    lines.push(...renderMetricToLines(metric));
  }
  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}
