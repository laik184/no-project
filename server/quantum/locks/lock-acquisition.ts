/**
 * lock-acquisition.ts
 *
 * Implements acquireLock — the entry point for ALL write ownership requests.
 * Fail-closed: if lock cannot be obtained, throws instead of falling back.
 *
 * Responsibilities:
 *  - Collision detection against active locks
 *  - Stale/expired lock bypass
 *  - Retry with configurable delay
 *  - Deterministic lock ID generation
 */

import { randomUUID }     from "node:crypto";
import { fileLockStore }  from "./file-lock-store.ts";
import {
  computeExpiry,
  isExpired,
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  sleep,
} from "./lock-timeout.ts";
import {
  telemetryLockAcquired,
  telemetryLockFailed,
  telemetryLockCollision,
  telemetryLockRetry,
  telemetryAcquireDuration,
} from "./lock-telemetry.ts";
import { FileLockCollisionError, FileLockTimeoutError } from "./lock-errors.ts";
import type { AcquireOptions, AcquireResult, FileLock } from "./file-lock-types.ts";

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Acquire exclusive write ownership for a file path.
 *
 * @throws FileLockCollisionError   – path is actively locked by another owner
 * @throws FileLockTimeoutError     – all retries exhausted
 */
export async function acquireLock(
  path:    string,
  ownerId: string,
  runId:   string,
  opts:    AcquireOptions = {},
): Promise<AcquireResult> {
  const {
    ttlMs        = DEFAULT_LOCK_TTL_MS,
    maxRetries   = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = opts;

  const t0 = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const existing = fileLockStore.getByPath(path);

    // ── Case 1: No lock — acquire immediately ────────────────────────────────
    if (!existing || existing.status !== "active") {
      return _insert(path, ownerId, runId, ttlMs, attempt, t0);
    }

    // ── Case 2: Stale / expired lock — evict and acquire ────────────────────
    if (isExpired(existing.expiresAt)) {
      fileLockStore.markExpired(existing.lockId);
      fileLockStore.evict(path);
      telemetryLockExpired({
        lockId:  existing.lockId,
        path,
        ownerId: existing.ownerId,
        runId:   existing.runId,
        reason:  "evicted-on-acquire",
      });
      return _insert(path, ownerId, runId, ttlMs, attempt, t0);
    }

    // ── Case 3: Same owner re-acquiring (refresh) ────────────────────────────
    if (existing.ownerId === ownerId && existing.runId === runId) {
      const newExpiry = computeExpiry(ttlMs);
      fileLockStore.heartbeat(existing.lockId, newExpiry);
      telemetryAcquireDuration(ownerId, Date.now() - t0);
      return { success: true, lockId: existing.lockId };
    }

    // ── Case 4: Collision — another active owner holds the lock ─────────────
    telemetryLockCollision({
      path,
      ownerId,
      runId,
      reason:        "collision",
      retryCount:    attempt,
      existingOwner: {
        ownerId:   existing.ownerId,
        runId:     existing.runId,
        expiresAt: existing.expiresAt,
      },
    });

    if (attempt >= maxRetries) {
      telemetryLockFailed({ path, ownerId, runId, reason: "max-retries-exceeded", retryCount: attempt });
      throw new FileLockTimeoutError(path, attempt);
    }

    telemetryLockRetry({ path, ownerId, runId, retryCount: attempt + 1 });
    await sleep(retryDelayMs);
  }

  // Should never reach here
  throw new FileLockTimeoutError(path, maxRetries);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _insert(
  path:    string,
  ownerId: string,
  runId:   string,
  ttlMs:   number,
  attempt: number,
  t0:      number,
): AcquireResult {
  const now    = Date.now();
  const lockId = randomUUID();
  const lock: FileLock = {
    lockId,
    path,
    ownerId,
    runId,
    acquiredAt:    now,
    expiresAt:     computeExpiry(ttlMs),
    lastHeartbeat: now,
    status:        "active",
    retryCount:    attempt,
  };

  fileLockStore.insert(lock);
  telemetryLockAcquired({ lockId, path, ownerId, runId, retryCount: attempt, ttlMs });
  telemetryAcquireDuration(ownerId, Date.now() - t0);
  return { success: true, lockId };
}
