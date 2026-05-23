/**
 * write-ownership-coordinator.ts
 *
 * Tracks and validates write ownership for the parallel write coordinator.
 * Ensures only the active quantum run can hold a write slot for a given path.
 *
 * Single responsibility: ownership tracking for file-level write coordination.
 * Does NOT perform writes or compute retry delays.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WriteOwnershipRecord {
  filePath:      string;
  quantumRunId:  string;
  pathId:        string;
  acquiredAt:    number;
  expiresAt:     number;
}

export interface OwnershipCheckResult {
  allowed: boolean;
  reason:  string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 60_000;

// ── Coordinator ───────────────────────────────────────────────────────────────

class WriteOwnershipCoordinator {
  /** filePath → current ownership record */
  private readonly _owners = new Map<string, WriteOwnershipRecord>();

  /**
   * Attempt to acquire write ownership for a file path.
   * Only one quantumRunId may own a filePath at a time.
   */
  acquire(
    filePath:     string,
    quantumRunId: string,
    pathId:       string,
    ttlMs:        number = DEFAULT_TTL_MS,
  ): OwnershipCheckResult {
    const now      = Date.now();
    const existing = this._owners.get(filePath);

    if (existing) {
      // Expired ownership — evict and allow
      if (now > existing.expiresAt) {
        this._owners.delete(filePath);
      } else if (existing.quantumRunId !== quantumRunId) {
        return {
          allowed: false,
          reason:  `File "${filePath}" owned by run "${existing.quantumRunId}" until ${new Date(existing.expiresAt).toISOString()}`,
        };
      }
      // Same run already owns it — allow re-entry
    }

    this._owners.set(filePath, {
      filePath,
      quantumRunId,
      pathId,
      acquiredAt: now,
      expiresAt:  now + ttlMs,
    });

    return { allowed: true, reason: "ownership acquired" };
  }

  /**
   * Release ownership for a specific file path + quantumRunId pair.
   */
  release(filePath: string, quantumRunId: string): void {
    const existing = this._owners.get(filePath);
    if (existing?.quantumRunId === quantumRunId) {
      this._owners.delete(filePath);
    }
  }

  /**
   * Release all ownership records held by a quantum run.
   * Called when a run completes or is cancelled.
   */
  releaseRun(quantumRunId: string): number {
    let count = 0;
    for (const [filePath, record] of this._owners) {
      if (record.quantumRunId === quantumRunId) {
        this._owners.delete(filePath);
        count++;
      }
    }
    return count;
  }

  /** Evict expired ownership records. */
  sweepExpired(): number {
    const now = Date.now();
    let swept = 0;
    for (const [filePath, record] of this._owners) {
      if (now > record.expiresAt) {
        this._owners.delete(filePath);
        swept++;
      }
    }
    return swept;
  }

  /** Snapshot of all active ownership records. */
  snapshot(): WriteOwnershipRecord[] {
    return Array.from(this._owners.values());
  }

  activeCount(): number {
    return this._owners.size;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const writeOwnershipCoordinator = new WriteOwnershipCoordinator();
