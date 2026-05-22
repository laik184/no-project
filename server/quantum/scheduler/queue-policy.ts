/**
 * server/quantum/scheduler/queue-policy.ts
 *
 * Queue overflow and priority eviction rules for the Worker Pool.
 * Determines what happens when the queue reaches capacity:
 *   reject    — refuse new tasks (default, fail-closed)
 *   drop_low  — evict lowest-priority tasks to make room
 *   drop_old  — evict oldest tasks (FIFO eviction)
 */

import type { PoolTask } from "./worker-types.ts";
import { TaskPriority }  from "./worker-types.ts";

// ── Policy configuration ──────────────────────────────────────────────────────

export type OverflowStrategy = "reject" | "drop_low" | "drop_old";

export interface QueuePolicyConfig {
  maxSize:          number;
  overflowStrategy: OverflowStrategy;
  priorityBoostAgeMs: number;  // age after which tasks get priority boost
}

export interface QueueDecision {
  accepted:        boolean;
  evicted?:        PoolTask[];
  reason?:         string;
}

const DEFAULT_POLICY: QueuePolicyConfig = {
  maxSize:            200,
  overflowStrategy:   "reject",
  priorityBoostAgeMs: 30_000,
};

// ── Queue policy ──────────────────────────────────────────────────────────────

class QueuePolicy {
  private config: QueuePolicyConfig = { ...DEFAULT_POLICY };

  configure(overrides: Partial<QueuePolicyConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  get maxSize(): number {
    return this.config.maxSize;
  }

  /**
   * Decide whether to accept a new task given the current queue state.
   * Returns a QueueDecision that may include tasks to evict.
   */
  evaluate(
    incomingTask:   PoolTask,
    currentQueue:   PoolTask[],
  ): QueueDecision {
    if (currentQueue.length < this.config.maxSize) {
      return { accepted: true };
    }

    // Queue is full — apply overflow strategy
    switch (this.config.overflowStrategy) {
      case "drop_low": {
        const evicted = this.evictLowestPriority(incomingTask, currentQueue);
        if (evicted.length > 0) return { accepted: true, evicted };
        return { accepted: false, reason: "Queue full — incoming priority not high enough to evict" };
      }
      case "drop_old": {
        const evicted = this.evictOldest(currentQueue);
        return { accepted: true, evicted };
      }
      default:
        return { accepted: false, reason: `Queue at capacity (${this.config.maxSize})` };
    }
  }

  /**
   * Apply priority boost to tasks that have waited too long.
   * Returns tasks whose priority was boosted.
   */
  applyAgeBoost(
    queue: Array<PoolTask & { enqueuedAt: number }>,
  ): string[] {
    const now     = Date.now();
    const boosted: string[] = [];

    for (const task of queue) {
      const age = now - task.enqueuedAt;
      if (age > this.config.priorityBoostAgeMs && task.priority > TaskPriority.CRITICAL) {
        (task as any).priority = task.priority - 1;  // boost by one level
        boosted.push(task.id);
      }
    }
    return boosted;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private evictLowestPriority(
    incoming: PoolTask,
    current:  PoolTask[],
  ): PoolTask[] {
    const worst = [...current].sort((a, b) => b.priority - a.priority)[0];
    if (!worst || worst.priority <= incoming.priority) return [];
    return [worst];
  }

  private evictOldest(current: PoolTask[]): PoolTask[] {
    return current.length > 0 ? [current[0]] : [];
  }
}

export const queuePolicy = new QueuePolicy();
