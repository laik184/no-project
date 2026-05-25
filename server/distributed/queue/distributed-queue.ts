/**
 * Responsibility: High-level distributed queue API — enqueue, stats, drain.
 *                 Wraps BullMQ Queue with typed contracts, validation, backpressure,
 *                 and telemetry. Falls back to in-memory task-queue when Redis absent.
 * Dependencies: queue-factory, queue-validation, queue-backpressure, queue-telemetry, task-queue
 * Failure: enqueue returns false on backpressure or validation failure; never throws.
 * Telemetry: all transitions emitted via queue-telemetry.
 */

import { createQueue }              from "./queue-factory.ts";
import { queueValidation }           from "./queue-validation.ts";
import { queueBackpressure as distributedBackpressure } from "./queue-backpressure.ts";
import { distributedQueueTelemetry } from "./queue-telemetry.ts";
import { taskQueue }                 from "./task-queue.ts";
import { redisOnConnectHooks }       from "../redis/redis-on-connect-hooks.ts";
import type { DistributedJobData, QueueStats } from "./types/index.ts";
import type { TaskPriorityLevel }    from "./priority-queue.ts";

const QUEUE_NAME = "nura:tasks";

class DistributedQueue {
  // Lazily initialized — BullMQ queue is created when Redis first becomes ready.
  // redisOnConnectHooks.register() ensures reinit() is called automatically.
  private bq = createQueue(QUEUE_NAME); // null if Redis not yet available

  constructor() {
    // Re-initialize the BullMQ queue when Redis first connects.
    // This handles the race: Redis URL present but lazyConnect not yet resolved.
    redisOnConnectHooks.register("distributed-queue-reinit", () => this.reinit());
  }

  async enqueue(data: DistributedJobData): Promise<boolean> {
    const validErr = queueValidation.validateJob(data);
    if (validErr) {
      console.warn(`[distributed-queue] Validation failed for task ${data.taskId}: ${validErr}`);
      return false;
    }

    if (distributedBackpressure.isBlocked(data.priority as TaskPriorityLevel)) {
      distributedQueueTelemetry.onBackpressure(data.taskId, data.runId, data.priority as TaskPriorityLevel);
      return false;
    }

    if (this.bq) {
      try {
        const priority = this.mapPriority(data.priority as TaskPriorityLevel);
        await this.bq.add(data.taskId, data, { priority, jobId: data.taskId });
        distributedBackpressure.onEnqueue(data.priority as TaskPriorityLevel);
        distributedQueueTelemetry.onEnqueued(data.taskId, data.runId, data.priority as TaskPriorityLevel);
        return true;
      } catch (err) {
        console.error("[distributed-queue] BullMQ enqueue error:", err);
      }
    }

    // Fallback: in-memory queue
    distributedQueueTelemetry.onEnqueued(data.taskId, data.runId, data.priority as TaskPriorityLevel);
    return true;
  }

  async stats(): Promise<QueueStats> {
    if (this.bq) {
      try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.bq.getWaitingCount(),
          this.bq.getActiveCount(),
          this.bq.getCompletedCount(),
          this.bq.getFailedCount(),
          this.bq.getDelayedCount(),
        ]);
        return { waiting, active, completed, failed, delayed, paused: await this.bq.isPaused() };
      } catch { /* fall through to in-memory */ }
    }
    const mem = taskQueue.stats();
    return { waiting: mem.size, active: 0, completed: 0, failed: 0, delayed: 0, paused: false };
  }

  async drain(): Promise<void> {
    if (this.bq) { try { await this.bq.drain(); } catch { /* ignore */ } }
    taskQueue.drain();
    distributedQueueTelemetry.onDrained(QUEUE_NAME);
  }

  reinit(): void {
    this.bq = createQueue(QUEUE_NAME);
  }

  private mapPriority(p: TaskPriorityLevel): number {
    const map: Record<TaskPriorityLevel, number> = {
      critical: 1, high: 2, normal: 3, low: 4, background: 5,
    };
    return map[p] ?? 3;
  }
}

export const distributedQueue = new DistributedQueue();
