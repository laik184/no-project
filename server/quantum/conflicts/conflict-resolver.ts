/**
 * server/quantum/conflicts/conflict-resolver.ts
 *
 * Orchestrates conflict resolution for all detected path conflicts.
 * Resolution pipeline (in order of preference):
 *   1. AST_MERGE          — structural block-level merge for code files
 *   2. CONFIDENCE_WINNER  — pick the higher-confidence path
 *   3. SAFE_RETRY         — brief backoff then re-attempt merge (≤2 retries)
 *   4. SUPERVISOR_ARBITRATION — logged escalation with best-effort fallback
 *
 * Emits telemetry on every resolution attempt.
 * Integrates with ConflictStateStore for replay-safe tracking.
 */

import type { PathConflict }         from "../types/path.types.ts";
import type { MergeResult, MergeStrategyKind } from "../types/merge.types.ts";
import type { PathResult }            from "../types/path.types.ts";
import { astMerge }                   from "./ast-merge-engine.ts";
import { markResolved, getUnresolved } from "./file-conflict-detector.ts";
import { telemetryConflictResolved }  from "../telemetry/quantum-telemetry.ts";
import { conflictStateStore }         from "./conflict-state-store.ts";
import {
  emitMergeStarted,
  emitMergeCompleted,
  emitMergeFailed,
  emitArbitrationStarted,
  emitArbitrationCompleted,
  emitRetryStarted,
  emitRetryCompleted,
} from "../telemetry/conflict-telemetry.ts";
import { getPath } from "../superposition/path-registry.ts";

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

// ── Resolution summary ────────────────────────────────────────────────────────

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

// ── Single-conflict resolution pipeline ──────────────────────────────────────

async function _resolveOne(
  quantumRunId: string,
  runId:        string,
  conflict:     PathConflict,
  _results:     Map<string, PathResult>,
): Promise<MergeResult> {
  const [pathIdA, pathIdB] = conflict.pathIds;
  const pathA    = getPath(quantumRunId, pathIdA);
  const pathB    = getPath(quantumRunId, pathIdB);
  const scoreA   = pathA?.confidenceScore ?? 0.5;
  const scoreB   = pathB?.confidenceScore ?? 0.5;
  const contents = getFileContents(quantumRunId, conflict.filePath);
  const contentA = contents.get(pathIdA) ?? "";
  const contentB = contents.get(pathIdB) ?? "";
  const t0       = Date.now();

  conflictStateStore.updateStatus(quantumRunId, conflict.conflictId, "resolving");

  // ── Strategy 1: AST merge ──────────────────────────────────────────────────
  let result: MergeResult | null = null;

  if (_isCodeFile(conflict.filePath) && contentA && contentB) {
    emitMergeStarted(runId, conflict.filePath, "AST_MERGE");
    const attempt = astMerge({
      filePath: conflict.filePath,
      contentA, contentB,
      confidenceA: scoreA,
      confidenceB: scoreB,
      pathIdA, pathIdB,
    });

    if (attempt.success) {
      emitMergeCompleted(runId, conflict.filePath, "AST_MERGE", Date.now() - t0, attempt.conflicts);
      result = attempt;
    } else {
      emitMergeFailed(runId, conflict.filePath, attempt.reason);
    }
  }

  // ── Strategy 2: Confidence winner ─────────────────────────────────────────
  if (!result) {
    const winner = scoreA >= scoreB ? pathIdA : pathIdB;
    result = {
      filePath:     conflict.filePath,
      strategy:     "CONFIDENCE_WINNER",
      winnerPathId: winner,
      content:      winner === pathIdA ? contentA : contentB,
      conflicts:    1,
      success:      true,
      reason:       `Confidence winner: ${winner} (score=${winner === pathIdA ? scoreA : scoreB})`,
    };
  }

  // ── Strategy 3: SAFE_RETRY (if confidence scores are identical) ────────────
  if (!result.success || (scoreA === scoreB && !contentA && !contentB)) {
    result = await _trySafeRetry(runId, quantumRunId, conflict, contentA, contentB, scoreA, scoreB, pathIdA, pathIdB, t0);
  }

  // ── Strategy 4: SUPERVISOR_ARBITRATION (last resort) ──────────────────────
  if (!result.success) {
    result = _supervisorArbitrate(runId, conflict, contentA, contentB, scoreA, scoreB, pathIdA, pathIdB);
  }

  // ── Finalize ───────────────────────────────────────────────────────────────
  const resolution = result.success ? "merged" : "path_a_wins";
  markResolved(quantumRunId, conflict.conflictId, result.winnerPathId, resolution);
  conflictStateStore.resolveConflict(quantumRunId, conflict.conflictId, result.strategy as any, result.winnerPathId);
  conflictStateStore.recordMerge(quantumRunId, {
    conflictId:   conflict.conflictId,
    quantumRunId,
    filePath:     conflict.filePath,
    strategy:     result.strategy as any,
    winnerPathId: result.winnerPathId,
    success:      result.success,
    durationMs:   Date.now() - t0,
    mergedAt:     Date.now(),
    reason:       result.reason,
  });

  telemetryConflictResolved(
    { ...conflict, resolved: true, winnerPathId: result.winnerPathId },
    runId,
    result.strategy,
  );

  return result;
}

