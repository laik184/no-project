import type { ScoreLevel } from "../types.js";
import { clampScore } from "./heuristic.engine.util.js";

export function weightedScore(parts: readonly { readonly value: number; readonly weight: number }[]): number {
  let weightedSum = 0;
  let weightSum = 0;
  for (const part of parts) {
    if (part.weight <= 0) continue;
    weightedSum += part.value * part.weight;
    weightSum += part.weight;
  }
  if (weightSum === 0) return 0;
  return clampScore(weightedSum / weightSum);
}

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "average";
  return "poor";
}
