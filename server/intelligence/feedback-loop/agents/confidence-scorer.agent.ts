import type { EvaluationResult, RetryDecision, LearningInsight } from '../types.ts';
import { confidenceFromHistory, clamp } from '../utils/scoring.util.ts';

interface ConfidenceResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: {
    baseScore: number;
    retryPenalty: number;
    insightBonus: number;
    trendBonus: number;
  };
}

function retryPenalty(totalAttempts: number, maxAttempts: number): number {
  if (maxAttempts <= 1) return 0;
  const retryRatio = (totalAttempts - 1) / (maxAttempts - 1);
  return clamp(retryRatio * 0.2, 0, 0.2);
}

function insightBonus(insights: LearningInsight[]): number {
  if (insights.length === 0) return 0;
  const highConf = insights.filter((i) => i.confidence > 0.5).length;
  return clamp(highConf * 0.02, 0, 0.08);
}

function trendBonus(history: EvaluationResult[]): number {
  if (history.length < 2) return 0;
  const last = history[history.length - 1].score;
  const prev = history[history.length - 2].score;
  const delta = last - prev;
  return clamp(delta * 0.5, -0.1, 0.1);
}

function scoreToGrade(score: number): ConfidenceResult['grade'] {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.60) return 'C';
  if (score >= 0.40) return 'D';
  return 'F';
}

export function computeConfidence(
  history: EvaluationResult[],
  retry: RetryDecision,
  insights: LearningInsight[],
  maxAttempts: number,
): ConfidenceResult {
  const scores = history.map((h) => h.score);
  const baseScore = confidenceFromHistory(scores);
  const penalty = retryPenalty(history.length, maxAttempts);
  const bonus = insightBonus(insights);
  const trend = trendBonus(history);

  const finalScore = clamp(baseScore - penalty + bonus + trend, 0, 1);
  const rounded = Math.round(finalScore * 10000) / 10000;

  return Object.freeze({
    score: rounded,
    grade: scoreToGrade(rounded),
    factors: Object.freeze({
      baseScore,
      retryPenalty: penalty,
      insightBonus: bonus,
      trendBonus: trend,
    }),
  });
}
