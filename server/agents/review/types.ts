/**
 * server/agents/review/types.ts — STUB
 */

export type ReviewCategory = "quality" | "security" | "architecture" | "style";

export interface ReviewResult {
  passed:   boolean;
  score:    number;
  summary:  string;
  blockers: string[];
  warnings: string[];
}
