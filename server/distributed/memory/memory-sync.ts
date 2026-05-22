/**
 * Responsibility: Memory synchronization coordinator — combines write queue, locking,
 *                 and versioning into a single safe memory-write API for agents.
 * Dependencies: memory-write-queue, memory-lock, memory-versioning
 * Failure: version conflict → VersionConflictError propagated; caller retries with fresh read.
 * Telemetry: emits agent.event on write completion; distributed.conflict on version mismatch.
 */

import { memoryWriteQueue }  from "./memory-write-queue.ts";
import { memoryLock }        from "./memory-lock.ts";
import { memoryVersioning, VersionConflictError } from "./memory-versioning.ts";
import { bus }               from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncWriteOptions<T> {
  projectId:       number;
  key:             string;
  ownerId:         string;
  expectedVersion: number;
  fn:              () => Promise<T>;  // the actual write operation
}

export interface SyncWriteResult<T> {
  success:  boolean;
  value?:   T;
  version:  number;
  error?:   string;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

class MemorySync {
  /**
   * Safe synchronized write:
   *   1. Enqueue to per-project write queue (FIFO serialization)
   *   2. Acquire memory lock (exclusive access)
   *   3. Check version (optimistic concurrency)
   *   4. Execute write fn
   *   5. Update version
   */
  async write<T>(opts: SyncWriteOptions<T>): Promise<SyncWriteResult<T>> {
    return memoryWriteQueue.enqueue({
      projectId: opts.projectId,
      key:       opts.key,
      fn:        () => this.lockedWrite(opts),
    });
  }

  private async lockedWrite<T>(opts: SyncWriteOptions<T>): Promise<SyncWriteResult<T>> {
    return memoryLock.withMemoryLock(opts.projectId, opts.key, opts.ownerId, async () => {
      try {
        const value   = await opts.fn();
        const entry   = memoryVersioning.write(opts.key, value, opts.expectedVersion, opts.ownerId);

        bus.emit("agent.event", {
          runId:     opts.ownerId,
          projectId: opts.projectId,
          phase:     "distributed.memory",
          agentName: "memory-sync",
          eventType: "agent.completed",
          payload:   { key: opts.key, version: entry.version, ownerId: opts.ownerId },
          ts:        Date.now(),
        });

        return { success: true, value, version: entry.version };
      } catch (err) {
        if (err instanceof VersionConflictError) {
          bus.emit("agent.event", {
            runId:     opts.ownerId,
            projectId: opts.projectId,
            phase:     "distributed.memory",
            agentName: "memory-sync",
            eventType: "distributed.conflict",
            payload:   { key: opts.key, expected: err.expected, actual: err.actual },
            ts:        Date.now(),
          });
          return { success: false, version: err.actual, error: err.message };
        }
        throw err;
      }
    });
  }

  /** Read the current versioned value for a key. */
  read<T>(key: string): { value: T | null; version: number } {
    const entry = memoryVersioning.read<T>(key);
    return { value: entry?.value ?? null, version: entry?.version ?? 0 };
  }

  stats() {
    return {
      queue:      memoryWriteQueue.stats(),
      versioning: memoryVersioning.stats(),
    };
  }
}

export const memorySync = new MemorySync();
