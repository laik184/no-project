import type { Intent, RiskLevel, Complexity } from '../types.ts';

const INTENT_PRIORITY: Record<Intent, number> = {
  fix: 100,
  deploy: 90,
  generate: 70,
  optimize: 60,
  analyze: 50,
};

const RISK_MULTIPLIER: Record<RiskLevel, number> = {
  critical: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.8,
};

const COMPLEXITY_FACTOR: Record<Complexity, number> = {
  high: 1.4,
  medium: 1.0,
  low: 0.7,
};

export function intentPriority(intent: Intent): number {
  return INTENT_PRIORITY[intent] ?? 50;
}

export function riskMultiplier(riskLevel: RiskLevel): number {
  return RISK_MULTIPLIER[riskLevel] ?? 1.0;
}

export function complexityFactor(complexity: Complexity): number {
  return COMPLEXITY_FACTOR[complexity] ?? 1.0;
}

export function finalPriority(intent: Intent, riskLevel: RiskLevel, complexity: Complexity): number {
  return intentPriority(intent) * riskMultiplier(riskLevel) * complexityFactor(complexity);
}

export function rankByPriority<T extends { score: number }>(options: T[]): T[] {
  return [...options].sort((a, b) => b.score - a.score);
}
