/**
 * result-aggregator.ts
 *
 * Collects, normalises, and scores results from all completed execution paths.
 * Emits aggregation telemetry. Supports partial completion (some paths failed).
 */

import type { PathResult }         from "../types/path.types.ts";
import type { NormalizedPathOutput, MergePlan } from "../types/merge.types.ts";
import type { AggregatedResult }   from "../types/quantum.types.ts";
import type { ExecutionPath }      from "../types/path.types.ts";
import { rankPaths, findMergeGroups } from "./confidence-scorer.ts";
import { incrementCounter }         from "../../orchestration/telemetry/metrics.ts";

// ── Result collection store ───────────────────────────────────────────────────
// quantumRunId → Map<pathId, PathResult>

const _results = new Map<string, Map<string, PathResult>>();

// ── Collection ────────────────────────────────────────────────────────────────

export function recordPathResult(quantumRunId: string, result: PathResult): void {
  if (!_results.has(quantumRunId)) _results.set(quantumRunId, new Map());
  _results.get(quantumRunId)!.set(result.pathId, result);
  incrementCounter("quantum.aggregator.result_recorded", {
    success: String(result.success),
  });
}

export function getResult(quantumRunId: string, pathId: string): PathResult | undefined {
  return _results.get(quantumRunId)?.get(pathId);
}

export function getAllResults(quantumRunId: string): Map<string, PathResult> {
  return _results.get(quantumRunId) ?? new Map();
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizeOutput(result: PathResult): NormalizedPathOutput {
  const filesWritten = new Map<string, string>();
  for (const f of result.filesWritten) filesWritten.set(f, "");

  return {
    pathId:       result.pathId,
    filesWritten,
    exports:      new Map(),
    imports:      new Map(),
    errorCount:   result.success ? 0 : 1,
    warningCount: 0,
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export function aggregate(
  quantumRunId: string,
  paths:        ExecutionPath[],
): AggregatedResult {
  const results      = getAllResults(quantumRunId);
  const completedIds: string[] = [];
  const failedIds:    string[] = [];
  const pathScores    = new Map<string, number>();

  for (const [pathId, result] of results) {
    if (result.success && result.verificationPassed) completedIds.push(pathId);
    else                                             failedIds.push(pathId);
  }

  // Score and rank completed paths
  const completedPaths = paths.filter(p => completedIds.includes(p.pathId));
  const rankings       = rankPaths(completedPaths, results);
  for (const r of rankings) pathScores.set(r.pathId, r.confidenceScore);

  // Find merge groups
  const completedResults = new Map<string, PathResult>(
    completedIds.map(id => [id, results.get(id)!]),
  );
  const mergeables = findMergeGroups(completedResults);

  incrementCounter("quantum.aggregator.paths_aggregated", {
    completed: String(completedIds.length),
    failed:    String(failedIds.length),
  });

  return { quantumRunId, completedPaths: completedIds, failedPaths: failedIds,
           pathScores, mergeables };
}

// ── Merge plan builder ────────────────────────────────────────────────────────

export function buildMergePlan(
  aggregated: AggregatedResult,
): MergePlan {
  const ranked    = Array.from(aggregated.pathScores.entries())
    .sort(([, a], [, b]) => b - a);
  const primaryId = ranked[0]?.[0] ?? "";
  const supplemental = ranked.slice(1).map(([id]) => id);

  return {
    quantumRunId:       aggregated.quantumRunId,
    primaryPathId:      primaryId,
    supplementalPaths:  supplemental,
    fileDecisions:      new Map(),
    estimatedConflicts: 0,
    createdAt:          Date.now(),
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearResults(quantumRunId: string): void {
  _results.delete(quantumRunId);
}
