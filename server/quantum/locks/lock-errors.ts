/**
 * lock-errors.ts
 *
 * Typed error hierarchy for the FileLockManager system.
 * NO generic Error usage anywhere in this system.
 */

// ── Base ──────────────────────────────────────────────────────────────────────

export class FileLockError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name  = "FileLockError";
    this.path  = path;
  }
}

// ── Typed subclasses ──────────────────────────────────────────────────────────

/**
 * Thrown when a second agent attempts to write a file already locked by another.
 */
export class FileLockCollisionError extends FileLockError {
  readonly existingOwnerId: string;
  readonly existingRunId:   string;
  readonly expiresAt:       number;

  constructor(
    path:             string,
    existingOwnerId:  string,
    existingRunId:    string,
    expiresAt:        number,
  ) {
    super(
      `File locked by owner=${existingOwnerId} run=${existingRunId} until ${new Date(expiresAt).toISOString()}: ${path}`,
      path,
    );
    this.name             = "FileLockCollisionError";
    this.existingOwnerId  = existingOwnerId;
    this.existingRunId    = existingRunId;
    this.expiresAt        = expiresAt;
  }
}

/**
 * Thrown when all retry attempts to acquire a lock are exhausted.
 */
export class FileLockTimeoutError extends FileLockError {
  readonly retryCount: number;

  constructor(path: string, retryCount: number) {
    super(`Lock acquisition timed out after ${retryCount} retries: ${path}`, path);
    this.name       = "FileLockTimeoutError";
    this.retryCount = retryCount;
  }
}

/**
 * Thrown when a non-owner attempts to release a lock without force.
 */
export class FileLockOwnershipError extends FileLockError {
  readonly lockId:        string;
  readonly actualOwnerId: string;
  readonly callerId:      string;

  constructor(lockId: string, path: string, actualOwnerId: string, callerId: string) {
    super(
      `Ownership mismatch for lock=${lockId}: owner=${actualOwnerId}, caller=${callerId}: ${path}`,
      path,
    );
    this.name           = "FileLockOwnershipError";
    this.lockId         = lockId;
    this.actualOwnerId  = actualOwnerId;
    this.callerId       = callerId;
  }
}

/**
 * Thrown when a write is attempted against an expired or missing lock.
 */
export class FileLockExpiredError extends FileLockError {
  readonly lockId:    string;
  readonly expiredAt: number;

  constructor(lockId: string, path: string, expiredAt: number) {
    super(
      `Lock expired at ${new Date(expiredAt).toISOString()} for lock=${lockId}: ${path}`,
      path,
    );
    this.name      = "FileLockExpiredError";
    this.lockId    = lockId;
    this.expiredAt = expiredAt;
  }
}

/**
 * Thrown by assertFileWriteAllowed when write is blocked.
 */
export class FileWriteBlockedError extends FileLockError {
  readonly ownerId: string;

  constructor(path: string, ownerId: string, reason: string) {
    super(`Write blocked for owner=${ownerId}: ${reason}: ${path}`, path);
    this.name    = "FileWriteBlockedError";
    this.ownerId = ownerId;
  }
}
