import type { DecisionAnalysis, DetectedFlaw, StrategyComparison } from "../types";
import { clamp, flawPenalty, weightedAverage } from "../utils/scoring.util";
import { detectOutcomePolarity } from "../utils/reasoning.util";
import { normalizeScore } from "../utils/normalize.util";

export interface ConfidenceEvaluatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  confidence?: number;
}

const OUTCOME_POLARITY_SCORE: Record<string, number> = {
  positive: 0.85,
  neutral: 0.55,
  negative: 0.25,
};

export function evaluateConfidence(
  analysis: DecisionAnalysis,
  flaws: DetectedFlaw[],
  comparison: StrategyComparison,
  outcome: string
): ConfidenceEvaluatorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[confidence-evaluator] evaluating confidence — flaws=${flaws.length} alignment=${analysis.goalAlignment}`);

    const outcomePolarity = detectOutcomePolarity(outcome);
    const outcomeScore = OUTCOME_POLARITY_SCORE[outcomePolarity] ?? 0.55;
    logs.push(`[confidence-evaluator] outcome polarity=${outcomePolarity} score=${outcomeScore}`);

    const alignmentScore = clamp(analysis.goalAlignment);
    const winnerScore = comparison.scores.length > 0
      ? clamp(comparison.scores[0].composite)
      : 0.5;

    const assumptionPenalty = clamp(analysis.assumptions.length * 0.05, 0, 0.25);
    logs.push(`[confidence-evaluator] assumption penalty=${assumptionPenalty} (${analysis.assumptions.length} assumptions)`);

    const baseScore = weightedAverage([
      { value: outcomeScore, weight: 0.40 },
      { value: alignmentScore, weight: 0.25 },
      { value: winnerScore, weight: 0.20 },
      { value: clamp(1 - assumptionPenalty), weight: 0.15 },
    ]);

    const penalty = flawPenalty(flaws);
    logs.push(`[confidence-evaluator] flaw penalty=${penalty} base=${baseScore}`);

    const raw = clamp(baseScore - penalty);
    const confidence = normalizeScore(raw);

    logs.push(`[confidence-evaluator] final confidence=${confidence}`);
    return { success: true, logs, confidence };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[confidence-evaluator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
