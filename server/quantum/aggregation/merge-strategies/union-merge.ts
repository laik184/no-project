/**
 * union-merge.ts
 *
 * Union merge strategy: collects ALL unique file mutations from ALL agents.
 * Non-conflicting mutations from different owners are accepted without arbitration.
 * Used when agents write to disjoint file sets — the safe, additive default.
 */

import type { AgentResult, FileMutation, MergedFileState } from "../aggregation-types.ts";

export interface UnionMergeResult {
  mergedFiles:   MergedFileState[];
  skippedPaths:  string[];
}

/**
 * Union-merge file mutations from a list of agent results.
 * First writer wins for each unique filePath.
 * Ordered by: verificationPassed desc → confidence desc → completedAt asc.
 */
export function unionMerge(results: AgentResult[]): UnionMergeResult {
  const sorted = _sortResultsByPriority(results);
  const seen   = new Map<string, MergedFileState>();
  const skipped: string[] = [];

  for (const result of sorted) {
    for (const mutation of result.fileMutations) {
      if (mutation.operation === "delete") continue;
      if (!mutation.content) continue;

      if (seen.has(mutation.filePath)) {
        skipped.push(mutation.filePath);
        continue;
      }

      seen.set(mutation.filePath, {
        filePath:   mutation.filePath,
        content:    mutation.content,
        strategy:   "union",
        winnerId:   result.nodeId,
        confidence: result.confidence,
        mergedAt:   Date.now(),
      });
    }
  }

  return { mergedFiles: Array.from(seen.values()), skippedPaths: skipped };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _sortResultsByPriority(results: AgentResult[]): AgentResult[] {
  return [...results].sort((a, b) => {
    if (a.verificationPassed !== b.verificationPassed)
      return a.verificationPassed ? -1 : 1;
    if (a.confidence !== b.confidence)
      return b.confidence - a.confidence;
    return a.completedAt - b.completedAt;
  });
}
