import type { RiskLevel } from "../types";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function riskLevelFromScore(score: number): RiskLevel {
  const s = clamp(score);
  if (s >= 80) return "CRITICAL";
  if (s >= 55) return "HIGH";
  if (s >= 30) return "MEDIUM";
  return "LOW";
}

export function severityToBaseScore(severity: RiskLevel): number {
  const map: Record<RiskLevel, number> = {
    LOW: 10,
    MEDIUM: 35,
    HIGH: 60,
    CRITICAL: 90,
  };
  return map[severity];
}

export function compoundScore(baseScore: number, compoundBonus: number): number {
  return clamp(baseScore + compoundBonus);
}

export function patternCountPenalty(count: number): number {
  return clamp(count * 8, 0, 40);
}

export function chainLengthPenalty(chainLength: number): number {
  if (chainLength <= 1) return 0;
  if (chainLength <= 3) return 5;
  if (chainLength <= 6) return 12;
  return 20;
}

export function adminDiscount(score: number): number {
  return clamp(score * 0.7);
}
