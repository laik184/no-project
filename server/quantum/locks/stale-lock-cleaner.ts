/**
 * stale-lock-cleaner.ts
 *
 * Background service that periodically scans for and removes:
 *  - expired locks (past expiresAt)
 *  - zombie locks (no heartbeat within TTL)
 *
 * Runs on a fixed interval; self-contained, no external side-effects.
 * Single responsibility: detect and evict stale locks.
 */

import { fileLockStore }       from "./file-lock-store.ts";
import { isExpired, isZombie, STALE_CLEAN_INTERVAL_MS, DEFAULT_LOCK_TTL_MS } from "./lock-timeout.ts";
import { telemetryLockExpired, telemetryLockStaleCleaned } from "./lock-telemetry.ts";
import type { CleanupResult } from "./file-lock-types.ts";

// ── State ─────────────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the background stale-lock cleaner.
 * Idempotent — calling multiple times is safe.
 */
export function startStaleLockCleaner(): void {
  if (_timer) return;
  _timer = setInterval(() => {
    try { runCleanup(); } catch { /* never crash the cleaner loop */ }
  }, STALE_CLEAN_INTERVAL_MS);
  // unref so the process can exit cleanly in tests
  if (typeof _timer === "object" && "unref" in _timer) {
    (_timer as NodeJS.Timeout).unref();
  }
  console.info("[stale-lock-cleaner] Started — interval=%dms", STALE_CLEAN_INTERVAL_MS);
}

/**
 * Stop the background cleaner.
 */
export function stopStaleLockCleaner(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.info("[stale-lock-cleaner] Stopped");
  }
}

/**
 * Run one cleanup pass synchronously.
 * Safe to call manually (e.g., in tests or recovery routines).
 */
export function runCleanup(): CleanupResult {
  const result: CleanupResult = { expiredCleaned: 0, zombieCleaned: 0 };
  const active = fileLockStore.listActive();

  for (const lock of active) {
    // ── Expired: past expiresAt ──────────────────────────────────────────────
    if (isExpired(lock.expiresAt)) {
      fileLockStore.markExpired(lock.lockId);
      fileLockStore.evict(lock.path);
      telemetryLockExpired({
        lockId:  lock.lockId,
        path:    lock.path,
        ownerId: lock.ownerId,
        runId:   lock.runId,
        reason:  "expired",
      });
      result.expiredCleaned++;
      continue;
    }

    // ── Zombie: heartbeat is stale even though expiresAt hasn't passed ───────
    if (isZombie(lock.lastHeartbeat, DEFAULT_LOCK_TTL_MS)) {
      fileLockStore.markExpired(lock.lockId);
      fileLockStore.evict(lock.path);
      telemetryLockStaleCleaned({
        lockId:  lock.lockId,
        path:    lock.path,
        ownerId: lock.ownerId,
        runId:   lock.runId,
        reason:  "zombie-heartbeat-stale",
      });
      result.zombieCleaned++;
    }
  }

  if (result.expiredCleaned + result.zombieCleaned > 0) {
    console.info(
      "[stale-lock-cleaner] Cleaned expired=%d zombie=%d",
      result.expiredCleaned,
      result.zombieCleaned,
    );
  }

  return result;
}
