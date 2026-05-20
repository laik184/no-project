import type { SeverityLabel } from "../types.js";
import { clampToScale } from "./normalize.util.js";

const DECIMAL_PRECISION = 100;

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sum = values.reduce((acc, current) => acc + current, 0);
  return clampToScale(sum / values.length);
}

export function toSeverityLabel(score: number): SeverityLabel {
  if (score >= 85) {
    return "CRITICAL";
  }

  if (score >= 70) {
    return "HIGH";
  }

  if (score >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}

export function roundScore(value: number): number {
  return Math.round(clampToScale(value) * DECIMAL_PRECISION) / DECIMAL_PRECISION;
}
