/**
 * lock-release.ts
 *
 * Implements releaseLock — the exit point for write ownership.
 * Enforces ownership validation and double-release protection.
 * Force-release available for emergency/recovery scenarios only.
 */

import { fileLockStore }   from "./file-lock-store.ts";
import {
  telemetryLockReleased,
  telemetryLockForceRelease,
  telemetryLockFailed,
} from "./lock-telemetry.ts";
import { FileLockOwnershipError, FileLockExpiredError } from "./lock-errors.ts";
import type { ReleaseOptions, ReleaseResult } from "./file-lock-types.ts";

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Release a lock by lockId.
 *
 * @param lockId  — the lockId returned by acquireLock
 * @param callerId — the ownerId of the caller; must match lock owner unless force=true
 * @param opts.force — bypass ownership check (emergency only; emits force_release telemetry)
 *
 * @throws FileLockOwnershipError  – caller is not the owner (without force)
 * @throws FileLockExpiredError    – lock already expired before release
 */
export function releaseLock(
  lockId:   string,
  callerId: string,
  opts:     ReleaseOptions = {},
): ReleaseResult {
  const lock = fileLockStore.getByLockId(lockId);

  // ── Lock not found — double-release or never-existed ────────────────────────
  if (!lock) {
    telemetryLockFailed({
      path:    "(unknown)",
      ownerId: callerId,
      runId:   "(unknown)",
      reason:  "lock-not-found-on-release",
    });
    return { success: false, failureReason: "lock-not-found" };
  }

  // ── Already released — idempotent no-op ─────────────────────────────────────
  if (lock.status === "released") {
    return { success: true };
  }

  // ── Already expired ──────────────────────────────────────────────────────────
  if (lock.status === "expired") {
    throw new FileLockExpiredError(lockId, lock.path, lock.expiresAt);
  }

  // ── Ownership check ──────────────────────────────────────────────────────────
  if (lock.ownerId !== callerId) {
    if (!opts.force) {
      throw new FileLockOwnershipError(lockId, lock.path, lock.ownerId, callerId);
    }
    // Force-release path
    telemetryLockForceRelease({
      lockId,
      path:    lock.path,
      ownerId: callerId,
      runId:   lock.runId,
      reason:  `force-released by ${callerId}; actual owner was ${lock.ownerId}`,
    });
    _doRelease(lockId, lock.path, lock.ownerId, lock.runId);
    return { success: true };
  }

  // ── Normal release ───────────────────────────────────────────────────────────
  _doRelease(lockId, lock.path, lock.ownerId, lock.runId);
  return { success: true };
}

/**
 * Release ALL active locks owned by a given runId.
 * Used during run cleanup / crash recovery.
 * Returns the number of locks released.
 */
export function releaseAllForRun(runId: string): number {
  const active = fileLockStore.listActive().filter(l => l.runId === runId);
  for (const lock of active) {
    _doRelease(lock.lockId, lock.path, lock.ownerId, lock.runId);
  }
  return active.length;
}

// ── Private ───────────────────────────────────────────────────────────────────

function _doRelease(lockId: string, path: string, ownerId: string, runId: string): void {
  fileLockStore.markReleased(lockId);
  fileLockStore.evict(path);
  telemetryLockReleased({ lockId, path, ownerId, runId });
}
