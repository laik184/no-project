/**
 * server/hallucination/types.ts
 * Shared types for hallucination detection. No logic, no side effects.
 */

export type HallucinationType =
  | "fake_dependency"
  | "nonexistent_file"
  | "invalid_import"
  | "fake_completion"
  | "repeated_strategy"
  | "unverifiable_claim";

export interface HallucinationSignal {
  type: HallucinationType;
  confidence: number; // 0–1
  evidence: string;
  location?: string; // tool name or message index
}

export interface HallucinationReport {
  runId: string;
  signals: HallucinationSignal[];
  overallConfidence: number; // 0–1, max of all signals
  shouldBlock: boolean;      // true if confidence > BLOCK_THRESHOLD
  recommendation: string;
}
