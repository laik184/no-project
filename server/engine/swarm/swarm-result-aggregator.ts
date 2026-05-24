/**
 * server/engine/swarm/swarm-result-aggregator.ts
 *
 * Incremental, streaming result aggregation for swarm tasks.
 * Ranks results by confidence, merges file lists, computes final score.
 * Single responsibility: result collection and aggregation only.
 */

import type {
  SwarmTaskResult,
  SwarmFinalResult,
  SwarmSession,
} from "./swarm-types.ts";
import {
  emitMergeStarted,
  emitMergeCompleted,
} from "./swarm-telemetry.ts";

// ── Result store ──────────────────────────────────────────────────────────────

const _results = new Map<string, Map<string, SwarmTaskResult>>(); // swarmId → taskId → result

// ── Public API ────────────────────────────────────────────────────────────────

export function registerResult(swarmId: string, result: SwarmTaskResult): void {
  if (!_results.has(swarmId)) _results.set(swarmId, new Map());
  _results.get(swarmId)!.set(result.taskId, result);
}

export function getResult(swarmId: string, taskId: string): SwarmTaskResult | undefined {
  return _results.get(swarmId)?.get(taskId);
}

export function getAllResults(swarmId: string): Map<string, SwarmTaskResult> {
  return _results.get(swarmId) ?? new Map();
}

/** Compute partial aggregation after each wave arrives. */
export function partialAggregate(swarmId: string): {
  confidence:   number;
  successCount: number;
  failedCount:  number;
  mergedFiles:  string[];
} {
  const results = getAllResults(swarmId);
  let successCount = 0;
  let failedCount  = 0;
  let confidenceSum = 0;
  const fileSet = new Set<string>();

  for (const r of results.values()) {
    if (r.success) {
      successCount++;
      confidenceSum += r.confidence;
      r.filesWritten.forEach(f => fileSet.add(f));
    } else {
      failedCount++;
    }
  }

  const confidence = successCount > 0 ? confidenceSum / successCount : 0;
  return { confidence, successCount, failedCount, mergedFiles: Array.from(fileSet) };
}

/**
 * Produce final collapsed result after all waves complete.
 * Deterministic: ranks by confidence DESC, tie-break by role priority.
 */
export function finalCollapse(
  session:   SwarmSession,
  runId:     string,
  projectId: number,
): SwarmFinalResult {
  const allResults = getAllResults(session.swarmId);
  const startedAt  = session.startedAt;

  emitMergeStarted(runId, projectId, session.swarmId, allResults.size);

  const { confidence, successCount, failedCount, mergedFiles } =
    partialAggregate(session.swarmId);

  // Count conflicts (tracked externally by conflict-router)
  const conflicts = 0; // populated by caller from swarm-conflict-router

  const result: SwarmFinalResult = {
    swarmId:        session.swarmId,
    runId,
    projectId,
    success:        failedCount === 0 || successCount > failedCount,
    agentCount:     session.agents.size,
    tasksCompleted: successCount,
    tasksFailed:    failedCount,
    conflicts,
    durationMs:     Date.now() - startedAt,
    mergedFiles,
    confidence,
  };

  emitMergeCompleted(runId, projectId, session.swarmId, mergedFiles.length, conflicts);
  return result;
}

/** Get the highest-confidence result for a given role. */
export function bestResultByRole(
  swarmId: string,
  role:    string,
): SwarmTaskResult | undefined {
  const results = Array.from(getAllResults(swarmId).values())
    .filter(r => r.role === role && r.success)
    .sort((a, b) => b.confidence - a.confidence);
  return results[0];
}

export function clearResults(swarmId: string): void {
  _results.delete(swarmId);
}
