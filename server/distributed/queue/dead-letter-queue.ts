/**
 * Responsibility: Dead-letter queue — stores permanently failed tasks for inspection.
 *                 Tasks that exceed maxAttempts land here for manual replay or discard.
 * Dependencies: priority-queue (QueuedTask type)
 * Failure: push() is non-throwing; if DLQ is full, oldest entry is evicted.
 * Telemetry: size() and entries() exposed for distributed-trace and alerting.
 */

import type { QueuedTask } from "./task-queue.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeadLetterEntry {
  task:         QueuedTask;
  finalError:   string;
  deadAt:       number;
  totalAttempts: number;
}

// ── Dead-Letter Queue ─────────────────────────────────────────────────────────

const MAX_DLQ_SIZE = 500;

class DeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];

  push(task: QueuedTask, error: string): void {
    if (this.entries.length >= MAX_DLQ_SIZE) {
      this.entries.shift(); // evict oldest
    }
    this.entries.push({
      task,
      finalError:    error,
      deadAt:        Date.now(),
      totalAttempts: task.attempts,
    });
    console.warn(`[dead-letter-queue] Task ${task.id} added (attempts=${task.attempts}, error=${error})`);
  }

  size(): number {
    return this.entries.length;
  }

  entries(): ReadonlyArray<DeadLetterEntry> {
    return this.entries;
  }

  /** Pop the oldest dead-letter entry for manual replay. */
  pop(): DeadLetterEntry | undefined {
    return this.entries.shift();
  }

  /** Find by task id. */
  find(taskId: string): DeadLetterEntry | undefined {
    return this.entries.find(e => e.task.id === taskId);
  }

  /** Discard all entries (nuclear option — requires explicit intent). */
  clear(): void {
    this.entries.length = 0;
  }

  /** Stats for telemetry dashboard. */
  stats() {
    const now = Date.now();
    return {
      total:      this.entries.length,
      oldestAge:  this.entries[0] ? now - this.entries[0].deadAt : 0,
      byPriority: this.entries.reduce<Record<number, number>>((acc, e) => {
        acc[e.task.priority] = (acc[e.task.priority] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }
}

export const deadLetterQueue = new DeadLetterQueue();
