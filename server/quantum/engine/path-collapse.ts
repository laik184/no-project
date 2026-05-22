/**
 * path-collapse.ts
 *
 * Orchestrates the collapse phase: selects best path, merges compatible paths,
 * validates the final state, and produces a deterministic CollapsedState.
 * Emits collapse telemetry at every step.
 */

import type { CollapsedState, AggregatedResult } from "../types/quantum.types.ts";
import { selectBestPath }      from "./path-selector.ts";
import { aggregate, buildMergePlan, getAllResults } from "../aggregation/result-aggregator.ts";
import { mergeToFinalState }   from "../aggregation/consensus-merger.ts";
import { validateBeforeCollapse } from "../verification/collapse-validator.ts";
import { validateConsensus }   from "../verification/consensus-validator.ts";
import { getPathsForRun }      from "../superposition/path-registry.ts";
import {
  telemetryCollapseStarted,
  telemetryCollapseCompleted,
} from "../telemetry/quantum-telemetry.ts";
import {
  recordCollapseMetrics,
} from "../telemetry/collapse-metrics.ts";

// ── Collapse result ───────────────────────────────────────────────────────────

export interface CollapseResult {
  success:       boolean;
  state:         CollapsedState | null;
  error?:        string;
  durationMs:    number;
  validation:    string[];   // blocking gate names if failed
}

// ── Collapse engine ───────────────────────────────────────────────────────────

export async function collapseRun(
  quantumRunId: string,
  runId:        string,
): Promise<CollapseResult> {
  const t0    = Date.now();
  const paths = getPathsForRun(quantumRunId);

  telemetryCollapseStarted(quantumRunId, runId, paths.length);

  try {
    // Step 1: Aggregate all results and rank
    const aggregated: AggregatedResult = aggregate(quantumRunId, paths);

    if (aggregated.completedPaths.length === 0) {
      return _fail("No completed paths available for collapse", t0, []);
    }

    // Step 2: Select winner
    const selection = selectBestPath(quantumRunId, aggregated);
    if (!selection) {
      return _fail("Path selection returned null — no viable winner", t0, []);
    }

    // Step 3: Build merge plan
    const mergePlan  = buildMergePlan(aggregated);
    mergePlan.primaryPathId     = selection.winnerId;
    mergePlan.supplementalPaths = selection.alternatives.slice(0, 2);

    // Step 4: Merge to final state
    const { collapsedState, mergeResults, unresolvedConflicts } =
      await mergeToFinalState(mergePlan, aggregated, runId);

    if (unresolvedConflicts > 0) {
      return _fail(`${unresolvedConflicts} conflict(s) could not be resolved`, t0, []);
    }

    // Step 5: Pre-collapse validation (fail-closed gate)
    const collapseValidation = validateBeforeCollapse(aggregated, collapsedState);
    if (!collapseValidation.allowed) {
      return _fail(
        `Collapse blocked by gates: ${collapseValidation.blockingGates.join(", ")}`,
        t0,
        collapseValidation.blockingGates,
      );
    }

    // Step 6: Consensus validation
    const consensusValidation = validateConsensus(collapsedState, mergeResults);
    if (!consensusValidation.valid) {
      return _fail(
        `Consensus invalid: ${consensusValidation.errors.join("; ")}`,
        t0,
        ["consensus_invalid"],
      );
    }

    const durationMs = Date.now() - t0;
    telemetryCollapseCompleted(quantumRunId, runId, durationMs, selection.winnerId);

    // Step 7: Record collapse metrics
    const results = getAllResults(quantumRunId);
    recordCollapseMetrics({
      quantumRunId,
      totalPaths:         paths.length,
      succeededPaths:     aggregated.completedPaths.length,
      failedPaths:        aggregated.failedPaths.length,
      mergedPaths:        mergePlan.supplementalPaths.length,
      conflictsDetected:  mergeResults.length,
      conflictsResolved:  mergeResults.filter(r => r.success).length,
      winnerConfidence:   selection.score,
      collapseDurationMs: durationMs,
      verificationPassed: collapsedState.verificationPassed,
    });

    return { success: true, state: collapsedState, durationMs, validation: [] };

  } catch (err) {
    return _fail((err as Error).message, t0, ["unexpected_error"]);
  }
}

function _fail(
  error:      string,
  t0:         number,
  validation: string[],
): CollapseResult {
  console.error(`[path-collapse] FAILED: ${error}`);
  return {
    success:    false,
    state:      null,
    error,
    durationMs: Date.now() - t0,
    validation,
  };
}
