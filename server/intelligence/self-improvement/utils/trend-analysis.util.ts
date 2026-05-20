export interface TrendPoint {
  value: number;
  timestamp: number;
}

export type TrendDirection = "improving" | "degrading" | "stable";

export interface TrendResult {
  direction: TrendDirection;
  slope: number;
  volatility: number;
  average: number;
}

export function analyzeTrend(points: TrendPoint[]): TrendResult {
  if (points.length < 2) {
    const avg = points.length === 1 ? points[0].value : 0;
    return { direction: "stable", slope: 0, volatility: 0, average: avg };
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
  const n = sorted.length;
  const values = sorted.map((p) => p.value);
  const avg = values.reduce((s, v) => s + v, 0) / n;

  const times = sorted.map((p) => p.timestamp - sorted[0].timestamp);
  const timeAvg = times.reduce((s, t) => s + t, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (times[i] - timeAvg) * (values[i] - avg);
    den += (times[i] - timeAvg) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const volatility = Math.round(Math.sqrt(variance) * 100) / 100;

  let direction: TrendDirection = "stable";
  if (Math.abs(slope) > 0.001) {
    direction = slope > 0 ? "improving" : "degrading";
  }

  return {
    direction,
    slope: Math.round(slope * 10000) / 10000,
    volatility,
    average: Math.round(avg * 100) / 100,
  };
}

export function detectRepeatingPattern(values: number[], windowSize = 3): boolean {
  if (values.length < windowSize * 2) return false;
  const window = values.slice(-windowSize);
  const prev = values.slice(-windowSize * 2, -windowSize);
  const diff = window.reduce((sum, v, i) => sum + Math.abs(v - prev[i]), 0) / windowSize;
  return diff < 2;
}

export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window <= 0) return [];
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(Math.round((slice.reduce((s, v) => s + v, 0) / slice.length) * 100) / 100);
  }
  return result;
}
