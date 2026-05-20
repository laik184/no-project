import type { ThreatReport, ChainRisk, RiskLevel } from "../types";
import { logEntry, logRisk } from "../utils/log-builder.util";
import {
  clamp,
  riskLevelFromScore,
  severityToBaseScore,
  patternCountPenalty,
  compoundScore,
} from "../utils/risk-score.util";

export interface RiskEvaluatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  riskScore?: number;
  riskLevel?: RiskLevel;
}

export function evaluateRisk(
  threatReport: ThreatReport,
  chainRisk: ChainRisk
): RiskEvaluatorOutput {
  const logs: string[] = [];
  try {
    logs.push(logEntry("risk-evaluator", `threats=${threatReport.threats.length} chainScore=${chainRisk.compoundScore}`));

    if (!threatReport.detected && !chainRisk.hasCompoundingRisk) {
      const lowScore = clamp(chainRisk.compoundScore);
      const lowLevel = riskLevelFromScore(lowScore);
      logs.push(logRisk("risk-evaluator", lowScore, lowLevel));
      return { success: true, logs, riskScore: lowScore, riskLevel: lowLevel };
    }

    const threatBase = severityToBaseScore(threatReport.severity);
    const patternPenalty = patternCountPenalty(threatReport.matchedPatterns.length);
    const chainBonus = Math.round(chainRisk.compoundScore * 0.4);

    const rawScore = compoundScore(threatBase + patternPenalty, chainBonus);
    const riskScore = clamp(rawScore);
    const riskLevel = riskLevelFromScore(riskScore);

    logs.push(logEntry("risk-evaluator", `base=${threatBase} patternPenalty=${patternPenalty} chainBonus=${chainBonus}`));
    logs.push(logRisk("risk-evaluator", riskScore, riskLevel));

    return { success: true, logs, riskScore, riskLevel };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(logEntry("risk-evaluator", `ERROR: ${message}`));
    return { success: false, logs, error: message };
  }
}
