/**
 * conflict-resolver.ts
 *
 * Orchestrates conflict resolution for all detected path conflicts.
 * Tries strategies in order: AST_MERGE → CONFIDENCE_WINNER → SUPERVISOR_ARBITRATE.
 * Emits telemetry on every resolution.
 */

import type { PathConflict } from "../types/path.types.ts";
import type { MergeResult, MergeStrategyKind } from "../types/merge.types.ts";
import type { PathResult } from "../types/path.types.ts";
import { astMerge }        from "./ast-merge-engine.ts";
import { markResolved, getUnresolved } from "./file-conflict-detector.ts";
import { telemetryConflictResolved }   from "../telemetry/quantum-telemetry.ts";
import { getPath }                     from "../superposition/path-registry.ts";

// ── Per-file content cache (populated by quantum-runner) ──────────────────────
// quantumRunId:filePath → Map<pathId, content>

const _fileContents = new Map<string, Map<string, string>>();

export function cacheFileContent(
  quantumRunId: string,
  pathId:       string,
  filePath:     string,
  content:      string,
): void {
  const k = `${quantumRunId}:${filePath}`;
  if (!_fileContents.has(k)) _fileContents.set(k, new Map());
  _fileContents.get(k)!.set(pathId, content);
}

export function getFileContents(quantumRunId: string, filePath: string): Map<string, string> {
  return _fileContents.get(`${quantumRunId}:${filePath}`) ?? new Map();
}

// ── Resolution ────────────────────────────────────────────────────────────────

export interface ResolutionSummary {
  resolved:     number;
  failed:       number;
  mergeResults: MergeResult[];
}

export async function resolveAll(
  quantumRunId: string,
  runId:        string,
  results:      Map<string, PathResult>,
): Promise<ResolutionSummary> {
  const unresolved = getUnresolved(quantumRunId);
  const mergeResults: MergeResult[] = [];
  let   resolved = 0;
  let   failed   = 0;

  for (const conflict of unresolved) {
    try {
      const result = await _resolveOne(quantumRunId, runId, conflict, results);
      mergeResults.push(result);
      if (result.success) resolved++;
      else                failed++;
    } catch (err) {
      failed++;
      console.error(`[conflict-resolver] Failed to resolve ${conflict.conflictId}:`, err);
    }
  }

  return { resolved, failed, mergeResults };
}

async function _resolveOne(
  quantumRunId: string,
  runId:        string,
  conflict:     PathConflict,
  _results:     Map<string, PathResult>,
): Promise<MergeResult> {
  const [pathIdA, pathIdB] = conflict.pathIds;
  const pathA = getPath(quantumRunId, pathIdA);
  const pathB = getPath(quantumRunId, pathIdB);

  const scoreA  = pathA?.confidenceScore ?? 0.5;
  const scoreB  = pathB?.confidenceScore ?? 0.5;
  const contents = getFileContents(quantumRunId, conflict.filePath);
  const contentA = contents.get(pathIdA) ?? "";
  const contentB = contents.get(pathIdB) ?? "";

  let result: MergeResult;
  let strategy: MergeStrategyKind;

  // Strategy 1: AST merge for TypeScript/JavaScript files
  if (_isCodeFile(conflict.filePath) && contentA && contentB) {
    result   = astMerge({ filePath: conflict.filePath,
      contentA, contentB, confidenceA: scoreA, confidenceB: scoreB,
      pathIdA, pathIdB });
    strategy = result.success ? "AST_MERGE" : "CONFIDENCE_WINNER";
  } else {
    // Strategy 2: Confidence winner
    const winner = scoreA >= scoreB ? pathIdA : pathIdB;
    result   = {
      filePath:    conflict.filePath,
      strategy:    "CONFIDENCE_WINNER",
      winnerPathId: winner,
      content:     winner === pathIdA ? contentA : contentB,
      conflicts:   1,
      success:     true,
      reason:      `Confidence winner: ${winner} (score=${winner === pathIdA ? scoreA : scoreB})`,
    };
    strategy = "CONFIDENCE_WINNER";
  }

  // Mark resolved in detector registry
  const resolution = result.success ? "merged" : "path_a_wins";
  markResolved(quantumRunId, conflict.conflictId, result.winnerPathId, resolution);
  telemetryConflictResolved(
    { ...conflict, resolved: true, winnerPathId: result.winnerPathId },
    runId,
    strategy,
  );

  return result;
}

function _isCodeFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mts|mjs)$/.test(filePath);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearResolutionCache(quantumRunId: string): void {
  for (const k of Array.from(_fileContents.keys())) {
    if (k.startsWith(`${quantumRunId}:`)) _fileContents.delete(k);
  }
}
