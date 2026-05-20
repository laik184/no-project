import type { ImpactLevel, OptimizationFinding } from "../types.js";
import {
  SCORE_CRITICAL,
  SCORE_HIGH,
  SCORE_MEDIUM,
  SCORE_LOW,
} from "../types.js";

export function impactToScore(impact: ImpactLevel): number {
  switch (impact) {
    case "CRITICAL": return SCORE_CRITICAL;
    case "HIGH":     return SCORE_HIGH;
    case "MEDIUM":   return SCORE_MEDIUM;
    case "LOW":      return SCORE_LOW;
  }
}

export function scoreToImpact(score: number): ImpactLevel {
  if (score >= SCORE_CRITICAL)           return "CRITICAL";
  if (score >= SCORE_HIGH)               return "HIGH";
  if (score >= SCORE_MEDIUM)             return "MEDIUM";
  return "LOW";
}

export function clampScore(score: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, score));
}

export function normalizePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return clampScore((value / total) * 100);
}

export function blendScore(base: number, multiplier: number): number {
  return clampScore(Math.round(base * multiplier));
}

export function sumScores(findings: readonly OptimizationFinding[]): number {
  return findings.reduce((acc, f) => acc + f.score, 0);
}

export function countByImpact(
  findings: readonly OptimizationFinding[],
  impact:   ImpactLevel,
): number {
  return findings.filter((f) => f.impact === impact).length;
}

export function topFinding(
  findings: readonly OptimizationFinding[],
): OptimizationFinding | null {
  if (findings.length === 0) return null;
  return [...findings].sort((a, b) => b.score - a.score)[0] ?? null;
}

export function makeFindingId(prefix: string, counter: number): string {
  return `${prefix}-${String(counter).padStart(4, "0")}`;
}

let _seq = 0;
export function nextSeq(): number {
  _seq += 1;
  return _seq;
}

export function resetSeq(): void {
  _seq = 0;
}