// ── SAFE_RETRY strategy ───────────────────────────────────────────────────────

const MAX_SAFE_RETRIES = 2;
const RETRY_DELAY_MS   = 150;

async function _trySafeRetry(
  runId: string,
  quantumRunId: string,
  conflict: PathConflict,
  contentA: string,
  contentB: string,
  scoreA: number,
  scoreB: number,
  pathIdA: string,
  pathIdB: string,
  t0: number,
): Promise<MergeResult> {
  for (let attempt = 1; attempt <= MAX_SAFE_RETRIES; attempt++) {
    emitRetryStarted(runId, conflict.conflictId, attempt, RETRY_DELAY_MS * attempt);
    await _sleep(RETRY_DELAY_MS * attempt);

    const retry = _isCodeFile(conflict.filePath) && contentA && contentB
      ? astMerge({ filePath: conflict.filePath, contentA, contentB, confidenceA: scoreA, confidenceB: scoreB, pathIdA, pathIdB })
      : null;

    const success = retry?.success ?? false;
    emitRetryCompleted(runId, conflict.conflictId, attempt, success);
    conflictStateStore.recordRetry(quantumRunId, {
      conflictId: conflict.conflictId, quantumRunId,
      attempt, strategy: "SAFE_RETRY", success,
      delayMs: RETRY_DELAY_MS * attempt, retriedAt: Date.now(),
    });

    if (retry?.success) return retry;
  }

  // Safe-retry exhausted — return best-effort confidence winner
  const winner = scoreA >= scoreB ? pathIdA : pathIdB;
  return {
    filePath: conflict.filePath,
    strategy: "LAST_WRITER" as MergeStrategyKind,
    winnerPathId: winner,
    content: winner === pathIdA ? contentA : contentB,
    conflicts: 1,
    success: false,
    reason:  "SAFE_RETRY exhausted — fell back to LAST_WRITER",
  };
}

// ── SUPERVISOR_ARBITRATION strategy ──────────────────────────────────────────

function _supervisorArbitrate(
  runId:    string,
  conflict: PathConflict,
  contentA: string,
  contentB: string,
  scoreA:   number,
  scoreB:   number,
  pathIdA:  string,
  pathIdB:  string,
): MergeResult {
  emitArbitrationStarted(runId, conflict.conflictId, conflict.filePath);
  console.warn(
    `[conflict-resolver] SUPERVISOR_ARBITRATION escalation — conflict ${conflict.conflictId} ` +
    `file=${conflict.filePath} pathA=${pathIdA}(${scoreA.toFixed(2)}) pathB=${pathIdB}(${scoreB.toFixed(2)})`,
  );

  // Best-effort: higher score wins; tie → prefer A (deterministic ordering)
  const winner  = scoreA >= scoreB ? pathIdA : pathIdB;
  const content = winner === pathIdA ? contentA : contentB;

  emitArbitrationCompleted(runId, conflict.conflictId, `winner=${winner}`, Math.max(scoreA, scoreB));

  return {
    filePath:     conflict.filePath,
    strategy:     "SUPERVISOR_ARBITRATE" as MergeStrategyKind,
    winnerPathId: winner,
    content,
    conflicts:    1,
    success:      true,
    reason:       `Supervisor arbitration: winner=${winner} score=${Math.max(scoreA, scoreB).toFixed(2)}`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _isCodeFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|mts|mjs)$/.test(filePath);
}

function _sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearResolutionCache(quantumRunId: string): void {
  for (const k of Array.from(_fileContents.keys())) {
    if (k.startsWith(`${quantumRunId}:`)) _fileContents.delete(k);
  }
  conflictStateStore.clear(quantumRunId);
}
