/**
 * recovery-lock.ts
 * Per-project mutex that prevents double-recovery and infinite recovery loops.
 *
 * Safety guarantees:
 *  - Only one recovery operation per project at a time
 *  - Auto-expires after LOCK_TIMEOUT_MS (prevents deadlock on crash during recovery)
 *  - Tracks consecutive recovery attempts; blocks after MAX_CONSECUTIVE
 *  - Cooldown period enforced between recovery cycles
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCK_TIMEOUT_MS      = 60_000;  // 60 s — auto-release if recovery hangs
const COOLDOWN_MS          = 30_000;  // 30 s between recovery attempts
const MAX_CONSECUTIVE      = 3;       // block after 3 back-to-back failures

// ─── State ────────────────────────────────────────────────────────────────────

interface LockEntry {
  lockedAt:    number;
  lockToken:   string;
  timeoutId:   ReturnType<typeof setTimeout>;
}

interface AttemptRecord {
  count:      number;
  lastAt:     number;
  blockedAt?: number;
}

const locks    = new Map<number, LockEntry>();
const attempts = new Map<number, AttemptRecord>();

// ─── Lock API ─────────────────────────────────────────────────────────────────

export interface AcquireResult {
  acquired: boolean;
  token:    string | null;
  reason?:  "locked" | "cooldown" | "max_attempts";
}

/**
 * Try to acquire the recovery lock for a project.
 * Returns { acquired: true, token } on success.
 * Returns { acquired: false, reason } if blocked.
 */
export function acquireRecoveryLock(projectId: number): AcquireResult {
  const now = Date.now();

  // ── Check consecutive-attempt ceiling ────────────────────────────────────
  const rec = attempts.get(projectId);
  if (rec) {
    if (rec.blockedAt) {
      // Stay blocked for COOLDOWN_MS after being capped
      if (now - rec.blockedAt < COOLDOWN_MS) {
        return { acquired: false, token: null, reason: "max_attempts" };
      }
      // Reset after cooldown
      attempts.delete(projectId);
    } else if (rec.count >= MAX_CONSECUTIVE && now - rec.lastAt < COOLDOWN_MS) {
      const updated = { ...rec, blockedAt: now };
      attempts.set(projectId, updated);
      console.warn(`[recovery-lock] Project ${projectId} blocked — ${MAX_CONSECUTIVE} consecutive recoveries in cooldown`);
      return { acquired: false, token: null, reason: "max_attempts" };
    }
  }

  // ── Check existing lock ───────────────────────────────────────────────────
  const existing = locks.get(projectId);
  if (existing) {
    if (now - existing.lockedAt < LOCK_TIMEOUT_MS) {
      return { acquired: false, token: null, reason: "locked" };
    }
    // Stale lock — auto-release
    clearTimeout(existing.timeoutId);
    locks.delete(projectId);
    console.warn(`[recovery-lock] Stale lock released for project ${projectId}`);
  }

  // ── Acquire ───────────────────────────────────────────────────────────────
  const token   = `lock_${projectId}_${now}`;
  const timeoutId = setTimeout(() => {
    const l = locks.get(projectId);
    if (l?.lockToken === token) {
      locks.delete(projectId);
      console.warn(`[recovery-lock] Lock auto-expired for project ${projectId}`);
    }
  }, LOCK_TIMEOUT_MS);

  locks.set(projectId, { lockedAt: now, lockToken: token, timeoutId });
  return { acquired: true, token };
}

/**
 * Release the recovery lock.
 * Records the attempt outcome to enforce consecutive-failure limits.
 */
export function releaseRecoveryLock(
  projectId: number,
  token:     string,
  success:   boolean,
): void {
  const existing = locks.get(projectId);
  if (existing?.lockToken !== token) return;

  clearTimeout(existing.timeoutId);
  locks.delete(projectId);

  // Track attempts
  const now = Date.now();
  const rec = attempts.get(projectId) ?? { count: 0, lastAt: 0 };
  attempts.set(projectId, {
    count:  success ? 0 : rec.count + 1,
    lastAt: now,
  });
}

/** True if a recovery lock is currently held for a project. */
export function isLocked(projectId: number): boolean {
  const l = locks.get(projectId);
  if (!l) return false;
  return Date.now() - l.lockedAt < LOCK_TIMEOUT_MS;
}

/** Reset all state for a project (call when user manually redeploys). */
export function resetRecoveryState(projectId: number): void {
  const l = locks.get(projectId);
  if (l) clearTimeout(l.timeoutId);
  locks.delete(projectId);
  attempts.delete(projectId);
}

/** Diagnostic snapshot of lock state (for health endpoints). */
export function getLockDiagnostics(projectId: number): object {
  const lock    = locks.get(projectId);
  const attempt = attempts.get(projectId);
  return {
    locked:            !!lock,
    lockedAt:          lock?.lockedAt ?? null,
    attemptCount:      attempt?.count ?? 0,
    lastAttemptAt:     attempt?.lastAt ?? null,
    isBlocked:         !!attempt?.blockedAt,
  };
}
