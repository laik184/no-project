import { clampScore } from "./normalization.util.js";

export function weightedScore(value: number, weight: number): number {
  return clampScore(value) * weight;
}

export function composeWeightedScore(parts: readonly { readonly value: number; readonly weight: number }[]): number {
  const score = parts.reduce((sum, part) => sum + weightedScore(part.value, part.weight), 0);
  return Number(score.toFixed(2));
}
