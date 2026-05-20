import type { QualityBreakdown, QualityInput } from "../types.js";
import { normalizeScore } from "../utils/normalize.util.js";

const SECURITY_CRITICAL_THRESHOLD = 30;
const SECURITY_CRITICAL_MULTIPLIER = 0.8;

const RISK_HIGH_THRESHOLD = 35;
const RISK_HIGH_MULTIPLIER = 0.85;

function safeInput(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
}

function applySecurityPenalty(raw: number): number {
  const score = normalizeScore(raw);
  if (score < SECURITY_CRITICAL_THRESHOLD) {
    return normalizeScore(score * SECURITY_CRITICAL_MULTIPLIER);
  }
  return score;
}

function applyRiskPenalty(raw: number): number {
  const score = normalizeScore(raw);
  if (score < RISK_HIGH_THRESHOLD) {
    return normalizeScore(score * RISK_HIGH_MULTIPLIER);
  }
  return score;
}

export function scoreDimensions(input: QualityInput): QualityBreakdown {
  return Object.freeze({
    architecture: normalizeScore(safeInput(input.architecture)),
    security:     applySecurityPenalty(safeInput(input.security)),
    performance:  normalizeScore(safeInput(input.performance)),
    codeQuality:  normalizeScore(safeInput(input.codeQuality)),
    risk:         applyRiskPenalty(safeInput(input.risk)),
  });
}
