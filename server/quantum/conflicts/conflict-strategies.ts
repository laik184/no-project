/**
 * conflict-strategies.ts
 *
 * Resolution strategy implementations — extracted from conflict-resolver.ts (Phase 1 split).
 *
 * Single responsibility: SAFE_RETRY and SUPERVISOR_ARBITRATION strategy execution.
 * No conflict state management, no telemetry aggregation — those stay in resolver.
 */

import type { PathConflict }          from "../types/path.types.ts";
import type { MergeResult, MergeStrategyKind } from "../types/merge.types.ts";
import { astMerge }                    from "./ast-merge-engine.ts";
import { conflictStateStore }          from "./conflict-state-store.ts";
import {
  emitRetryStarted,
  emitRetryCompleted,
  emitArbitrationStarted,
  emitArbitrationCompleted,
} from "../telemetry/conflict-telemetry.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_SAFE_RETRIES = 2;
const RETRY_DELAY_MS   = 150;

// ── SAFE_RETRY strategy ───────────────────────────────────────────────────────

/**
 * Retry AST merge up to MAX_SAFE_RETRIES times with exponential delay.
 * Falls back to confidence-winner LAST_WRITER if all retries exhaust.
 */
export async function trySafeRetry(
  runId:        string,
  quantumRunId: string,
  conflict:     PathConflict,
  contentA:     string,
  contentB:     string,
  scoreA:       number,
  scoreB:       number,
  pathIdA:      string,
  pathIdB:      string,
  isCodeFile:   boolean,
): Promise<MergeResult> {
  for (let attempt = 1; attempt <= MAX_SAFE_RETRIES; attempt++) {
    emitRetryStarted(runId, conflict.conflictId, attempt, RETRY_DELAY_MS * attempt);
    await _sleep(RETRY_DELAY_MS * attempt);

    const retry = isCodeFile && contentA && contentB
      ? astMerge({
          filePath:    conflict.filePath,
          contentA, contentB,
          confidenceA: scoreA,
          confidenceB: scoreB,
          pathIdA, pathIdB,
        })
      : null;

    const success = retry?.success ?? false;
    emitRetryCompleted(runId, conflict.conflictId, attempt, success);
    conflictStateStore.recordRetry(quantumRunId, {
      conflictId:   conflict.conflictId, quantumRunId,
      attempt,      strategy: "SAFE_RETRY", success,
      delayMs:      RETRY_DELAY_MS * attempt, retriedAt: Date.now(),
    });

    if (retry?.success) return retry;
  }

  // Exhausted — deterministic fallback
  const winner = scoreA >= scoreB ? pathIdA : pathIdB;
  return {
    filePath:     conflict.filePath,
    strategy:     "LAST_WRITER" as MergeStrategyKind,
    winnerPathId: winner,
    content:      winner === pathIdA ? contentA : contentB,
    conflicts:    1,
    success:      false,
    reason:       "SAFE_RETRY exhausted — fell back to LAST_WRITER",
  };
}

// ── SUPERVISOR_ARBITRATION strategy ──────────────────────────────────────────

/**
 * Last-resort arbitration: log escalation + best-effort confidence winner.
 * Higher score wins; tie resolves deterministically to pathIdA.
 */
export function supervisorArbitrate(
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
    `[conflict-strategies] SUPERVISOR_ARBITRATION — conflict=${conflict.conflictId} ` +
    `file=${conflict.filePath} pathA=${pathIdA}(${scoreA.toFixed(2)}) pathB=${pathIdB}(${scoreB.toFixed(2)})`,
  );

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

// ── Helper ────────────────────────────────────────────────────────────────────

function _sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
