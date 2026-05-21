/**
 * server/engines/scoring/types.ts
 * Shared types for the scoring engine. No logic, no imports from sibling modules.
 */

export interface RetryEfficiencyScore {
  score: number; // 0–100
  totalSteps: number;
  verificationRetries: number;
  penalty: number;
  label: "excellent" | "good" | "fair" | "poor";
}

export interface ToolCorrectnessScore {
  score: number; // 0–100
  unknownToolCalls: number;
  failedToolCalls: number;
  totalToolCalls: number;
  label: "excellent" | "good" | "fair" | "poor";
}

export interface ScoringResult {
  projectId: number;
  runId: string;
  overallScore: number; // 0–100 weighted average
  retryEfficiency: RetryEfficiencyScore;
  toolCorrectness: ToolCorrectnessScore;
  hallucinationLikelihood: number; // 0–1 probability
  grade: "A" | "B" | "C" | "D" | "F";
  elapsedMs: number;
}
