/**
 * Responsibility: Optimistic concurrency versioning for memory entries.
 *                 Each memory write carries a version number; stale writes are rejected.
 *                 Prevents last-write-wins corruption when multiple agents update memory.
 * Dependencies: none — pure in-process version store.
 * Failure: version mismatch → VersionConflictError thrown; caller must re-read and retry.
 * Telemetry: distributed.conflict emitted by caller on VersionConflictError.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export class VersionConflictError extends Error {
  constructor(
    public readonly key:      string,
    public readonly expected: number,
    public readonly actual:   number,
  ) {
    super(`[memory-versioning] Version conflict on "${key}": expected ${expected}, got ${actual}`);
    this.name = "VersionConflictError";
  }
}

export interface VersionedEntry<T> {
  key:       string;
  version:   number;
  value:     T;
  updatedAt: number;
  updatedBy: string;   // ownerId / agentName
}

// ── Store ────────────────────────────────────────────────────────────────────

class MemoryVersioning {
  private readonly store = new Map<string, VersionedEntry<unknown>>();

  /**
   * Write a versioned memory entry.
   * Pass expectedVersion = 0 for new entries (first write).
   * Throws VersionConflictError if the current version doesn't match.
   */
  write<T>(
    key:             string,
    value:           T,
    expectedVersion: number,
    ownerId:         string,
  ): VersionedEntry<T> {
    const current = this.store.get(key);
    const currentVersion = current?.version ?? 0;

    if (currentVersion !== expectedVersion) {
      throw new VersionConflictError(key, expectedVersion, currentVersion);
    }

    const entry: VersionedEntry<T> = {
      key,
      version:   currentVersion + 1,
      value,
      updatedAt: Date.now(),
      updatedBy: ownerId,
    };

    this.store.set(key, entry as VersionedEntry<unknown>);
    return entry;
  }

  /** Read a versioned entry. Returns null if not found. */
  read<T>(key: string): VersionedEntry<T> | null {
    return (this.store.get(key) as VersionedEntry<T>) ?? null;
  }

  /** Current version of a key (0 if not found). */
  version(key: string): number {
    return this.store.get(key)?.version ?? 0;
  }

  /** Delete an entry (requires knowing the current version for safety). */
  delete(key: string, expectedVersion: number): boolean {
    const current = this.store.get(key);
    if (!current || current.version !== expectedVersion) return false;
    this.store.delete(key);
    return true;
  }

  stats() {
    return {
      entries:  this.store.size,
      keys:     [...this.store.keys()],
      versions: Object.fromEntries([...this.store.entries()].map(([k, v]) => [k, v.version])),
    };
  }
}

export const memoryVersioning = new MemoryVersioning();
