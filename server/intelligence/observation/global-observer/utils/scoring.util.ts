export interface WeightedFactor {
  value: number;
  weight: number;
}

export function weightedAverage(factors: WeightedFactor[]): number {
  if (factors.length === 0) return 0;
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = factors.reduce((s, f) => s + f.value * f.weight, 0);
  return Math.round((sum / totalWeight) * 1000) / 1000;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function scaleTo100(unit: number): number {
  return Math.round(clamp(unit) * 100);
}

export function penalize(base: number, count: number, weight = 5): number {
  return Math.max(0, Math.round(base - count * weight));
}

export function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xAvg = (n - 1) / 2;
  const yAvg = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xAvg) * (values[i] - yAvg);
    den += (i - xAvg) ** 2;
  }
  return den === 0 ? 0 : Math.round((num / den) * 10000) / 10000;
}

export function changePercent(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - baseline) / Math.abs(baseline)) * 10000) / 100;
}
