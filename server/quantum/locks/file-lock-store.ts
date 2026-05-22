/**
 * file-lock-store.ts
 *
 * Singleton ownership store for all active file locks.
 * ALL mutations go through the atomic methods here — no external Map access.
 * Single responsibility: store, retrieve, and atomically mutate FileLock records.
 */

import type { FileLock, LockStatus } from "./file-lock-types.ts";

// ── Singleton store ───────────────────────────────────────────────────────────

class FileLockStore {
  private readonly _locks = new Map<string, FileLock>();

  // ── Reads (deterministic) ───────────────────────────────────────────────────

  getByPath(path: string): FileLock | undefined {
    return this._locks.get(this._key(path));
  }

  getByLockId(lockId: string): FileLock | undefined {
    for (const lock of this._locks.values()) {
      if (lock.lockId === lockId) return lock;
    }
    return undefined;
  }

  hasActiveLock(path: string): boolean {
    const lock = this.getByPath(path);
    return lock !== undefined && lock.status === "active";
  }

  listAll(): FileLock[] {
    return Array.from(this._locks.values());
  }

  listActive(): FileLock[] {
    return this.listAll().filter(l => l.status === "active");
  }

  size(): number { return this._locks.size; }

  // ── Atomic mutations ────────────────────────────────────────────────────────

  /**
   * Inserts a new lock. Throws if a live lock already exists for this path.
   * Callers MUST check `hasActiveLock` before calling.
   */
  insert(lock: FileLock): void {
    const existing = this.getByPath(lock.path);
    if (existing && existing.status === "active") {
      throw new Error(
        `[file-lock-store] Attempted to insert lock for already-locked path: ${lock.path}`,
      );
    }
    this._locks.set(this._key(lock.path), lock);
  }

  /**
   * Updates specific mutable fields on an existing lock.
   * Returns false if no lock exists for the given lockId.
   */
  update(lockId: string, fields: Partial<Pick<FileLock, "status" | "lastHeartbeat" | "expiresAt">>): boolean {
    const lock = this.getByLockId(lockId);
    if (!lock) return false;
    const updated: FileLock = { ...lock, ...fields };
    this._locks.set(this._key(lock.path), updated);
    return true;
  }

  /**
   * Marks a lock as released by status update. Does NOT remove the record
   * (kept for audit). Use `evict` to purge stale/released records.
   */
  markReleased(lockId: string): boolean {
    return this.update(lockId, { status: "released" });
  }

  /**
   * Marks a lock as expired.
   */
  markExpired(lockId: string): boolean {
    return this.update(lockId, { status: "expired" });
  }

  /**
   * Updates the heartbeat timestamp to extend the lock's effective life.
   */
  heartbeat(lockId: string, newExpiresAt: number): boolean {
    return this.update(lockId, { lastHeartbeat: Date.now(), expiresAt: newExpiresAt });
  }

  /**
   * Permanently removes a lock record from the store.
   * Use for stale / released / expired cleanup.
   */
  evict(path: string): boolean {
    return this._locks.delete(this._key(path));
  }

  /**
   * Removes all non-active locks (released + expired). Returns count evicted.
   */
  evictInactive(): number {
    let count = 0;
    for (const [key, lock] of this._locks.entries()) {
      if (lock.status !== "active") {
        this._locks.delete(key);
        count++;
      }
    }
    return count;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private _key(path: string): string {
    return path.trim().toLowerCase();
  }
}

// Export singleton
export const fileLockStore = new FileLockStore();
