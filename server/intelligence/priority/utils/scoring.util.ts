export const WEIGHTS = Object.freeze({
  urgency:    0.35,
  impact:     0.30,
  dependency: 0.20,
  complexity: 0.15,
});

export const LEVEL_THRESHOLDS = Object.freeze({
  critical: 75,
  high:     55,
  medium:   35,
});

export function weightedScore(
  urgency: number,
  impact: number,
  dependency: number,
  complexity: number
): number {
  const raw =
    urgency    * WEIGHTS.urgency    +
    impact     * WEIGHTS.impact     +
    dependency * WEIGHTS.dependency +
    complexity * WEIGHTS.complexity;

  return Math.min(Math.max(Math.round(raw * 100) / 100, 0), 100);
}

export function complexityScore(complexity?: number, effort?: number): number {
  const c = complexity ?? 0.5;
  const e = effort ?? 1;
  const base = Math.min(c * 60, 60);
  const effortBonus = Math.min((e / 10) * 40, 40);
  return Math.round(base + effortBonus);
}

export function levelFromScore(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= LEVEL_THRESHOLDS.critical) return "critical";
  if (score >= LEVEL_THRESHOLDS.high)     return "high";
  if (score >= LEVEL_THRESHOLDS.medium)   return "medium";
  return "low";
}
