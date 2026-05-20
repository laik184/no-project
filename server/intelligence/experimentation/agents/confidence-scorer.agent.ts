import type { ComparisonResult, ExecutionResult } from "../types";
import { separationScore, weightedScore, clamp, round3 } from "../utils/scoring.util";

export interface ConfidenceScorerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  confidence?: number;
}

export function scoreConfidence(
  comparisons: ComparisonResult[],
  results: ExecutionResult[]
): ConfidenceScorerOutput {
  const logs: string[] = [];
  try {
    logs.push(`[confidence-scorer] scoring confidence — ${comparisons.length} comparisons, ${results.length} results`);

    if (comparisons.length === 0) {
      logs.push("[confidence-scorer] no comparisons — confidence=0");
      return { success: true, logs, confidence: 0 };
    }

    const sorted = [...comparisons].sort((a, b) => b.compositeScore - a.compositeScore);
    const scores = sorted.map((c) => c.compositeScore);

    // Factor 1: separation between winner and runner-up
    const separation = separationScore(scores);
    logs.push(`[confidence-scorer] separation=${separation}`);

    // Factor 2: winner's raw composite quality
    const winnerQuality = clamp(scores[0] ?? 0);

    // Factor 3: sample coverage — more variants = higher confidence
    const sampleCoverage = clamp(comparisons.length / 5);
    logs.push(`[confidence-scorer] sampleCoverage=${sampleCoverage}`);

    // Factor 4: success rate across all results
    const successFraction = results.length > 0
      ? results.filter((r) => r.success).length / results.length
      : 0;
    logs.push(`[confidence-scorer] successFraction=${successFraction}`);

    // Factor 5: score variance — low variance means less discrimination
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const varianceSignal = clamp(Math.sqrt(variance) * 4);
    logs.push(`[confidence-scorer] variance=${round3(variance)} varianceSignal=${round3(varianceSignal)}`);

    const confidence = weightedScore([
      { value: separation, weight: 0.30 },
      { value: winnerQuality, weight: 0.25 },
      { value: sampleCoverage, weight: 0.20 },
      { value: successFraction, weight: 0.15 },
      { value: varianceSignal, weight: 0.10 },
    ]);

    logs.push(`[confidence-scorer] final confidence=${confidence}`);
    return { success: true, logs, confidence };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[confidence-scorer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
