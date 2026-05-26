/**
 * server/agents/review/review-agent.ts — STUB
 * Review agent was removed.
 */

import type { ReviewResult, ReviewCategory } from "./types.ts";

export async function runReview(opts: {
  projectId:   number;
  runId:       string;
  files:       Array<{ path: string; content: string }>;
  goal?:       string;
  focusAreas?: ReviewCategory[];
}): Promise<ReviewResult> {
  return {
    passed:   true,
    score:    1.0,
    summary:  "Review agent removed — auto-passing.",
    blockers: [],
    warnings: [],
  };
}
