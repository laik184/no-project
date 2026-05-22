/**
 * Responsibility: Backpressure controller — tracks queue depth per priority level
 *                 and signals when the queue is too full to accept new tasks.
 * Dependencies: none — pure counters.
 * Failure: isBlocked() returns true to reject tasks gracefully; never throws.
 * Telemetry: pressure() exposed to queue-trace for instrumentation.
 */

import type { TaskPriorityLevel } from "./priority-queue.ts";

// ── Limits ────────────────────────────────────────────────────────────────────

const MAX_QUEUE_DEPTH: Record<TaskPriorityLevel, number> = {
  0: 50,   // CRITICAL — always allow up to 50
  1: 100,  // HIGH
  2: 200,  // NORMAL
  3: 500,  // LOW
};

// ── Controller ────────────────────────────────────────────────────────────────

class QueueBackpressure {
  private readonly counts: Map<TaskPriorityLevel, number> = new Map([
    [0, 0], [1, 0], [2, 0], [3, 0],
  ]);

  /** Returns true when the queue for this priority is at capacity. */
  isBlocked(priority: TaskPriorityLevel): boolean {
    const current = this.counts.get(priority) ?? 0;
    const limit   = MAX_QUEUE_DEPTH[priority];
    return current >= limit;
  }

  /** Returns overall pressure as a ratio (0.0–1.0). */
  pressure(): Record<string, number> {
    return {
      CRITICAL: this.ratio(0),
      HIGH:     this.ratio(1),
      NORMAL:   this.ratio(2),
      LOW:      this.ratio(3),
    };
  }

  onEnqueue(priority: TaskPriorityLevel): void {
    this.counts.set(priority, (this.counts.get(priority) ?? 0) + 1);
  }

  onDequeue(priority: TaskPriorityLevel): void {
    const cur = this.counts.get(priority) ?? 0;
    this.counts.set(priority, Math.max(0, cur - 1));
  }

  reset(): void {
    for (const k of this.counts.keys()) this.counts.set(k, 0);
  }

  private ratio(priority: TaskPriorityLevel): number {
    const cur   = this.counts.get(priority) ?? 0;
    const limit = MAX_QUEUE_DEPTH[priority];
    return Math.min(1, cur / limit);
  }
}

export const queueBackpressure = new QueueBackpressure();
