const SEVERITY_WEIGHT: Record<string, number> = Object.freeze({
  low: 5,
  medium: 12,
  high: 20,
  critical: 30,
});

export function severityToPenalty(severity: string): number {
  return SEVERITY_WEIGHT[severity] ?? 0;
}

export function clampScore(score: number): number {
  if (score < 0) {
    return 0;
  }

  if (score > 100) {
    return 100;
  }

  return score;
}

export function aggregateFinalScore(inputs: readonly number[]): number {
  if (inputs.length === 0) {
    return 0;
  }

  const sum = inputs.reduce((acc, item) => acc + item, 0);
  return clampScore(Math.round(sum / inputs.length));
}
