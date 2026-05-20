export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeToUnit(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

export function weightedAverage(values: readonly number[], weights: readonly number[]): number {
  if (values.length !== weights.length || values.length === 0) return 0;
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0;
  const weighted = values.reduce((acc, v, i) => acc + v * (weights[i] ?? 0), 0);
  return weighted / totalWeight;
}

export function levelFromScore(
  score: number,
  thresholds: { critical: number; high: number; medium: number },
): "critical" | "high" | "medium" | "low" {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

export function softmax(values: readonly number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function isHighScore(score: number, threshold = 0.7): boolean {
  return score >= threshold;
}

export function isMediumScore(score: number, low = 0.4, high = 0.7): boolean {
  return score >= low && score < high;
}

export function isLowScore(score: number, threshold = 0.4): boolean {
  return score < threshold;
}
