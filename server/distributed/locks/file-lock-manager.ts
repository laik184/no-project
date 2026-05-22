/**
 * Responsibility: File-path-scoped distributed lock manager.
 *                 Prevents concurrent writes to the same file by different agents.
 *                 Integrates with distributed-lock for RAII-style file locking.
 * Dependencies: distributed-lock, lock-timeout
 * Failure: if lock not acquired within timeout, throws with clear message — fail-closed.
 * Telemetry: lock.acquired / lock.released / distributed.retry emitted via distributed-lock.
 */

import { distributedLock, LockOptions } from "./distributed-lock.ts";
import { lockTimeoutEnforcer }          from "./lock-timeout.ts";
import type { Lease }                   from "./lease-manager.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const FILE_LOCK_PREFIX   = "file:";
const DEFAULT_LEASE_MS   = 30_000;
const DEFAULT_WAIT_MS    = 15_000;
const DEFAULT_RENEW_MS   = 10_000;

// ── Manager ───────────────────────────────────────────────────────────────────

class FileLockManager {
  private started = false;

  init(): void {
    if (this.started) return;
    lockTimeoutEnforcer.start();
    this.started = true;
    console.log("[file-lock-manager] Initialized — lock timeout enforcer active.");
  }

  /**
   * Execute `fn` with exclusive write access to the given file path.
   * Throws if lock cannot be acquired within waitMs.
   */
  async withFileLock<T>(
    filePath: string,
    ownerId:  string,
    fn:       (lease: Lease) => Promise<T>,
    opts:     Partial<LockOptions> = {},
  ): Promise<T> {
    const key: string = `${FILE_LOCK_PREFIX}${filePath}`;

    const lockOpts: LockOptions = {
      ownerId,
      leaseMs:    opts.leaseMs    ?? DEFAULT_LEASE_MS,
      waitMs:     opts.waitMs     ?? DEFAULT_WAIT_MS,
      retryMs:    opts.retryMs    ?? 150,
      renewable:  opts.renewable  ?? true,
      autoRenewMs: opts.autoRenewMs ?? DEFAULT_RENEW_MS,
    };

    return distributedLock.withLock(key, lockOpts, fn);
  }

  /**
   * Try to acquire a file lock without a callback (for manual management).
   * Caller MUST call release() when done.
   */
  async acquire(
    filePath: string,
    ownerId:  string,
    opts:     Partial<LockOptions> = {},
  ): Promise<Lease | null> {
    const key     = `${FILE_LOCK_PREFIX}${filePath}`;
    const result  = await distributedLock.acquire(key, {
      ownerId,
      leaseMs:   opts.leaseMs  ?? DEFAULT_LEASE_MS,
      waitMs:    opts.waitMs   ?? DEFAULT_WAIT_MS,
      retryMs:   opts.retryMs  ?? 150,
      renewable: opts.renewable ?? true,
    });
    return result.lease;
  }

  /** Release a previously acquired file lock. */
  release(filePath: string, token: string, ownerId: string): boolean {
    const key = `${FILE_LOCK_PREFIX}${filePath}`;
    return distributedLock.release(key, token, ownerId);
  }

  /** Check if a file is currently locked. */
  isLocked(filePath: string): boolean {
    const { lockRegistry } = require("./lock-registry.ts");
    return lockRegistry.isLocked(`${FILE_LOCK_PREFIX}${filePath}`);
  }

  stop(): void {
    lockTimeoutEnforcer.stop();
  }
}

export const fileLockManager = new FileLockManager();
