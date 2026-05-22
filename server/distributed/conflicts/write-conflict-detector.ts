/**
 * Responsibility: Detects write conflicts when multiple agents target the same file path.
 *                 Tracks pending writes per runId and signals collisions before commit.
 * Dependencies: none — pure in-process detection; no file I/O.
 * Failure: unknown paths are treated as no-conflict (fail-open for reads, fail-closed for writes).
 * Telemetry: distributed.conflict emitted by conflict-resolver when collision detected.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PendingWrite {
  path:      string;
  ownerId:   string;    // workerId or agentName
  runId:     string;
  content:   string;
  registeredAt: number;
}

export interface WriteConflict {
  path:    string;
  writers: PendingWrite[];
}

// ── Detector ─────────────────────────────────────────────────────────────────

class WriteConflictDetector {
  /** path → list of pending writers */
  private readonly pending = new Map<string, PendingWrite[]>();

  /** Register intent to write a file. Call BEFORE acquiring the file lock. */
  register(write: PendingWrite): void {
    const existing = this.pending.get(write.path) ?? [];
    this.pending.set(write.path, [...existing, write]);
  }

  /** Deregister intent (call after lock acquired or write abandoned). */
  deregister(path: string, ownerId: string): void {
    const existing = this.pending.get(path) ?? [];
    const filtered = existing.filter(w => w.ownerId !== ownerId);
    if (filtered.length === 0) {
      this.pending.delete(path);
    } else {
      this.pending.set(path, filtered);
    }
  }

  /** Return any conflicts for a given path (>1 writer pending). */
  conflictsFor(path: string): WriteConflict | null {
    const writers = this.pending.get(path) ?? [];
    if (writers.length <= 1) return null;
    return { path, writers };
  }

  /** Scan all registered paths for conflicts. */
  detectAll(): WriteConflict[] {
    const conflicts: WriteConflict[] = [];
    for (const [path, writers] of this.pending) {
      if (writers.length > 1) conflicts.push({ path, writers });
    }
    return conflicts;
  }

  /** Check if a specific path has a conflicting writer (other than ownerId). */
  hasConflict(path: string, ownerId: string): boolean {
    const writers = this.pending.get(path) ?? [];
    return writers.some(w => w.ownerId !== ownerId);
  }

  /** All currently tracked write intents. */
  pending_snapshot(): ReadonlyMap<string, readonly PendingWrite[]> {
    return this.pending;
  }

  /** Evict stale write intents (older than maxAgeMs). */
  evictStale(maxAgeMs = 60_000): number {
    const now = Date.now();
    let count = 0;
    for (const [path, writers] of this.pending) {
      const fresh = writers.filter(w => now - w.registeredAt < maxAgeMs);
      if (fresh.length !== writers.length) {
        count += writers.length - fresh.length;
        if (fresh.length === 0) this.pending.delete(path);
        else this.pending.set(path, fresh);
      }
    }
    return count;
  }
}

export const writeConflictDetector = new WriteConflictDetector();
