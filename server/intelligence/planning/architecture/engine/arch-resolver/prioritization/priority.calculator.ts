import type { PriorityLevel } from "../types.js";
import type { PriorityEvaluation } from "./priority.types.js";
import { composeWeightedScore } from "../utils/weight.util.js";

export function calculatePriority(severity: number, impact: number, risk: number): Readonly<PriorityEvaluation> {
  const score = composeWeightedScore([
    { value: severity, weight: 0.5 },
    { value: impact, weight: 0.3 },
    { value: risk, weight: 0.2 },
  ]);

  const priority: PriorityLevel = score >= 75
    ? "HIGH"
    : score >= 50
      ? "MEDIUM"
      : "LOW";

  return Object.freeze({ priority, score });
}
