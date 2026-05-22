/**
 * Responsibility: Central registry of all active distributed locks — single source of truth.
 *                 Tracks owner, expiry, and resource key for every held lock.
 * Dependencies: none — pure in-process store (Redis-adaptable interface).
 * Failure: expired locks auto-evicted on every read; no stale lock persists silently.
 * Telemetry: stats() exposed to distributed-trace for lock pressure monitoring.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LockEntry {
  key:       string;   // resource identifier (e.g. "file:/src/app.ts")
  ownerId:   string;   // workerId or runId that holds the lock
  token:     string;   // unique release token (prevents foreign release)
  acquiredAt: number;
  expiresAt:  number;
  renewable:  boolean;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class LockRegistry {
  private readonly locks = new Map<string, LockEntry>();

  /** Try to register a lock. Returns false if key is already held by another owner. */
  tryAcquire(entry: LockEntry): boolean {
    this.evictExpired();
    if (this.locks.has(entry.key)) return false;
    this.locks.set(entry.key, entry);
    return true;
  }

  /** Release a lock — requires matching token (prevents foreign release). */
  release(key: string, token: string): boolean {
    const entry = this.locks.get(key);
    if (!entry || entry.token !== token) return false;
    this.locks.delete(key);
    return true;
  }

  /** Extend expiry for a renewable lock. */
  renew(key: string, token: string, extendMs: number): boolean {
    const entry = this.locks.get(key);
    if (!entry || entry.token !== token || !entry.renewable) return false;
    this.locks.set(key, { ...entry, expiresAt: Date.now() + extendMs });
    return true;
  }

  /** Check if a key is currently locked. */
  isLocked(key: string): boolean {
    this.evictExpired();
    return this.locks.has(key);
  }

  /** Get the current holder of a key. */
  getHolder(key: string): LockEntry | undefined {
    this.evictExpired();
    return this.locks.get(key);
  }

  /** All currently active locks. */
  all(): ReadonlyArray<LockEntry> {
    this.evictExpired();
    return [...this.locks.values()];
  }

  stats() {
    this.evictExpired();
    return {
      total:  this.locks.size,
      keys:   [...this.locks.keys()],
      owners: [...new Set([...this.locks.values()].map(e => e.ownerId))],
    };
  }

  /** Evict all expired locks (called on every read operation). */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.locks) {
      if (entry.expiresAt <= now) {
        this.locks.delete(key);
        console.warn(`[lock-registry] Expired lock evicted: ${key} (owner=${entry.ownerId})`);
      }
    }
  }
}

export const lockRegistry = new LockRegistry();
