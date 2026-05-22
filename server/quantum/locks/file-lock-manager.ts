/**
 * file-lock-manager.ts
 *
 * Public facade for the FileLockManager system.
 * Single entry point for all lock operations — callers never touch subsystems directly.
 *
 * Lifecycle:
 *   acquireLock → [write → heartbeat...] → releaseLock
 *                                       ↗
 *          startStaleLockCleaner (background)
 */

import { acquireLock }                          from "./lock-acquisition.ts";
import { releaseLock, releaseAllForRun }        from "./lock-release.ts";
import { fileLockStore }                        from "./file-lock-store.ts";
import { assertFileWriteAllowed, isWriteAllowed, getPathOwner } from "./write-guard.ts";
import { startStaleLockCleaner, stopStaleLockCleaner, runCleanup } from "./stale-lock-cleaner.ts";
import { computeExpiry, DEFAULT_LOCK_TTL_MS }   from "./lock-timeout.ts";
import type {
  AcquireOptions, AcquireResult,
  ReleaseOptions, ReleaseResult,
  FileLock,
} from "./file-lock-types.ts";

// ── Facade ────────────────────────────────────────────────────────────────────

export const fileLockManager = {

  // ── Acquisition ─────────────────────────────────────────────────────────────

  /**
   * Acquire exclusive write ownership of a file path.
   * Fail-closed — throws FileLockTimeoutError on collision after retries.
   */
  acquire(
    path:    string,
    ownerId: string,
    runId:   string,
    opts?:   AcquireOptions,
  ): Promise<AcquireResult> {
    return acquireLock(path, ownerId, runId, opts);
  },

  // ── Release ─────────────────────────────────────────────────────────────────

  /**
   * Release a lock by lockId.
   * Ownership is validated unless opts.force = true.
   */
  release(
    lockId:   string,
    callerId: string,
    opts?:    ReleaseOptions,
  ): ReleaseResult {
    return releaseLock(lockId, callerId, opts);
  },

  /**
   * Release ALL active locks for a given runId.
   * Use during run cleanup or crash recovery.
   */
  releaseAllForRun(runId: string): number {
    return releaseAllForRun(runId);
  },

  // ── Heartbeat ────────────────────────────────────────────────────────────────

  /**
   * Refresh a lock's expiry to prevent stale eviction during long writes.
   */
  heartbeat(lockId: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): boolean {
    return fileLockStore.heartbeat(lockId, computeExpiry(ttlMs));
  },

  // ── Write guard ──────────────────────────────────────────────────────────────

  /**
   * Assert that ownerId holds an active lock on path.
   * Throws FileWriteBlockedError if not.
   */
  assertWriteAllowed(path: string, ownerId: string): void {
    assertFileWriteAllowed({ path, ownerId });
  },

  /**
   * Non-throwing version of assertWriteAllowed.
   */
  isWriteAllowed(path: string, ownerId: string): boolean {
    return isWriteAllowed(path, ownerId);
  },

  /**
   * Returns the current owner of a path, or null if unlocked.
   */
  getOwner(path: string): { ownerId: string; runId: string } | null {
    return getPathOwner(path);
  },

  // ── Inspection ───────────────────────────────────────────────────────────────

  isLocked(path: string): boolean {
    return fileLockStore.hasActiveLock(path);
  },

  getLock(path: string): FileLock | undefined {
    return fileLockStore.getByPath(path);
  },

  listActive(): FileLock[] {
    return fileLockStore.listActive();
  },

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Start the background stale-lock cleaner. Call once at server startup.
   */
  startCleaner(): void {
    startStaleLockCleaner();
  },

  stopCleaner(): void {
    stopStaleLockCleaner();
  },

  /**
   * Run one cleanup pass immediately (useful in tests or recovery).
   */
  runCleanup() {
    return runCleanup();
  },
} as const;
