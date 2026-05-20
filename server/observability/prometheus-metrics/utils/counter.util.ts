import type { MetricLabel, MetricSample } from "../types.js";

export function findSample(
  samples: readonly MetricSample[],
  labels: MetricLabel,
): MetricSample | undefined {
  const labelKey = JSON.stringify(
    Object.keys(labels).sort().reduce<Record<string, string>>((acc, k) => {
      acc[k] = labels[k];
      return acc;
    }, {}),
  );

  return samples.find((s) => {
    const sKey = JSON.stringify(
      Object.keys(s.labels).sort().reduce<Record<string, string>>((acc, k) => {
        acc[k] = s.labels[k];
        return acc;
      }, {}),
    );
    return sKey === labelKey;
  });
}

export function incrementCounter(
  samples: readonly MetricSample[],
  labels: MetricLabel,
  by = 1,
): readonly MetricSample[] {
  const existing = findSample(samples, labels);

  if (existing) {
    const updated = samples.map((s) =>
      s === existing
        ? Object.freeze({ ...s, value: s.value + by, timestampMs: Date.now() })
        : s,
    );
    return Object.freeze(updated);
  }

  return Object.freeze([
    ...samples,
    Object.freeze({ labels, value: by, timestampMs: Date.now() }),
  ]);
}

export function setGauge(
  samples: readonly MetricSample[],
  labels: MetricLabel,
  value: number,
): readonly MetricSample[] {
  const existing = findSample(samples, labels);

  if (existing) {
    const updated = samples.map((s) =>
      s === existing
        ? Object.freeze({ ...s, value, timestampMs: Date.now() })
        : s,
    );
    return Object.freeze(updated);
  }

  return Object.freeze([
    ...samples,
    Object.freeze({ labels, value, timestampMs: Date.now() }),
  ]);
}
