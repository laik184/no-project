import type { HistogramBucket, HistogramData, MetricLabel } from "../types.js";
import { labelsToString } from "./label-normalizer.util.js";

export function initBuckets(
  boundaries: readonly number[],
): readonly HistogramBucket[] {
  const sorted = [...boundaries].sort((a, b) => a - b);
  return Object.freeze([
    ...sorted.map((le) => Object.freeze({ le, count: 0 })),
    Object.freeze({ le: "+Inf" as const, count: 0 }),
  ]);
}

export function recordObservation(
  data: Readonly<HistogramData>,
  value: number,
): Readonly<HistogramData> {
  const buckets: HistogramBucket[] = data.buckets.map((b) => {
    const le = b.le === "+Inf" ? Infinity : b.le;
    return Object.freeze({
      le: b.le,
      count: value <= le ? b.count + 1 : b.count,
    });
  });

  return Object.freeze({
    buckets: Object.freeze(buckets),
    sum: data.sum + value,
    count: data.count + 1,
    labels: data.labels,
  });
}

export function buildEmptyHistogram(labels: MetricLabel, boundaries: readonly number[]): Readonly<HistogramData> {
  return Object.freeze({
    buckets: initBuckets(boundaries),
    sum: 0,
    count: 0,
    labels,
  });
}

export function histogramToLines(
  name: string,
  data: Readonly<HistogramData>,
): string[] {
  const labelStr = labelsToString(data.labels);
  const lines: string[] = [];

  for (const bucket of data.buckets) {
    const le = bucket.le === "+Inf" ? "+Inf" : String(bucket.le);
    const bucketLabels = labelStr
      ? labelStr.slice(0, -1) + `,le="${le}"}`
      : `{le="${le}"}`;
    lines.push(`${name}_bucket${bucketLabels} ${bucket.count}`);
  }

  lines.push(`${name}_sum${labelStr} ${data.sum}`);
  lines.push(`${name}_count${labelStr} ${data.count}`);

  return lines;
}
