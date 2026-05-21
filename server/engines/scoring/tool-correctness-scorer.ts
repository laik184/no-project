/**
 * server/engines/scoring/tool-correctness-scorer.ts
 * Scores tool usage quality based on unknown and failed tool call rates.
 * Single responsibility: compute ToolCorrectnessScore. No side effects.
 */

import type { ToolCorrectnessScore } from "./types.ts";

function labelFromScore(score: number): ToolCorrectnessScore["label"] {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export function scoreToolCorrectness(
  totalToolCalls:   number,
  unknownToolCalls: number,
  failedToolCalls:  number,
): ToolCorrectnessScore {
  if (totalToolCalls === 0) {
    return {
      score: 100, totalToolCalls: 0,
      unknownToolCalls: 0, failedToolCalls: 0,
      label: "excellent",
    };
  }

  const unknownRate = unknownToolCalls / totalToolCalls;
  const failureRate = failedToolCalls  / totalToolCalls;

  // Unknown tool calls are worse than failures (indicates hallucination)
  const score = Math.max(
    0,
    Math.round(100 - unknownRate * 60 - failureRate * 30),
  );

  return {
    score,
    totalToolCalls,
    unknownToolCalls,
    failedToolCalls,
    label: labelFromScore(score),
  };
}
