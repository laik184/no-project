import type { PriorityLevel } from "../types.js";

export interface PriorityEvaluation {
  readonly priority: PriorityLevel;
  readonly score: number;
}

export interface UrgencyAssessment {
  readonly urgent: boolean;
  readonly blocksDeployment: boolean;
  readonly reason: string;
}
