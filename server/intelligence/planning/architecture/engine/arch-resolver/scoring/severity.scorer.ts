import type { AnalysisViolation } from "../types.js";

const SEVERITY_SCORE = Object.freeze<Record<AnalysisViolation["severity"], number>>({
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
});

export function scoreSeverity(violation: Readonly<AnalysisViolation>): number {
  return SEVERITY_SCORE[violation.severity] ?? 25;
}
