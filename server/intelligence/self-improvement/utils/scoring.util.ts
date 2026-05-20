export interface WeightedScore {
  value: number;
  weight: number;
}

export function weightedAverage(scores: WeightedScore[]): number {
  if (scores.length === 0) return 0;
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = scores.reduce((sum, s) => sum + s.value * s.weight, 0);
  return Math.round((weighted / totalWeight) * 100) / 100;
}

export function impactEffortScore(impact: number, effort: number): number {
  if (effort <= 0) return 0;
  const raw = impact / effort;
  return Math.min(100, Math.round(raw * 50));
}

export function penalizedScore(base: number, penaltyCount: number, penaltyWeight = 5): number {
  return Math.max(0, Math.round(base - penaltyCount * penaltyWeight));
}

export function boostScore(base: number, boostCount: number, boostWeight = 3): number {
  return Math.min(100, Math.round(base + boostCount * boostWeight));
}

export function linearScore(value: number, min: number, max: number, invert = false): number {
  if (max <= min) return 0;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  const score = invert ? 1 - ratio : ratio;
  return Math.round(score * 100);
}

export function estimatedGain(actions: Array<{ estimatedImpact: number; optimizationScore: number }>): number {
  if (actions.length === 0) return 0;
  const total = actions.reduce((sum, a) => sum + a.estimatedImpact * (a.optimizationScore / 100), 0);
  return Math.min(100, Math.round(total / actions.length));
}
