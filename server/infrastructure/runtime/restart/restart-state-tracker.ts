/**
 * server/infrastructure/runtime/restart/restart-state-tracker.ts
 *
 * Per-project restart mutex and retry counter.
 *
 * Prevents:
 *   - Duplicate concurrent restarts (mutex)
 *   - Infinite restart loops (max retries + exponential cooldown)
 *   - Race conditions between crash events and manual restarts
 *
 * Single responsibility: track restart state.
 * No I/O, no bus access — pure synchronous state machine.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const COOLDOWN_BASE = 10_000; // ms — doubles per excess retry

// ── Types ─────────────────────────────────────────────────────────────────────

interface RestartEntry {
  inProgress:    boolean;
  retryCount:    number;
  lastAttemptAt: number;
}

export interface AcquireResult {
  acquired: boolean;
  reason?:  string;
}

// ── Internal state ────────────────────────────────────────────────────────────

const _entries = new Map<number, RestartEntry>();

function getOrCreate(projectId: number): RestartEntry {
  if (!_entries.has(projectId)) {
    _entries.set(projectId, { inProgress: false, retryCount: 0, lastAttemptAt: 0 });
  }
  return _entries.get(projectId)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Attempt to acquire the restart lock for a project.
 * Fails immediately if another restart is in progress or retry ceiling is hit.
 */
export function acquireRestartLock(projectId: number): AcquireResult {
  const entry = getOrCreate(projectId);

  if (entry.inProgress) {
    return { acquired: false, reason: "restart already in progress" };
  }

  if (entry.retryCount >= MAX_RETRIES) {
    const cooldownMs  = COOLDOWN_BASE * Math.pow(2, entry.retryCount - MAX_RETRIES);
    const sinceLastMs = Date.now() - entry.lastAttemptAt;
    if (sinceLastMs < cooldownMs) {
      const remainMs = Math.ceil((cooldownMs - sinceLastMs) / 1000);
      return {
        acquired: false,
        reason: `max retries (${MAX_RETRIES}) reached — cooldown ${remainMs}s remaining`,
      };
    }
    entry.retryCount = 0; // Reset after sufficient cooldown
  }

  entry.inProgress    = true;
  entry.lastAttemptAt = Date.now();
  return { acquired: true };
}

/**
 * Release the lock after a restart attempt.
 * On success the retry counter resets; on failure it increments.
 */
export function releaseRestartLock(projectId: number, success: boolean): void {
  const entry = _entries.get(projectId);
  if (!entry) return;
  entry.inProgress = false;
  if (success) {
    entry.retryCount = 0;
  } else {
    entry.retryCount++;
  }
}

/** Read-only diagnostic snapshot. */
export function getRestartStats(projectId: number): Readonly<RestartEntry> | undefined {
  return _entries.get(projectId);
}

/** Hard-reset — used by admin/diagnostic routes. */
export function resetRestartState(projectId: number): void {
  _entries.delete(projectId);
}
