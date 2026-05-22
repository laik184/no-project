/**
 * scan-lock-manager.ts
 *
 * Per-project scan lock preventing duplicate or overlapping scans.
 *
 * Rules:
 *   ✅ one active scan per projectId at a time
 *   ✅ auto-release on timeout (prevents zombie locks)
 *   ✅ safe ownership validation on release
 *   ✅ deterministic lock ownership via scanId
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScanLock {
  projectId:   number;
  scanId:      string;
  acquiredAt:  number;
  expiresAt:   number;
}

export interface AcquireResult {
  success:       boolean;
  failureReason?: string;
  existingScanId?: string;
}

// ── Manager ───────────────────────────────────────────────────────────────────

const DEFAULT_LOCK_TTL_MS = 300_000;   // 5 minutes max scan time

class ScanLockManager {
  private readonly locks = new Map<number, ScanLock>();

  /**
   * Attempt to acquire the scan lock for a project.
   * Returns success=false if another scan is already running.
   */
  acquire(
    projectId: number,
    scanId:    string,
    ttlMs    = DEFAULT_LOCK_TTL_MS,
  ): AcquireResult {
    this.evictExpired();

    const existing = this.locks.get(projectId);
    if (existing) {
      return {
        success:        false,
        failureReason:  `Project ${projectId} has an active scan: ${existing.scanId}`,
        existingScanId: existing.scanId,
      };
    }

    this.locks.set(projectId, {
      projectId,
      scanId,
      acquiredAt: Date.now(),
      expiresAt:  Date.now() + ttlMs,
    });

    return { success: true };
  }

  /**
   * Release the scan lock.
   * Validates ownership — only the scan that acquired it can release it.
   */
  release(projectId: number, scanId: string): boolean {
    const lock = this.locks.get(projectId);
    if (!lock) return false;
    if (lock.scanId !== scanId) return false;

    this.locks.delete(projectId);
    return true;
  }

  /** Force-release regardless of ownership (emergency / recovery use). */
  forceRelease(projectId: number): void {
    this.locks.delete(projectId);
  }

  isLocked(projectId: number): boolean {
    this.evictExpired();
    return this.locks.has(projectId);
  }

  getLock(projectId: number): ScanLock | undefined {
    this.evictExpired();
    return this.locks.get(projectId);
  }

  listActive(): ScanLock[] {
    this.evictExpired();
    return Array.from(this.locks.values());
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [pid, lock] of this.locks) {
      if (lock.expiresAt < now) this.locks.delete(pid);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const scanLockManager = new ScanLockManager();
