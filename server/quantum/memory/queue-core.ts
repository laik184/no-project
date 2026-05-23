/**
 * queue-core.ts
 *
 * Lane management and FIFO drain engine for the memory write queue.
 *
 * Single responsibility:
 *   - Maintain per-project lane map (QueueKey → ProjectWriteQueue)
 *   - Drive FIFO drain without growing the call stack (setImmediate)
 *   - Expose lane stats
 *
 * Does NOT contain retry logic (queue-dispatcher.ts) or
 * backpressure logic (queue-backpressure.ts).
 */

import type { QueueKey, QueueEntry, ProjectWriteQueue, QueueStats } from "./memory-types.ts";
import { queueBackpressureGuard } from "./queue-backpressure.ts";
import { executeQueueEntry }      from "./queue-dispatcher.ts";

// ── Lane core ─────────────────────────────────────────────────────────────────

export class QueueLaneManager {
  private readonly _lanes = new Map<QueueKey, ProjectWriteQueue>();

  // ── Lane access ──────────────────────────────────────────────────────────

  getOrCreate(queueKey: QueueKey): ProjectWriteQueue {
    let lane = this._lanes.get(queueKey);
    if (!lane) {
      lane = {
        active:         false,
        pending:        [],
        processedTotal: 0,
        failedTotal:    0,
        lastActivityTs: Date.now(),
      };
      this._lanes.set(queueKey, lane);
    }
    return lane;
  }

  get(queueKey: QueueKey): ProjectWriteQueue | undefined {
    return this._lanes.get(queueKey);
  }

  // ── Enqueue ──────────────────────────────────────────────────────────────

  push(queueKey: QueueKey, entry: QueueEntry): void {
    const lane  = this.getOrCreate(queueKey);
    const depth = lane.pending.length + 1;

    // Backpressure gate
    const bp = queueBackpressureGuard.evaluate(queueKey, depth);
    if (bp.verdict === "block") {
      entry.reject(new Error(`[QueueCore] ${bp.reason}`));
      return;
    }

    lane.pending.push(entry);
    this.kickDrain(queueKey);
  }

  // ── Drain ────────────────────────────────────────────────────────────────

  kickDrain(queueKey: QueueKey): void {
    const lane = this._lanes.get(queueKey);
    if (!lane || lane.active || lane.pending.length === 0) return;

    lane.active = true;
    const entry = lane.pending.shift()!;

    executeQueueEntry(entry)
      .then(result => {
        lane.processedTotal++;
        lane.lastActivityTs = Date.now();
        entry.resolve(result);
      })
      .catch(err => {
        lane.failedTotal++;
        lane.lastActivityTs = Date.now();
        entry.reject(err as Error);
      })
      .finally(() => {
        lane.active = false;
        // Avoid stack overflow on deep queues
        setImmediate(() => this.kickDrain(queueKey));
      });
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  allStats(): QueueStats[] {
    return Array.from(this._lanes.entries()).map(([queueKey, lane]) =>
      this._laneToStats(queueKey, lane),
    );
  }

  laneStats(queueKey: QueueKey): QueueStats | null {
    const lane = this._lanes.get(queueKey);
    if (!lane) return null;
    return this._laneToStats(queueKey, lane);
  }

  // ── Eviction ─────────────────────────────────────────────────────────────

  evictIdle(maxIdleMs: number): number {
    const now  = Date.now();
    let evicted = 0;
    for (const [key, lane] of this._lanes) {
      if (!lane.active && lane.pending.length === 0 && now - lane.lastActivityTs > maxIdleMs) {
        this._lanes.delete(key);
        queueBackpressureGuard.evict(key);
        evicted++;
      }
    }
    return evicted;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _laneToStats(queueKey: QueueKey, lane: ProjectWriteQueue): QueueStats {
    return {
      queueKey,
      depth:          lane.pending.length,
      active:         lane.active,
      processedTotal: lane.processedTotal,
      failedTotal:    lane.failedTotal,
      lastActivityTs: lane.lastActivityTs,
    };
  }
}
