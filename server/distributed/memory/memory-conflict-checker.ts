/**
 * Responsibility: Detects version conflicts in distributed memory writes.
 *                 Compares incoming transaction version against persisted version.
 * Dependencies: none
 * Failure: returns conflict on any version mismatch; never throws.
 * Telemetry: none — pure comparison logic; callers emit telemetry.
 */

import type { MemoryTransaction, MemoryConflict } from "./types/index.ts";

// In-process version store (Redis-backed extension point)
const versionStore = new Map<string, number>();

class MemoryConflictChecker {
  /** Returns conflict if prevVersion doesn't match committed version. */
  check(tx: MemoryTransaction): MemoryConflict | null {
    const versionKey    = `${tx.projectId}:${tx.key}`;
    const currentVersion = versionStore.get(versionKey) ?? 0;

    if (tx.prevVersion !== currentVersion) {
      return {
        key:           tx.key,
        projectId:     tx.projectId,
        localVersion:  tx.prevVersion,
        remoteVersion: currentVersion,
        ownerId:       tx.runId,
        detectedAt:    Date.now(),
      };
    }
    return null;
  }

  /** Commit version — called after successful write. */
  commit(tx: MemoryTransaction): void {
    const versionKey = `${tx.projectId}:${tx.key}`;
    versionStore.set(versionKey, tx.nextVersion);
  }

  /** Current version for a given project+key. */
  currentVersion(projectId: number, key: string): number {
    return versionStore.get(`${projectId}:${key}`) ?? 0;
  }

  /** Reset version tracking (used in tests / replay). */
  reset(projectId?: number): void {
    if (projectId !== undefined) {
      const prefix = `${projectId}:`;
      for (const k of versionStore.keys()) {
        if (k.startsWith(prefix)) versionStore.delete(k);
      }
    } else {
      versionStore.clear();
    }
  }

  stats(): { totalTracked: number } {
    return { totalTracked: versionStore.size };
  }
}

export const memoryConflictChecker = new MemoryConflictChecker();
