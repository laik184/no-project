/**
 * file-lock-types.ts
 *
 * All type contracts for the FileLockManager system.
 * No external dependencies — pure TypeScript types.
 */

// ── Core lock record ──────────────────────────────────────────────────────────

export type LockStatus = "active" | "released" | "expired";

export interface FileLock {
  lockId:        string;
  path:          string;
  ownerId:       string;
  runId:         string;
  acquiredAt:    number;
  expiresAt:     number;
  lastHeartbeat: number;
  status:        LockStatus;
  retryCount:    number;
}

// ── Acquisition ───────────────────────────────────────────────────────────────

export interface AcquireOptions {
  /** Milliseconds before the lock auto-expires (default: 30 000) */
  ttlMs?:       number;
  /** How many times to retry before failing (default: 3) */
  maxRetries?:  number;
  /** Milliseconds between retries (default: 500) */
  retryDelayMs?: number;
}

export interface AcquireResult {
  success:       boolean;
  lockId?:       string;
  failureReason?: string;
  existingOwner?: Pick<FileLock, "ownerId" | "runId" | "expiresAt">;
}

// ── Release ───────────────────────────────────────────────────────────────────

export interface ReleaseOptions {
  /** Force-release even if the caller is not the owner (emergency use only) */
  force?: boolean;
}

export interface ReleaseResult {
  success:       boolean;
  failureReason?: string;
}

// ── Write-guard ───────────────────────────────────────────────────────────────

export interface WriteGuardContext {
  path:    string;
  ownerId: string;
}

// ── Telemetry payloads ────────────────────────────────────────────────────────

export type LockEventType =
  | "lock.acquired"
  | "lock.failed"
  | "lock.released"
  | "lock.expired"
  | "lock.retry"
  | "lock.force_release"
  | "lock.collision"
  | "lock.stale_cleaned";

export interface LockEventPayload {
  lockId?:       string;
  path:          string;
  ownerId:       string;
  runId:         string;
  reason?:       string;
  retryCount?:   number;
  existingOwner?: Pick<FileLock, "ownerId" | "runId" | "expiresAt">;
  ttlMs?:        number;
}

// ── Cleaner ───────────────────────────────────────────────────────────────────

export interface CleanupResult {
  expiredCleaned: number;
  zombieCleaned:  number;
}
