/**
 * Responsibility: Serialized, versioned distributed memory write queue.
 *                 Single source of truth for all memory mutations — prevents races,
 *                 detects conflicts, and supports replay-safe rollback.
 * Dependencies: memory-transaction, memory-conflict-checker, memory-telemetry,
 *               distributed-lock-manager
 * Failure: conflict → rolled_back; checksum failure → rolled_back; never silently corrupts.
 * Telemetry: delegates all events to memory-telemetry.
 */

import { memoryTransactionBuilder } from "./memory-transaction.ts";
import { memoryConflictChecker }    from "./memory-conflict-checker.ts";
import { memoryTelemetry }          from "./memory-telemetry.ts";
import { distributedLockManager }   from "../locks/distributed-lock-manager.ts";
import type { MemoryTransaction }   from "./types/index.ts";

type WriteFn<T> = (current: T | undefined) => Promise<T>;

interface Lane {
  queue:   Array<() => Promise<void>>;
  running: boolean;
}

class DistributedMemoryQueue {
  private readonly lanes = new Map<string, Lane>();

  /**
   * Enqueue a versioned write for a project+key.
   * Serializes per project — concurrent projects run in parallel.
   */
  async enqueue<T>(
    projectId: number,
    runId:     string,
    key:       string,
    fn:        WriteFn<T>,
  ): Promise<MemoryTransaction> {
    return new Promise<MemoryTransaction>((resolve, reject) => {
      const laneKey = `${projectId}:${key}`;
      if (!this.lanes.has(laneKey)) this.lanes.set(laneKey, { queue: [], running: false });

      this.lanes.get(laneKey)!.queue.push(async () => {
        const lockKey  = `mem:${projectId}:${key}`;
        const ownerId  = runId;
        const prevVersion = memoryConflictChecker.currentVersion(projectId, key);
        let tx: MemoryTransaction | null = null;

        try {
          await distributedLockManager.withLock(lockKey, { ownerId, ttlMs: 5_000 }, async () => {
            const currentVersion = memoryConflictChecker.currentVersion(projectId, key);
            const payload = await fn(undefined);
            tx = memoryTransactionBuilder.build(projectId, runId, key, payload, currentVersion);

            memoryTelemetry.onWriteStarted(tx.id, runId, key);
            const err = memoryTransactionBuilder.validate(tx);
            if (err) throw new Error(`Invalid transaction: ${err}`);

            const conflict = memoryConflictChecker.check(tx);
            if (conflict) {
              memoryTelemetry.onConflict(tx.id, runId, key, conflict.localVersion, conflict.remoteVersion);
              tx = { ...tx, status: "conflict" };
              throw new Error(`Memory conflict: key=${key} local=${conflict.localVersion} remote=${conflict.remoteVersion}`);
            }

            if (!memoryTransactionBuilder.verifyChecksum(tx)) {
              throw new Error(`Checksum verification failed for tx ${tx.id}`);
            }

            memoryConflictChecker.commit(tx);
            tx = { ...tx, status: "committed" };
            memoryTelemetry.onWriteCommitted(tx.id, runId, key, tx.nextVersion);
          });

          resolve(tx!);
        } catch (err) {
          const reason = (err as Error).message;
          if (tx) {
            memoryTelemetry.onRolledBack(tx.id, runId, reason);
            tx = { ...tx, status: "rolled_back" };
            resolve(tx);
          } else {
            reject(err);
          }
        }
      });

      this.drain(laneKey);
    });
  }

  private async drain(laneKey: string): Promise<void> {
    const lane = this.lanes.get(laneKey);
    if (!lane || lane.running) return;
    lane.running = true;
    while (lane.queue.length > 0) {
      const task = lane.queue.shift()!;
      await task().catch(console.error);
    }
    lane.running = false;
  }

  stats(): { activeLanes: number; totalPending: number } {
    let totalPending = 0;
    for (const lane of this.lanes.values()) totalPending += lane.queue.length;
    return { activeLanes: this.lanes.size, totalPending };
  }
}

export const distributedMemoryQueue = new DistributedMemoryQueue();
