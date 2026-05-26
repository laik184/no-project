/**
 * consensus-merger.ts
 *
 * Produces a final unified state from aggregated path results.
 * Uses merge plan + resolved conflicts to build the winning file set.
 * Emits collapse telemetry on completion.
 */

import type { CollapsedState }     from "../types/quantum.types.ts";
import type { MergePlan, MergeResult } from "../types/merge.types.ts";
import type { AggregatedResult }   from "../types/quantum.types.ts";
import { getAllResults }             from "./result-aggregator.ts";
import { resolveAll }               from "../conflicts/conflict-resolver.ts";
import { hasUnresolved }            from "../conflicts/file-conflict-detector.ts";
import { detectConflicts }          from "../conflicts/file-conflict-detector.ts";
import { incrementCounter }         from "../../orchestration/telemetry/metrics.ts";

// ── Merger ────────────────────────────────────────────────────────────────────

export interface MergeOutput {
  collapsedState: CollapsedState;
  mergeResults:   MergeResult[];
  unresolvedConflicts: number;
}

export async function mergeToFinalState(
  plan:       MergePlan,
  aggregated: AggregatedResult,
  runId:      string,
): Promise<MergeOutput> {
  const results = getAllResults(plan.quantumRunId);

  // Step 1: Detect any remaining conflicts
  detectConflicts(plan.quantumRunId, runId, results);

  // Step 2: Resolve all conflicts
  const resolution = await resolveAll(plan.quantumRunId, runId, results);

  // Step 3: Build final file list from winner + merge results
  const primaryResult = results.get(plan.primaryPathId);
  const filesWritten  = new Set<string>(primaryResult?.filesWritten ?? []);

  // Include supplemental path files that don't conflict
  for (const supId of plan.supplementalPaths) {
    const supResult = results.get(supId);
    if (!supResult) continue;
    for (const f of supResult.filesWritten) filesWritten.add(f);
  }

  // Override with merge result files
  for (const mr of resolution.mergeResults) {
    filesWritten.add(mr.filePath);
  }

  const unresolvedCount = hasUnresolved(plan.quantumRunId)
    ? resolution.failed
    : 0;

  const winnerScore = aggregated.pathScores.get(plan.primaryPathId) ?? 0;

  const collapsedState: CollapsedState = {
    quantumRunId:       plan.quantumRunId,
    winnerPathId:       plan.primaryPathId,
    mergedPathIds:      plan.supplementalPaths,
    filesWritten:       Array.from(filesWritten),
    verificationPassed: primaryResult?.verificationPassed ?? false,
    confidenceScore:    winnerScore,
    collapsedAt:        Date.now(),
  };

  incrementCounter("quantum.consensus.merged", {
    primaryPath: plan.primaryPathId.slice(-8),
  });

  return {
    collapsedState,
    mergeResults:        resolution.mergeResults,
    unresolvedConflicts: unresolvedCount,
  };
}
