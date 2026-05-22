/**
 * quantum-engine.ts
 *
 * Public facade for the Quantum Superposition Path System.
 * Entry point: call runQuantum(input) to execute a full quantum run.
 *
 * Flow:
 *   QuantumEngine → TaskPartitioner → PathSpawner → N parallel workers
 *   → ResultAggregator → ConflictResolver → ConsensusMerger
 *   → CollapseValidator → PathCollapse → CollapsedState
 */

import { v4 as uuid }             from "uuid";
import type { QuantumRunInput, QuantumRunResult, CollapseStrategy } from "../types/quantum.types.ts";
import { partitionGoal }          from "../scheduler/task-partitioner.ts";
import { spawnAndSubmit }         from "./path-spawner.ts";
import { collapseRun }            from "./path-collapse.ts";
import { waitForMinimum, cleanup, getSnapshot } from "../superposition/superposition-manager.ts";
import {
  telemetryRunStarted,
  telemetryRunCompleted,
  telemetryRunFailed,
} from "../telemetry/quantum-telemetry.ts";
import { releaseAllForRun }       from "../conflicts/write-lock-manager.ts";
import { clearConflicts }         from "../conflicts/file-conflict-detector.ts";
import { clearResults }           from "../aggregation/result-aggregator.ts";
import { clearResolutionCache }   from "../conflicts/conflict-resolver.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_PATHS   = 3;
const DEFAULT_TIMEOUT_MS  = 15 * 60 * 1_000;   // 15 minutes
const MIN_VIABLE_PATHS    = 1;

// ── Public API ────────────────────────────────────────────────────────────────

export async function runQuantum(
  partial: Omit<QuantumRunInput, "quantumRunId"> & { quantumRunId?: string },
): Promise<QuantumRunResult> {
  const input: QuantumRunInput = {
    ...partial,
    quantumRunId: partial.quantumRunId ?? `qrun-${uuid().slice(0, 8)}`,
    maxPaths:     partial.maxPaths     ?? DEFAULT_MAX_PATHS,
    timeoutMs:    partial.timeoutMs    ?? DEFAULT_TIMEOUT_MS,
    sandboxRoot:  partial.sandboxRoot  ?? "/tmp/quantum",
  };

  const t0 = Date.now();
  console.info(`[quantum-engine] START quantumRunId=${input.quantumRunId} runId=${input.runId}`);

  // Step 1: Partition goal into strategies
  const { strategies, rationale } = partitionGoal(
    input.goal,
    input.maxPaths,
    input.strategies,
  );

  console.info(
    `[quantum-engine] Partitioned into ${strategies.length} strategies. ${rationale}`,
  );

  telemetryRunStarted(input.quantumRunId, input.runId, strategies.length);

  let collapsedPathIds: string[] = [];
  let discardedPathIds: string[] = [];

  try {
    // Step 2: Spawn and submit all paths to worker pool
    const { paths } = await spawnAndSubmit(input, strategies);

    // Step 3: Wait for minimum viable paths to complete
    const viable = await waitForMinimum(
      input.quantumRunId,
      MIN_VIABLE_PATHS,
      input.timeoutMs,
    );

    if (!viable) {
      throw new Error("No paths completed within timeout — quantum run aborted");
    }

    const snap = getSnapshot(input.quantumRunId);
    console.info(
      `[quantum-engine] Snapshot: total=${snap.total} ` +
      `running=${snap.running} completed=${snap.completed} failed=${snap.failed}`,
    );

    // Step 4: Collapse
    const collapseResult = await collapseRun(input.quantumRunId, input.runId);

    if (!collapseResult.success || !collapseResult.state) {
      throw new Error(`Collapse failed: ${collapseResult.error}`);
    }

    const state = collapseResult.state;
    collapsedPathIds  = [state.winnerPathId, ...state.mergedPathIds];
    discardedPathIds  = paths
      .filter(p => !collapsedPathIds.includes(p.pathId))
      .map(p => p.pathId);

    const durationMs = Date.now() - t0;
    telemetryRunCompleted(input.quantumRunId, input.runId, durationMs);

    console.info(
      `[quantum-engine] COMPLETE quantumRunId=${input.quantumRunId} ` +
      `winner=${state.winnerPathId} confidence=${state.confidenceScore.toFixed(2)} ` +
      `dur=${durationMs}ms`,
    );

    return {
      quantumRunId:   input.quantumRunId,
      runId:          input.runId,
      success:        true,
      selectedPath:   state.winnerPathId,
      mergedPaths:    state.mergedPathIds,
      discardedPaths: discardedPathIds,
      finalState:     state,
      durationMs,
    };

  } catch (err) {
    const errMsg = (err as Error).message;
    const durationMs = Date.now() - t0;
    telemetryRunFailed(input.quantumRunId, input.runId, errMsg);
    console.error(`[quantum-engine] FAILED quantumRunId=${input.quantumRunId}: ${errMsg}`);

    return {
      quantumRunId:   input.quantumRunId,
      runId:          input.runId,
      success:        false,
      selectedPath:   null,
      mergedPaths:    [],
      discardedPaths: discardedPathIds,
      finalState:     null,
      durationMs,
      error:          errMsg,
    };

  } finally {
    // Step 5: Always clean up resources to prevent memory leaks
    _cleanup(input.quantumRunId);
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function _cleanup(quantumRunId: string): void {
  try {
    releaseAllForRun(quantumRunId);
    clearConflicts(quantumRunId);
    clearResults(quantumRunId);
    clearResolutionCache(quantumRunId);
    cleanup(quantumRunId);
  } catch (err) {
    console.warn(`[quantum-engine] Cleanup error: ${(err as Error).message}`);
  }
}

// ── Trigger condition check ───────────────────────────────────────────────────

export { shouldUseQuantum } from "../scheduler/task-partitioner.ts";
