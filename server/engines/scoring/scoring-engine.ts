/**
 * server/engines/scoring/scoring-engine.ts
 * Aggregates all sub-scores into a final ScoringResult.
 * Single responsibility: produce ScoringResult. Emits telemetry.
 */

import { scoreRetryEfficiency }  from "./retry-efficiency-scorer.ts";
import { scoreToolCorrectness }  from "./tool-correctness-scorer.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";
import type { ScoringResult }    from "./types.ts";

// ── Weights ───────────────────────────────────────────────────────────────────

const WEIGHTS = {
  retryEfficiency:  0.40,
  toolCorrectness:  0.40,
  noHallucination:  0.20,
};

function gradeFromScore(score: number): ScoringResult["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runScoringEngine(
  projectId:            number,
  runId:                string,
  totalSteps:           number,
  verificationRetries:  number,
  totalToolCalls:       number,
  unknownToolCalls:     number,
  failedToolCalls:      number,
  hallucinationScore:   number,   // 0–1 from hallucination layer
): Promise<ScoringResult> {
  const startTs = Date.now();

  const retryEfficiency = scoreRetryEfficiency(totalSteps, verificationRetries);
  const toolCorrectness = scoreToolCorrectness(totalToolCalls, unknownToolCalls, failedToolCalls);

  // Convert hallucination likelihood (0–1) to inverted score (0–100)
  const noHallucinationScore = Math.round((1 - hallucinationScore) * 100);

  const overallScore = Math.round(
    retryEfficiency.score  * WEIGHTS.retryEfficiency  +
    toolCorrectness.score  * WEIGHTS.toolCorrectness  +
    noHallucinationScore   * WEIGHTS.noHallucination,
  );

  const result: ScoringResult = {
    projectId,
    runId,
    overallScore,
    retryEfficiency,
    toolCorrectness,
    hallucinationLikelihood: hallucinationScore,
    grade:    gradeFromScore(overallScore),
    elapsedMs: Date.now() - startTs,
  };

  bus.emit("agent.event", {
    runId,
    eventType:  "scoring.completed" as any,
    phase:      "score",
    ts:         Date.now(),
    payload:    { overallScore, grade: result.grade, elapsedMs: result.elapsedMs },
  });

  return result;
}
