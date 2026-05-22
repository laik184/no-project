/**
 * memory-telemetry.ts
 *
 * Emits structured telemetry for all memory write lifecycle events.
 * Integrates with the shared event bus (server/infrastructure/events/bus.ts).
 *
 * Events emitted:
 *   memory.write.started    — write dequeued and execution begins
 *   memory.write.completed  — write committed successfully
 *   memory.write.failed     — write exhausted all retries or timed out
 *   memory.lock.wait        — waiting to acquire file lock (contended)
 *   memory.lock.acquired    — exclusive lock secured
 *   memory.lock.released    — lock released (success or rollback)
 *   memory.rollback         — temp file cleaned up after failed validation
 *   memory.retry            — a retry attempt is starting
 *   memory.recovery         — a corrupted file was recovered automatically
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type { MemoryWriteEvent } from "../../infrastructure/events/types/event.types.ts";

// ── Internal builder ──────────────────────────────────────────────────────────

function base(
  requestId:  string,
  filePath:   string,
  ownerId:    string,
  runId:      string,
  extra:      Partial<MemoryWriteEvent> = {},
): MemoryWriteEvent {
  return {
    requestId,
    filePath,
    ownerId,
    runId,
    ts: Date.now(),
    ...extra,
  };
}

// ── Emitters ──────────────────────────────────────────────────────────────────

export function emitWriteStarted(
  requestId: string,
  filePath:  string,
  ownerId:   string,
  runId:     string,
  fileType:  string,
): void {
  bus.emit("memory.write.started", base(requestId, filePath, ownerId, runId, { fileType }));
}

export function emitWriteCompleted(
  requestId:  string,
  filePath:   string,
  ownerId:    string,
  runId:      string,
  durationMs: number,
  retries:    number,
  checksum:   string,
): void {
  bus.emit("memory.write.completed", base(requestId, filePath, ownerId, runId, {
    durationMs, retries, checksum,
  }));
}

export function emitWriteFailed(
  requestId:  string,
  filePath:   string,
  ownerId:    string,
  runId:      string,
  durationMs: number,
  retries:    number,
  error:      string,
): void {
  bus.emit("memory.write.failed", base(requestId, filePath, ownerId, runId, {
    durationMs, retries, error,
  }));
}

export function emitLockWait(
  requestId: string,
  filePath:  string,
  ownerId:   string,
  runId:     string,
): void {
  bus.emit("memory.lock.wait", base(requestId, filePath, ownerId, runId));
}

export function emitLockAcquired(
  requestId: string,
  filePath:  string,
  ownerId:   string,
  runId:     string,
  lockId:    string,
): void {
  bus.emit("memory.lock.acquired", base(requestId, filePath, ownerId, runId, { lockId }));
}

export function emitLockReleased(
  requestId: string,
  filePath:  string,
  ownerId:   string,
  runId:     string,
  lockId:    string,
): void {
  bus.emit("memory.lock.released", base(requestId, filePath, ownerId, runId, { lockId }));
}

export function emitRollback(
  requestId: string,
  filePath:  string,
  ownerId:   string,
  runId:     string,
  reason:    string,
): void {
  bus.emit("memory.rollback", base(requestId, filePath, ownerId, runId, { error: reason }));
}

export function emitRetry(
  requestId:  string,
  filePath:   string,
  ownerId:    string,
  runId:      string,
  attempt:    number,
  reason:     string,
): void {
  bus.emit("memory.retry", base(requestId, filePath, ownerId, runId, {
    retries: attempt, error: reason,
  }));
}

export function emitRecovery(
  filePath: string,
  action:   string,
  reason:   string,
): void {
  bus.emit("memory.recovery", base("recovery", filePath, "memory-recovery", "system", {
    error: `${action}: ${reason}`,
  }));
}
