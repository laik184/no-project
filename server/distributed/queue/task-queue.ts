/**
 * Responsibility: Primary task queue — enqueues, dequeues, and tracks queued tasks.
 *                 Routes to priority-queue internally; exposes typed task lifecycle.
 * Dependencies: priority-queue, queue-backpressure, distributed/telemetry/queue-trace
 * Failure: enqueue fails fast if backpressure limit exceeded (returns false, never throws).
 * Telemetry: emits queue.blocked on backpressure; queue-trace records all transitions.
 */

import { PriorityQueue, TaskPriority, TaskPriorityLevel } from "./priority-queue.ts";
import { queueBackpressure }                              from "./queue-backpressure.ts";
import { queueTrace }                                     from "../telemetry/queue-trace.ts";
import type { WorkerType }                                from "../workers/worker-slot.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueuedTask<T = unknown> {
  id:           string;
  runId:        string;
  projectId:    number;
  priority:     TaskPriorityLevel;
  workerType:   WorkerType;
  enqueuedAt:   number;
  attempts:     number;
  maxAttempts:  number;
  fn:           () => Promise<T>;
  timeoutMs?:   number;
  tags?:        string[];
}

// ── Task Queue ────────────────────────────────────────────────────────────────

class TaskQueue {
  private readonly pq    = new PriorityQueue<QueuedTask>();
  private readonly index = new Map<string, QueuedTask>();

  /** Attempt to enqueue a task. Returns false if backpressure rejects it. */
  enqueue(task: QueuedTask): boolean {
    if (queueBackpressure.isBlocked(task.priority)) {
      queueTrace.queueBlocked(task.id, task.runId, task.priority);
      return false;
    }

    const withTimestamp = { ...task, enqueuedAt: Date.now() };
    this.pq.enqueue(withTimestamp, task.priority);
    this.index.set(task.id, withTimestamp);
    queueTrace.enqueued(task.id, task.runId, task.priority);
    queueBackpressure.onEnqueue(task.priority);
    return true;
  }

  /** Dequeue the highest-priority task. Returns undefined if queue is empty. */
  dequeue(): QueuedTask | undefined {
    const task = this.pq.dequeue();
    if (!task) return undefined;
    this.index.delete(task.id);
    queueBackpressure.onDequeue(task.priority);
    queueTrace.dequeued(task.id, task.runId, task.priority);
    return task;
  }

  /** Re-enqueue a task after failure (increments attempt count). */
  requeue(task: QueuedTask): boolean {
    if (task.attempts >= task.maxAttempts) return false;
    return this.enqueue({ ...task, attempts: task.attempts + 1 });
  }

  peek(): QueuedTask | undefined {
    return this.pq.peek();
  }

  has(taskId: string): boolean {
    return this.index.has(taskId);
  }

  size(): number {
    return this.pq.size;
  }

  isEmpty(): boolean {
    return this.pq.isEmpty();
  }

  /** Drain all tasks — used on graceful shutdown or dead-letter sweep. */
  drain(): QueuedTask[] {
    const out = this.pq.drain();
    this.index.clear();
    queueBackpressure.reset();
    return out;
  }

  stats() {
    return {
      size:       this.pq.size,
      pressure:   queueBackpressure.pressure(),
      nextPriority: this.pq.peekPriority(),
    };
  }
}

export const taskQueue = new TaskQueue();
export { TaskPriority };
