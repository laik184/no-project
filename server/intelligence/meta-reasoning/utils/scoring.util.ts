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

export function severityToScore(severity: string): number {
  const map: Record<string, number> = { high: 1.0, medium: 0.6, low: 0.3 };
  return map[severity] ?? 0.5;
}

export function flawPenalty(flaws: Array<{ severity: string }>): number {
  const deduction = flaws.reduce((sum, f) => {
    const weights: Record<string, number> = { high: 0.15, medium: 0.07, low: 0.03 };
    return sum + (weights[f.severity] ?? 0.05);
  }, 0);
  return clamp(deduction, 0, 0.7);
}

export function compositeScore(speed: number, risk: number, efficiency: number): number {
  return weightedAverage([
    { value: speed, weight: 0.25 },
    { value: invertRisk(risk), weight: 0.35 },
    { value: efficiency, weight: 0.40 },
  ]);
}

export function invertRisk(riskScore: number): number {
  return clamp(1 - clamp(riskScore));
}

export function scaleTo100(unit: number): number {
  return Math.round(clamp(unit) * 100);
}
