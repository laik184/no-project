/**
 * write-guard.ts
 *
 * THE SINGLE WRITE GATE.
 * All file write operations MUST call assertFileWriteAllowed before mutating disk.
 *
 * Fail-closed: throws FileWriteBlockedError on any invalid state.
 * NO bypass. NO silent fallback. NO optional check.
 */

import { fileLockStore }     from "./file-lock-store.ts";
import { isExpired }         from "./lock-timeout.ts";
import { FileWriteBlockedError } from "./lock-errors.ts";
import type { WriteGuardContext } from "./file-lock-types.ts";

// ── Core assertion ────────────────────────────────────────────────────────────

/**
 * Assert that `ownerId` holds an active, non-expired lock on `path`.
 *
 * @throws FileWriteBlockedError — on any invalid ownership state
 *
 * USAGE:
 *   assertFileWriteAllowed({ path: "src/App.tsx", ownerId: "agent-42" });
 *   // ← throws if not allowed
 *   await atomicWrite(abs, content); // ← only reaches here if allowed
 */
export function assertFileWriteAllowed({ path, ownerId }: WriteGuardContext): void {
  const lock = fileLockStore.getByPath(path);

  // ── No lock at all ────────────────────────────────────────────────────────
  if (!lock) {
    throw new FileWriteBlockedError(
      path,
      ownerId,
      "no lock held — acquire a lock before writing",
    );
  }

  // ── Wrong status ──────────────────────────────────────────────────────────
  if (lock.status !== "active") {
    throw new FileWriteBlockedError(
      path,
      ownerId,
      `lock status is "${lock.status}" — only "active" permits writes`,
    );
  }

  // ── Expired lock ──────────────────────────────────────────────────────────
  if (isExpired(lock.expiresAt)) {
    throw new FileWriteBlockedError(
      path,
      ownerId,
      `lock expired at ${new Date(lock.expiresAt).toISOString()}`,
    );
  }

  // ── Ownership mismatch ────────────────────────────────────────────────────
  if (lock.ownerId !== ownerId) {
    throw new FileWriteBlockedError(
      path,
      ownerId,
      `lock owned by "${lock.ownerId}" — caller "${ownerId}" is not the owner`,
    );
  }
}

/**
 * Phased-integration guard: only blocks writes when a DIFFERENT active owner
 * holds the lock on the path. Passes through when the path is unlocked.
 *
 * USE THIS in existing write paths until all callers acquire locks explicitly.
 * When a caller does hold a lock, full assertFileWriteAllowed should be used.
 *
 * Collision matrix:
 *   - No lock on path     → PASS (existing unguarded callers)
 *   - Caller holds lock   → PASS
 *   - Different owner     → THROW FileLockCollisionError (the key protection)
 */
export function assertNoWriteConflict(path: string, callerId: string): void {
  const lock = fileLockStore.getByPath(path);
  if (!lock || lock.status !== "active" || isExpired(lock.expiresAt)) return;
  if (lock.ownerId === callerId) return;
  throw new FileWriteBlockedError(
    path,
    callerId,
    `path locked by owner="${lock.ownerId}" run="${lock.runId}" until ${new Date(lock.expiresAt).toISOString()}`,
  );
}

// ── Query helpers (non-throwing) ──────────────────────────────────────────────

/**
 * Returns true if ownerId currently holds an active, unexpired lock on path.
 * Useful for defensive pre-checks without catching exceptions.
 */
export function isWriteAllowed(path: string, ownerId: string): boolean {
  try {
    assertFileWriteAllowed({ path, ownerId });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the current lock owner for a path, or null if the path is unlocked.
 */
export function getPathOwner(path: string): { ownerId: string; runId: string } | null {
  const lock = fileLockStore.getByPath(path);
  if (!lock || lock.status !== "active" || isExpired(lock.expiresAt)) return null;
  return { ownerId: lock.ownerId, runId: lock.runId };
}
