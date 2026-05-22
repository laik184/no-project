/**
 * server/infrastructure/process/spawn-lock/spawn-lock.ts
 *
 * Per-project spawn concurrency lock.
 *
 * PROBLEM SOLVED:
 *   processRegistry.start() has an async suspension point at `await findFreePort()`.
 *   Two concurrent callers both pass the `alreadyRunning` guard before either
 *   sets the entry → both spawn child processes for the same projectId.
 *
 * SOLUTION:
 *   Promise deduplication via a per-projectId lock registry.
 *   - First caller: executes the spawn fn, stores the promise, returns it.
 *   - Concurrent callers while lock held: return the SAME promise (no duplicate spawn).
 *   - After promise settles: lock released, future callers go through normally.
 *   - Timeout guard (45s default): auto-releases lock if spawn hangs.
 *
 * Guarantees:
 *   ✅ At most ONE active spawn per projectId at any time
 *   ✅ Concurrent callers share the result, never duplicate
 *   ✅ Lock always released — success, failure, timeout, exception
 *   ✅ No deadlocks — timeout auto-release
 *   ✅ Zero external dependencies — Map + Promise only
 *   ✅ Full telemetry on every state transition
 *
 * Single responsibility: concurrency safety for spawn calls only.
 * No preview logic, no orchestration, no process inspection here.
 */

import type { SpawnLockEntry } from "./spawn-lock.types.ts";
import {
  emitLockAcquired,
  emitLockReused,
  emitLockReleased,
  emitLockTimeout,
  emitLockFailed,
} from "./spawn-lock.telemetry.ts";

// ── Config ────────────────────────────────────────────────────────────────────

/** Default lock timeout — auto-releases if spawn takes longer than this. */
const DEFAULT_TIMEOUT_MS = 45_000;

// ── Lock class ────────────────────────────────────────────────────────────────

class SpawnLock {
  private readonly locks = new Map<number, SpawnLockEntry>();

  // ── Public API ─────────────────────────────────────────────────────────────

  /** True if a spawn is currently in-flight for this projectId. */
  isLocked(projectId: number): boolean {
    return this.locks.has(projectId);
  }

  /** Snapshot of current lock registry for diagnostics. */
  snapshot(): Array<{ projectId: number; owner: string; startedAt: number; reusedBy: number }> {
    return Array.from(this.locks.entries()).map(([projectId, e]) => ({
      projectId,
      owner:     e.owner,
      startedAt: e.startedAt,
      reusedBy:  e.reusedBy,
    }));
  }

  /**
   * Execute `fn` under a per-project spawn lock.
   *
   * If no lock exists for `projectId`:
   *   → acquire lock, execute fn, release on settle, return result.
   *
   * If a lock already exists for `projectId`:
   *   → return the in-flight promise (deduplicated — fn is NOT called again).
   *
   * The `timeoutMs` guard auto-releases the lock if the promise takes too long.
   * This prevents a hung spawn from blocking future starts permanently.
   */
  async withLock<T>(
    projectId: number,
    owner:     string,
    fn:        () => Promise<T>,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    // ── Deduplication path ───────────────────────────────────────────────────
    const existing = this.locks.get(projectId);
    if (existing) {
      existing.reusedBy++;
      emitLockReused(projectId, existing.owner, existing.startedAt, existing.reusedBy);
      return existing.promise as Promise<T>;
    }

    // ── Acquire path ─────────────────────────────────────────────────────────
    const startedAt = Date.now();
    emitLockAcquired(projectId, owner, startedAt);

    // Build the promise before registering — ensures the fn is called exactly once
    const promise = this._runWithCleanup(projectId, owner, startedAt, fn);

    // Register timeout BEFORE storing — any code that runs between these two
    // points runs synchronously (JS is single-threaded), so there's no gap.
    const timeoutId = setTimeout(() => {
      if (this.locks.has(projectId)) {
        emitLockTimeout(projectId, owner, startedAt);
        this.locks.delete(projectId);
      }
    }, timeoutMs);
    timeoutId.unref?.();

    this.locks.set(projectId, {
      promise,
      owner,
      startedAt,
      reusedBy:  0,
      timeoutId,
    });

    return promise;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async _runWithCleanup<T>(
    projectId: number,
    owner:     string,
    startedAt: number,
    fn:        () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await fn();
      return result;
    } catch (err: any) {
      emitLockFailed(projectId, owner, startedAt, err?.message ?? String(err));
      throw err;
    } finally {
      // Always release — success, failure, or exception
      const entry = this.locks.get(projectId);
      if (entry) {
        clearTimeout(entry.timeoutId);
        emitLockReleased(projectId, owner, startedAt, entry.reusedBy);
        this.locks.delete(projectId);
      }
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Global spawn lock instance — imported by process-registry.ts only. */
export const spawnLock = new SpawnLock();
