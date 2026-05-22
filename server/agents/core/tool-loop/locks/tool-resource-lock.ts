/**
 * server/agents/core/tool-loop/locks/tool-resource-lock.ts
 *
 * In-process resource locking for the parallel tool executor.
 * Prevents concurrent mutations to the same file, runtime, or package set.
 *
 * Lock types
 * ──────────
 *   FILE_LOCK     — exclusive write lock on a sandbox file path
 *   PROCESS_LOCK  — exclusive lock on a child process
 *   RUNTIME_LOCK  — exclusive lock on a project's runtime (start/stop/restart)
 *   PACKAGE_LOCK  — exclusive lock on the project's package manifest
 */

import type { LockType } from "../types/parallel-execution.types.ts";

export interface LockEntry {
  lockType:   LockType;
  resourceKey: string;
  owner:      string;   // callId that acquired the lock
  acquiredAt: number;
}

class ToolResourceLock {
  private readonly locks = new Map<string, LockEntry>();

  /** Attempt to acquire a lock. Returns true if successful, false if already held. */
  acquire(resourceKey: string, lockType: LockType, owner: string): boolean {
    if (this.locks.has(resourceKey)) return false;
    this.locks.set(resourceKey, { lockType, resourceKey, owner, acquiredAt: Date.now() });
    return true;
  }

  /** Release a lock. Returns true if the lock was owned by `owner` and released. */
  release(resourceKey: string, owner: string): boolean {
    const entry = this.locks.get(resourceKey);
    if (!entry || entry.owner !== owner) return false;
    this.locks.delete(resourceKey);
    return true;
  }

  isLocked(resourceKey: string): boolean {
    return this.locks.has(resourceKey);
  }

  getLock(resourceKey: string): LockEntry | undefined {
    return this.locks.get(resourceKey);
  }

  /** Release all locks held by `owner`. Returns count of released locks. */
  releaseAll(owner: string): number {
    let released = 0;
    for (const [key, entry] of this.locks) {
      if (entry.owner === owner) {
        this.locks.delete(key);
        released++;
      }
    }
    return released;
  }

  snapshot(): LockEntry[] {
    return [...this.locks.values()];
  }

  get size(): number {
    return this.locks.size;
  }
}

/** Singleton shared across all parallel executors within a process. */
export const toolResourceLock = new ToolResourceLock();
