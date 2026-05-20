import type { CouplingRisk } from "../types.js";
import {
  INSTABILITY_HIGH_RISK,
  INSTABILITY_MED_RISK,
  HEALTH_SCORE_START,
  HEALTH_DEDUCTIONS,
  LARGE_CYCLE_THRESHOLD,
} from "../types.js";

export function computeInstability(
  afferent: number,
  efferent: number,
): number {
  const total = afferent + efferent;
  if (total === 0) return 0;
  return Math.round((efferent / total) * 1000) / 1000;
}

export function riskFromInstability(instability: number): CouplingRisk {
  if (instability >= INSTABILITY_HIGH_RISK) return "CRITICAL";
  if (instability >= INSTABILITY_MED_RISK)  return "HIGH";
  if (instability > 0.25)                   return "MEDIUM";
  return "LOW";
}

export function riskFromCycleSize(size: number): CouplingRisk {
  if (size >= LARGE_CYCLE_THRESHOLD * 2) return "CRITICAL";
  if (size >= LARGE_CYCLE_THRESHOLD)     return "HIGH";
  if (size >= 3)                         return "MEDIUM";
  return "LOW";
}

export function clusterCohesion(
  internalEdges: number,
  externalEdges: number,
): number {
  const total = internalEdges + externalEdges;
  if (total === 0) return 1;
  return Math.round((internalEdges / total) * 1000) / 1000;
}

export function computeHealthScore(params: {
  cycleCount:       number;
  largeCycleCount:  number;
  highRiskCount:    number;
  criticalRiskCount: number;
  density:          number;
}): number {
  let score = HEALTH_SCORE_START;

  score -= params.cycleCount       * HEALTH_DEDUCTIONS.cycle;
  score -= params.largeCycleCount  * HEALTH_DEDUCTIONS.largeCycle;
  score -= params.highRiskCount    * HEALTH_DEDUCTIONS.highRisk;
  score -= params.criticalRiskCount * HEALTH_DEDUCTIONS.criticalRisk;

  if (params.density > 0.5) {
    score -= HEALTH_DEDUCTIONS.highDensity;
  }

  return Math.max(0, score);
}

export function avgInstabilityScore(instabilities: readonly number[]): number {
  if (instabilities.length === 0) return 0;
  const total = instabilities.reduce((s, v) => s + v, 0);
  return Math.round((total / instabilities.length) * 1000) / 1000;
}

export function formatScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
