export interface ScoringFactor {
  value: number;
  weight: number;
}

export function weightedScore(factors: ScoringFactor[]): number {
  if (factors.length === 0) return 0;
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  if (totalWeight === 0) return 0;
  const sum = factors.reduce((s, f) => s + clamp(f.value) * f.weight, 0);
  return round3(sum / totalWeight);
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function latencyToSpeedScore(latencyMs: number, maxMs = 5000): number {
  if (latencyMs <= 0) return 1;
  return clamp(1 - latencyMs / maxMs);
}

export function compositeExperimentScore(
  speedScore: number,
  accuracyScore: number,
  successRateScore: number
): number {
  return weightedScore([
    { value: speedScore, weight: 0.25 },
    { value: accuracyScore, weight: 0.40 },
    { value: successRateScore, weight: 0.35 },
  ]);
}

export function separationScore(scores: number[]): number {
  if (scores.length < 2) return 1;
  const sorted = [...scores].sort((a, b) => b - a);
  return clamp(sorted[0] - sorted[1]);
}
