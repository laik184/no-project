import type { RiskLevel, ScoreBreakdown } from "../types.js";

const RISK_PENALTY: Record<RiskLevel, number> = {
  LOW: 10,
  MEDIUM: 25,
  HIGH: 40,
};

export function scoreEvolutionPlan(
  riskLevel: RiskLevel,
  steps: readonly string[],
  antiPatterns: readonly string[],
): number {
  const breakdown: ScoreBreakdown = {
    feasibility: 85,
    riskPenalty: RISK_PENALTY[riskLevel],
    migrationComplexityPenalty: Math.min(25, steps.length * 3),
    maintainabilityGain: Math.min(30, antiPatterns.length * 7),
  };

  const raw =
    breakdown.feasibility - breakdown.riskPenalty - breakdown.migrationComplexityPenalty + breakdown.maintainabilityGain;

  return Math.max(0, Math.min(100, Math.round(raw)));
}
