/**
 * risk-estimator.ts
 *
 * Estimates execution risk from goal analysis.
 * Produces a ranked list of risk factors with mitigation strategies.
 * Pure function — deterministic, no LLM.
 */

import type { GoalAnalysis, RiskAssessment, RiskFactor, RiskLevel } from "./planning-types.ts";

// ── Risk rules ────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

export function estimateRisk(analysis: GoalAnalysis): RiskAssessment {
  const factors: RiskFactor[] = [];

  // Scope risk — too many components
  const componentCount = analysis.components.length;
  if (componentCount >= 4) {
    factors.push({
      name:        "Wide scope",
      description: `Goal spans ${componentCount} distinct systems`,
      score:       Math.min(0.9, 0.3 + componentCount * 0.15),
      level:       scoreToLevel(0.3 + componentCount * 0.15),
    });
  }

  // Auth complexity
  if (analysis.components.some(c => c.type === "auth")) {
    factors.push({
      name:        "Authentication system",
      description: "Auth requires security-sensitive code and session management",
      score:       0.65,
      level:       "high",
    });
  }

  // Database migrations
  if (analysis.components.some(c => c.type === "database")) {
    factors.push({
      name:        "Database schema changes",
      description: "Schema changes are irreversible without rollback plan",
      score:       0.55,
      level:       "medium",
    });
  }

  // Deployment risk
  if (analysis.components.some(c => c.type === "deployment")) {
    factors.push({
      name:        "Deployment step",
      description: "Deployment failures are hard to reverse in production",
      score:       0.70,
      level:       "high",
    });
  }

  // Ambiguity risk
  if (analysis.isAmbiguous) {
    factors.push({
      name:        "Ambiguous goal",
      description: "Short/vague goal increases chance of misinterpretation",
      score:       0.50,
      level:       "medium",
    });
  }

  // Long goal — likely complex with hidden dependencies
  if (analysis.wordCount > 50) {
    factors.push({
      name:        "Complex multi-step goal",
      description: `${analysis.wordCount} words suggest many hidden sub-tasks`,
      score:       Math.min(0.7, 0.3 + analysis.wordCount / 150),
      level:       scoreToLevel(0.3 + analysis.wordCount / 150),
    });
  }

  // Many estimated files
  if (analysis.estimatedFiles > 10) {
    factors.push({
      name:        "Large file surface",
      description: `~${analysis.estimatedFiles} files to create/modify`,
      score:       Math.min(0.6, analysis.estimatedFiles / 25),
      level:       scoreToLevel(analysis.estimatedFiles / 25),
    });
  }

  if (factors.length === 0) {
    factors.push({
      name: "Low risk", description: "Straightforward task", score: 0.1, level: "low",
    });
  }

  const overall = factors.reduce((sum, f) => sum + f.score, 0) / factors.length;

  const mitigations: string[] = [];
  if (overall > 0.5) mitigations.push("Create checkpoint before execution");
  if (analysis.components.some(c => c.type === "auth")) mitigations.push("Use established auth patterns (Passport/Lucia)");
  if (analysis.components.some(c => c.type === "database")) mitigations.push("Write migration rollback before applying");
  if (overall > 0.7) mitigations.push("Break into smaller goals and run sequentially");

  return {
    overall: scoreToLevel(overall),
    score:   Math.min(1.0, overall),
    factors,
    mitigations,
  };
}
