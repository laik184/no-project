/**
 * write-lock-manager.ts
 *
 * Per-file write lock registry. Prevents concurrent path writes to the same
 * file path. Lock is owned by a (pathId, quantumRunId) pair.
 * No OS-level locking — in-process coordination only.
 */

// ── Lock entry ────────────────────────────────────────────────────────────────

interface LockEntry {
  filePath:     string;
  quantumRunId: string;
  pathId:       string;
  acquiredAt:   number;
}

// ── Lock store ────────────────────────────────────────────────────────────────

const _locks = new Map<string, LockEntry>();   // key = `${quantumRunId}:${filePath}`

function key(quantumRunId: string, filePath: string): string {
  return `${quantumRunId}:${filePath}`;
}

// ── Acquire / release ─────────────────────────────────────────────────────────

/**
 * Attempt to acquire a write lock.
 * Returns true if acquired (or already owned by this pathId).
 * Returns false if another path holds the lock.
 */
export function tryAcquire(
  quantumRunId: string,
  filePath:     string,
  pathId:       string,
): boolean {
  const k       = key(quantumRunId, filePath);
  const existing = _locks.get(k);

  if (!existing) {
    _locks.set(k, { filePath, quantumRunId, pathId, acquiredAt: Date.now() });
    return true;
  }

  // Re-entrant: same path already holds it
  return existing.pathId === pathId;
}

export function release(
  quantumRunId: string,
  filePath:     string,
  pathId:       string,
): void {
  const k       = key(quantumRunId, filePath);
  const existing = _locks.get(k);
  if (existing?.pathId === pathId) {
    _locks.delete(k);
  }
}

export function forceRelease(quantumRunId: string, filePath: string): void {
  _locks.delete(key(quantumRunId, filePath));
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getLockHolder(
  quantumRunId: string,
  filePath:     string,
): string | undefined {
  return _locks.get(key(quantumRunId, filePath))?.pathId;
}

export function isLocked(quantumRunId: string, filePath: string): boolean {
  return _locks.has(key(quantumRunId, filePath));
}

export function getLocksForRun(quantumRunId: string): LockEntry[] {
  const prefix = `${quantumRunId}:`;
  return Array.from(_locks.entries())
    .filter(([k]) => k.startsWith(prefix))
    .map(([, v]) => v);
}

export function getLocksForPath(quantumRunId: string, pathId: string): string[] {
  return getLocksForRun(quantumRunId)
    .filter(l => l.pathId === pathId)
    .map(l => l.filePath);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function releaseAllForPath(quantumRunId: string, pathId: string): void {
  for (const lock of getLocksForPath(quantumRunId, pathId)) {
    release(quantumRunId, lock, pathId);
  }
}

export function releaseAllForRun(quantumRunId: string): void {
  for (const lock of getLocksForRun(quantumRunId)) {
    _locks.delete(key(quantumRunId, lock.filePath));
  }
}

export function totalLocks(): number {
  return _locks.size;
}
