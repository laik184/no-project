/**
 * precedence-merge.ts
 *
 * Precedence merge strategy: for each conflicting file, pick the result
 * with the highest orchestration precedence rank.
 *
 * Precedence order (deterministic):
 *   1. verified outputs (verificationPassed === true)
 *   2. higher confidence score
 *   3. lower retry count (fresher execution)
 *   4. earlier completedAt (stable tiebreak)
 */

import type { AgentResult, MergedFileState } from "../aggregation-types.ts";

export interface PrecedenceMergeResult {
  mergedFiles: MergedFileState[];
  decisions:   Array<{ filePath: string; winnerId: string; reason: string }>;
}

/**
 * Resolve conflicts across all file mutations using static precedence rules.
 * All results compete for each file; exactly one winner is selected per file.
 */
export function precedenceMerge(results: AgentResult[]): PrecedenceMergeResult {
  const fileOwners = _buildFileOwnerMap(results);
  const mergedFiles: MergedFileState[] = [];
  const decisions: Array<{ filePath: string; winnerId: string; reason: string }> = [];

  for (const [filePath, owners] of fileOwners) {
    if (owners.length === 1) {
      const { result, mutation } = owners[0];
      if (!mutation.content) continue;
      mergedFiles.push({
        filePath,
        content:    mutation.content,
        strategy:   "precedence",
        winnerId:   result.nodeId,
        confidence: result.confidence,
        mergedAt:   Date.now(),
      });
      continue;
    }

    const winner = _pickWinner(owners);
    if (!winner || !winner.mutation.content) continue;

    const reason = _describeReason(winner.result, owners.length);
    mergedFiles.push({
      filePath,
      content:    winner.mutation.content,
      strategy:   "precedence",
      winnerId:   winner.result.nodeId,
      confidence: winner.result.confidence,
      mergedAt:   Date.now(),
    });
    decisions.push({ filePath, winnerId: winner.result.nodeId, reason });
  }

  return { mergedFiles, decisions };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FileOwner { result: AgentResult; mutation: ReturnType<typeof _getMutation> }
type MutationRef = AgentResult["fileMutations"][number];

function _getMutation(result: AgentResult, filePath: string): MutationRef | undefined {
  return result.fileMutations.find(m => m.filePath === filePath);
}

function _buildFileOwnerMap(
  results: AgentResult[],
): Map<string, Array<{ result: AgentResult; mutation: MutationRef }>> {
  const map = new Map<string, Array<{ result: AgentResult; mutation: MutationRef }>>();
  for (const result of results) {
    for (const mutation of result.fileMutations) {
      if (!map.has(mutation.filePath)) map.set(mutation.filePath, []);
      map.get(mutation.filePath)!.push({ result, mutation });
    }
  }
  return map;
}

function _pickWinner(
  owners: Array<{ result: AgentResult; mutation: MutationRef }>,
): { result: AgentResult; mutation: MutationRef } | undefined {
  return [...owners].sort((a, b) => {
    const ra = a.result; const rb = b.result;
    if (ra.verificationPassed !== rb.verificationPassed)
      return ra.verificationPassed ? -1 : 1;
    if (ra.confidence !== rb.confidence)
      return rb.confidence - ra.confidence;
    if (ra.retries !== rb.retries)
      return ra.retries - rb.retries;
    return ra.completedAt - rb.completedAt;
  })[0];
}

function _describeReason(winner: AgentResult, total: number): string {
  return `Precedence winner (${total} candidates): ` +
    `verified=${winner.verificationPassed} ` +
    `confidence=${winner.confidence.toFixed(3)} ` +
    `retries=${winner.retries}`;
}
