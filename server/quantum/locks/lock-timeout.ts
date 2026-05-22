/**
 * lock-timeout.ts
 *
 * Timeout constants and heartbeat helpers for the FileLockManager system.
 * Pure utility — no external dependencies.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default lock TTL in ms. Locks auto-expire after 30s without heartbeat. */
export const DEFAULT_LOCK_TTL_MS = 30_000;

/** How often the stale cleaner runs (every 10s). */
export const STALE_CLEAN_INTERVAL_MS = 10_000;

/** Default retry count before giving up on lock acquisition. */
export const DEFAULT_MAX_RETRIES = 3;

/** Default delay between acquisition retries. */
export const DEFAULT_RETRY_DELAY_MS = 500;

/** Minimum allowed TTL (prevents accidental 0ms locks). */
export const MIN_LOCK_TTL_MS = 1_000;

/** Maximum allowed TTL (prevents infinite locks). */
export const MAX_LOCK_TTL_MS = 300_000; // 5 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the expiry timestamp for a new lock.
 */
export function computeExpiry(ttlMs: number): number {
  const clamped = Math.min(Math.max(ttlMs, MIN_LOCK_TTL_MS), MAX_LOCK_TTL_MS);
  return Date.now() + clamped;
}

/**
 * Returns true if the given lock expiry timestamp has passed.
 */
export function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/**
 * Returns true if the lock's last heartbeat is older than its TTL.
 * Used by the stale cleaner to detect zombie locks.
 */
export function isZombie(lastHeartbeat: number, ttlMs: number): boolean {
  return Date.now() - lastHeartbeat > ttlMs;
}

/**
 * Clamps a TTL to the allowed range.
 */
export function clampTtl(ttlMs: number): number {
  return Math.min(Math.max(ttlMs, MIN_LOCK_TTL_MS), MAX_LOCK_TTL_MS);
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
