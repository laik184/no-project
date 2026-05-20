import type { MigrationPlan, PatternDetectionResult, RiskAssessment, RiskLevel } from "../types.js";

function resolveRiskLevel(score: number): RiskLevel {
  if (score >= 7) return "HIGH";
  if (score >= 4) return "MEDIUM";
  return "LOW";
}

export function analyzeEvolutionRisks(
  detection: Readonly<PatternDetectionResult>,
  plan: Readonly<MigrationPlan>,
): RiskAssessment {
  const risks: string[] = [
    "Breaking changes in module/service interfaces during rollout.",
    "Data inconsistency risk during transition and ownership realignment.",
    "Deployment complexity increases as topology changes.",
  ];

  let score = 2;
  score += Math.min(4, plan.migrationSteps.length / 2);
  score += detection.antiPatterns.includes("tight coupling") ? 2 : 0;
  score += detection.antiPatterns.includes("cyclic dependencies") ? 2 : 0;

  return Object.freeze({
    riskLevel: resolveRiskLevel(score),
    risks: Object.freeze(risks),
  });
}
