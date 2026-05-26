/**
 * server/quantum/telemetry/conflict-telemetry.ts
 *
 * Typed telemetry emitters for all Conflict Resolution System events.
 * All events flow through the shared EventBus as `agent.event` envelopes.
 *
 * Events covered
 * ──────────────
 *   conflict.detected  lock.acquired   lock.released
 *   merge.started      merge.completed merge.failed
 *   arbitration.started arbitration.completed
 *   retry.started      retry.completed
 *   validation.failed  coordinator.write.queued coordinator.write.committed
 */

import { bus }              from "../../infrastructure/events/bus.ts";
import { incrementCounter } from "../../orchestration/telemetry/metrics.ts";
import type { UnifiedConflict, ConflictResolutionStrategy } from "../conflicts/conflict-types.ts";

// ── Event name constants ──────────────────────────────────────────────────────

export const CONFLICT_EVENTS = {
  DETECTED:               "conflict.detected",
  LOCK_ACQUIRED:          "lock.acquired",
  LOCK_RELEASED:          "lock.released",
  MERGE_STARTED:          "merge.started",
  MERGE_COMPLETED:        "merge.completed",
  MERGE_FAILED:           "merge.failed",
  ARBITRATION_STARTED:    "arbitration.started",
  ARBITRATION_COMPLETED:  "arbitration.completed",
  RETRY_STARTED:          "retry.started",
  RETRY_COMPLETED:        "retry.completed",
  VALIDATION_FAILED:      "validation.failed",
  WRITE_QUEUED:           "coordinator.write.queued",
  WRITE_COMMITTED:        "coordinator.write.committed",
} as const;

// ── Private emit helper ───────────────────────────────────────────────────────

function emit(runId: string, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId,
    eventType: eventType as any,
    phase:     "conflict-resolution",
    ts:        Date.now(),
    payload,
  });
}

// ── Conflict lifecycle ────────────────────────────────────────────────────────

export function emitConflictDetected(conflict: UnifiedConflict): void {
  incrementCounter("conflict.detected", { type: conflict.type, severity: conflict.severity });
  emit(conflict.runId, CONFLICT_EVENTS.DETECTED, {
    conflictId:   conflict.conflictId,
    type:         conflict.type,
    severity:     conflict.severity,
    resource:     conflict.resource,
    partyCount:   conflict.parties.length,
  });
}

// ── Lock events ───────────────────────────────────────────────────────────────

export function emitLockAcquired(runId: string, filePath: string, ownerId: string, ttlMs: number): void {
  incrementCounter("conflict.lock.acquired");
  emit(runId, CONFLICT_EVENTS.LOCK_ACQUIRED, { filePath, ownerId, ttlMs });
}

export function emitLockReleased(runId: string, filePath: string, ownerId: string, heldMs: number): void {
  incrementCounter("conflict.lock.released");
  emit(runId, CONFLICT_EVENTS.LOCK_RELEASED, { filePath, ownerId, heldMs });
}

// ── Merge events ──────────────────────────────────────────────────────────────

export function emitMergeStarted(runId: string, filePath: string, strategy: ConflictResolutionStrategy): void {
  incrementCounter("conflict.merge.started", { strategy });
  emit(runId, CONFLICT_EVENTS.MERGE_STARTED, { filePath, strategy });
}

export function emitMergeCompleted(
  runId:      string,
  filePath:   string,
  strategy:   ConflictResolutionStrategy,
  durationMs: number,
  conflicts:  number,
): void {
  incrementCounter("conflict.merge.completed", { strategy });
  emit(runId, CONFLICT_EVENTS.MERGE_COMPLETED, { filePath, strategy, durationMs, conflicts });
}

export function emitMergeFailed(runId: string, filePath: string, reason: string): void {
  incrementCounter("conflict.merge.failed");
  emit(runId, CONFLICT_EVENTS.MERGE_FAILED, { filePath, reason });
}

// ── Arbitration events ────────────────────────────────────────────────────────

export function emitArbitrationStarted(runId: string, conflictId: string, resource: string): void {
  incrementCounter("conflict.arbitration.started");
  emit(runId, CONFLICT_EVENTS.ARBITRATION_STARTED, { conflictId, resource });
}

export function emitArbitrationCompleted(
  runId:       string,
  conflictId:  string,
  decision:    string,
  confidence:  number,
): void {
  incrementCounter("conflict.arbitration.completed");
  emit(runId, CONFLICT_EVENTS.ARBITRATION_COMPLETED, { conflictId, decision, confidence });
}

// ── Retry events ──────────────────────────────────────────────────────────────

export function emitRetryStarted(runId: string, conflictId: string, attempt: number, delayMs: number): void {
  incrementCounter("conflict.retry.started");
  emit(runId, CONFLICT_EVENTS.RETRY_STARTED, { conflictId, attempt, delayMs });
}

export function emitRetryCompleted(runId: string, conflictId: string, attempt: number, success: boolean): void {
  incrementCounter("conflict.retry.completed", { success: String(success) });
  emit(runId, CONFLICT_EVENTS.RETRY_COMPLETED, { conflictId, attempt, success });
}

// ── Validation events ─────────────────────────────────────────────────────────

export function emitValidationFailed(runId: string, filePath: string, issueCount: number, firstReason: string): void {
  incrementCounter("conflict.validation.failed");
  emit(runId, CONFLICT_EVENTS.VALIDATION_FAILED, { filePath, issueCount, firstReason });
}

// ── Write coordinator events ──────────────────────────────────────────────────

export function emitWriteQueued(runId: string, requestId: string, filePath: string, queueDepth: number): void {
  emit(runId, CONFLICT_EVENTS.WRITE_QUEUED, { requestId, filePath, queueDepth });
}

export function emitWriteCommitted(runId: string, requestId: string, filePath: string, durationMs: number): void {
  incrementCounter("conflict.write.committed");
  emit(runId, CONFLICT_EVENTS.WRITE_COMMITTED, { requestId, filePath, durationMs });
}
