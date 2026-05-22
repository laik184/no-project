/**
 * server/quantum/locks/index.ts
 *
 * Public barrel for the FileLockManager system.
 * All external consumers import from here — never from subsystem files directly.
 */

// ── Primary facade ────────────────────────────────────────────────────────────
export { fileLockManager }          from "./file-lock-manager.ts";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  FileLock,
  LockStatus,
  AcquireOptions,
  AcquireResult,
  ReleaseOptions,
  ReleaseResult,
  WriteGuardContext,
  LockEventType,
  LockEventPayload,
  CleanupResult,
} from "./file-lock-types.ts";

// ── Typed errors (consumers need these for catch clauses) ─────────────────────
export {
  FileLockError,
  FileLockCollisionError,
  FileLockTimeoutError,
  FileLockOwnershipError,
  FileLockExpiredError,
  FileWriteBlockedError,
} from "./lock-errors.ts";

// ── Write guard (direct import for performance-critical paths) ────────────────
export { assertFileWriteAllowed, assertNoWriteConflict, isWriteAllowed, getPathOwner } from "./write-guard.ts";

// ── Timeout constants (useful for callers setting custom TTLs) ────────────────
export {
  DEFAULT_LOCK_TTL_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
} from "./lock-timeout.ts";
