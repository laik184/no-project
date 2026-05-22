/**
 * server/quantum/scheduler/worker-pool.ts
 *
 * Centralized Worker Pool + Priority Scheduler — the authoritative execution
 * hub for the Nura-X quantum runtime.
 *
 * Features
 * ────────
 *   • Priority-ordered heap queue (CRITICAL > HIGH > NORMAL > LOW)
 *   • Hard concurrency cap per worker type via TaskRouter
 *   • BackpressureController gates admission at saturation threshold
 *   • ExecutionLimiter enforces per-run concurrency
 *   • ExponentialBackoff retry with full telemetry
 *   • Hard timeout per task (TaskRouter provides defaults)
 *   • AbortSignal-aware cancellation
 *   • Graceful drain + shutdown
 *   • All lifecycle events emitted via WorkerTelemetry
 */

import { v4 as uuidv4 }              from "uuid";
import { PriorityQueue }             from "./priority-queue.ts";
import { backpressureController }    from "./backpressure-controller.ts";
import { executionLimiter }          from "../execution/execution-limiter.ts";
import { taskRouter }                from "./task-router.ts";
import { queuePolicy }               from "./queue-policy.ts";
import { workerMetrics }             from "./worker-metrics.ts";
import { withHardTimeout }           from "../execution/execution-timeout.ts";
import { withRetry, defaultIsRetryable } from "../execution/execution-retry.ts";
import {
  emitWorkerCreated, emitWorkerAssigned, emitWorkerStarted,
  emitWorkerCompleted, emitWorkerFailed, emitWorkerTimeout,
  emitWorkerCancelled, emitWorkerOverloaded,
} from "../telemetry/worker-telemetry.ts";
import {
  emitQueueSaturated, emitQueueOverflow, emitExecutionRejected, emitExecutionThrottled,
} from "../telemetry/queue-telemetry.ts";
import {
  QueueOverflowError, BackpressureError, TaskCancelledError,
} from "./worker-errors.ts";
import type { PoolTask, PoolResult, SchedulerConfig } from "./worker-types.ts";
import { DEFAULT_SCHEDULER_CONFIG, TaskPriority } from "./worker-types.ts";
import type { WorkerTask } from "../types/quantum.types.ts";
// WorkerTask alias for the backward-compat adapter at the bottom of this file
import type { WorkerTask as LegacyWorkerTask } from "../types/quantum.types.ts";

// ── Central Worker Pool ───────────────────────────────────────────────────────

export class CentralWorkerPool {
  private readonly _queue     = new PriorityQueue();
  private          _active    = 0;
  private          _draining  = false;
  private          _config: SchedulerConfig;
  /** pathId → Set of taskIds — supports cancelPath() from legacy callers */
  private readonly _pathTasks = new Map<string, Set<string>>();

  constructor(config: Partial<SchedulerConfig> = {}) {
    this._config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    workerMetrics.configure(this._config.maxConcurrency);
    backpressureController.configure({
      maxConcurrency:      this._config.maxConcurrency,
      maxQueueSize:        this._config.maxQueueSize,
      saturationThreshold: this._config.saturationThreshold,
    });
    executionLimiter.configure({
      globalLimit: this._config.maxConcurrency,
      perRunLimit: this._config.perRunLimit,
    });
    queuePolicy.configure({ maxSize: this._config.maxQueueSize });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Submit a task for governed, priority-scheduled execution. */
  async submit<T>(task: PoolTask<T>): Promise<PoolResult<T>> {
    if (this._draining) {
      return this._rejected(task, "Pool is draining — no new submissions", "POOL_EXHAUSTED");
    }

    // Abort-signal pre-check
    if (task.signal?.aborted) {
      emitWorkerCancelled(task.runId, { taskId: task.id, runId: task.runId });
      workerMetrics.taskCancelled();
      return this._rejected(task, "Task cancelled before submission", "TASK_CANCELLED");
    }

    // Backpressure gate
    const bp = backpressureController.evaluate(this._active, this._queue.size);
    if (bp === "reject") {
      const ratio = backpressureController.saturationRatio();
      emitExecutionRejected(task.runId, { taskId: task.id, runId: task.runId, reason: "backpressure", code: "BACKPRESSURE_REJECTED" });
      emitQueueSaturated(task.runId, { queueSize: this._queue.size, maxSize: this._config.maxQueueSize, saturationRatio: ratio, decision: "reject" });
      return this._rejected(task, new BackpressureError(ratio).message, "BACKPRESSURE_REJECTED");
    }

    if (bp === "throttle") {
      const cooldown = backpressureController.throttleCooldownMs();
      emitExecutionThrottled(task.runId, task.id, cooldown, backpressureController.saturationRatio());
      await new Promise(r => setTimeout(r, cooldown));
    }

    // Per-run limit gate
    if (!executionLimiter.hasCapacity(task.runId)) {
      emitExecutionRejected(task.runId, { taskId: task.id, runId: task.runId, reason: "per-run limit", code: "PER_RUN_LIMIT" });
      return this._rejected(task, `Run ${task.runId} at concurrency limit`, "PER_RUN_LIMIT");
    }

    // Queue overflow check
    const queueItems = this._queue.toArray() as unknown as PoolTask[];
    const decision   = queuePolicy.evaluate(task, queueItems);
    if (!decision.accepted) {
      emitQueueOverflow(task.runId, { taskId: task.id, runId: task.runId, queueSize: this._queue.size, maxSize: this._config.maxQueueSize });
      workerMetrics.queueOverflow();
      return this._rejected(task, decision.reason ?? "Queue full", "QUEUE_OVERFLOW");
    }
    if (decision.evicted?.length) {
      workerMetrics.queueOverflow();
      emitQueueOverflow(task.runId, { taskId: task.id, runId: task.runId, queueSize: this._queue.size, maxSize: this._config.maxQueueSize, evicted: decision.evicted.length });
    }

    // Enqueue
    return this._enqueue(task);
  }

  /** Cancel a queued task by id. Returns true if it was in the queue. */
  cancel(taskId: string, runId: string): boolean {
    const removed = this._queue.remove(taskId);
    if (removed) {
      emitWorkerCancelled(runId, { taskId, runId });
      workerMetrics.taskCancelled();
    }
    return removed;
  }

  /** Cancel all queued tasks belonging to a given pathId. */
  cancelPath(pathId: string): void {
    const taskIds = this._pathTasks.get(pathId);
    if (!taskIds) return;
    for (const taskId of taskIds) {
      this._queue.remove(taskId);
      emitWorkerCancelled(pathId, { taskId, runId: pathId });
      workerMetrics.taskCancelled();
    }
    this._pathTasks.delete(pathId);
  }

  /** Drain: stop accepting new work, wait for active tasks to finish. */
  async drain(): Promise<void> {
    this._draining = true;
    while (this._active > 0 || !this._queue.isEmpty) {
      await new Promise(r => setTimeout(r, 50));
    }
    this._draining = false;
  }

  get activeCount(): number  { return this._active; }
  get pendingCount(): number { return this._queue.size; }
  stats() {
    return {
      active:       this._active,
      pending:      this._queue.size,
      draining:     this._draining,
      metrics:      workerMetrics.snapshot(),
      backpressure: backpressureController.snapshot(),
      limiter:      executionLimiter.stats(),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _enqueue<T>(task: PoolTask<T>): Promise<PoolResult<T>> {
    return new Promise<PoolResult<T>>((resolve) => {
      const workerId = uuidv4();
      emitWorkerCreated(task.runId, { workerId, workerType: taskRouter.route(task), poolSize: this._active });
      emitWorkerAssigned(task.runId, { workerId, taskId: task.id, runId: task.runId, priority: task.priority, taskType: task.taskType });

      // Track pathId → taskId for cancelPath() support
      const pathId = (task.metadata?.pathId as string) ?? task.runId;
      if (!this._pathTasks.has(pathId)) this._pathTasks.set(pathId, new Set());
      this._pathTasks.get(pathId)!.add(task.id);

      const wrapped: WorkerTask = {
        taskId:    task.id,
        pathId,
        priority:  task.priority,
        timeoutMs: taskRouter.adjustedTimeoutMs(task),
        fn:        task.fn as () => Promise<unknown>,
        signal:    task.signal,
        onDone: (data) => {
          this._pathTasks.get(pathId)?.delete(task.id);
          resolve({ taskId: task.id, runId: task.runId, success: true, data: data as T, durationMs: 0, retryCount: 0, workerId });
        },
        onError:(err) => {
          this._pathTasks.get(pathId)?.delete(task.id);
          resolve({ taskId: task.id, runId: task.runId, success: false, error: err.message, durationMs: 0, retryCount: 0, workerId });
        },
      };

      workerMetrics.taskEnqueued();
      this._queue.enqueue(wrapped);
      this._tick(workerId, task.runId, task);
    });
  }

  private _tick<T>(workerId: string, runId: string, originalTask: PoolTask<T>): void {
    if (this._active >= this._config.maxConcurrency || this._queue.isEmpty) return;

    const raw = this._queue.dequeue();
    if (!raw) return;

    if (raw.signal?.aborted) {
      emitWorkerCancelled(runId, { taskId: raw.taskId, runId });
      workerMetrics.taskCancelled();
      raw.onError?.(new TaskCancelledError(raw.taskId));
      this._tick(workerId, runId, originalTask);
      return;
    }

    this._active++;
    workerMetrics.taskDequeued();
    workerMetrics.taskStarted();
    emitWorkerStarted(runId, { workerId, taskId: raw.taskId, runId, startedAt: Date.now() });

    const release = executionLimiter.acquire(runId);
    this._execute(workerId, raw, release, originalTask);
  }

  private async _execute<T>(
    workerId:     string,
    raw:          WorkerTask,
    release:      () => void,
    originalTask: PoolTask<T>,
  ): Promise<void> {
    const t0        = Date.now();
    const timeoutMs = raw.timeoutMs ?? this._config.defaultTimeoutMs;

    const retryResult = await withRetry(
      () => withHardTimeout(raw.fn(), timeoutMs, raw.taskId),
      {
        taskId:      raw.taskId,
        runId:       originalTask.runId,
        maxAttempts: (originalTask.maxRetries ?? 0) + 1,
        baseDelayMs: 500,
        maxDelayMs:  30_000,
        factor:      2,
        isRetryable: defaultIsRetryable,
      },
    );

    const durationMs = Date.now() - t0;
    release();
    this._active--;

    if (retryResult.success) {
      workerMetrics.taskCompleted();
      emitWorkerCompleted(originalTask.runId, { workerId, taskId: raw.taskId, runId: originalTask.runId, durationMs, retryCount: retryResult.attempts - 1 });
      raw.onDone?.(retryResult.value);
    } else {
      const errMsg = retryResult.lastError ?? "Unknown failure";
      if (errMsg.includes("timed out")) {
        workerMetrics.taskTimedOut();
        emitWorkerTimeout(originalTask.runId, { workerId, taskId: raw.taskId, runId: originalTask.runId, timeoutMs });
      } else {
        workerMetrics.taskFailed();
        emitWorkerFailed(originalTask.runId, { workerId, taskId: raw.taskId, runId: originalTask.runId, error: errMsg, errorCode: "WORKER_FAILED", durationMs });
      }
      raw.onError?.(new Error(errMsg));
    }

    if (this._active >= this._config.maxConcurrency * this._config.saturationThreshold) {
      emitWorkerOverloaded(originalTask.runId, { active: this._active, capacity: this._config.maxConcurrency, ratio: this._active / this._config.maxConcurrency });
    }

    // Process next item
    if (!this._queue.isEmpty) {
      const next = this._queue.peek();
      if (next) this._tick(uuidv4(), next.pathId, originalTask);
    }
  }

  private _rejected<T>(task: PoolTask<T>, reason: string, code: string): PoolResult<T> {
    return { taskId: task.id, runId: task.runId, success: false, error: reason, durationMs: 0, retryCount: 0, workerId: "none" };
  }
}

export const centralWorkerPool = new CentralWorkerPool();

// ── Backward-compatible adapter ───────────────────────────────────────────────
// path-spawner.ts and other legacy callers import `workerPool` with the old
// WorkerTask interface. This thin adapter converts WorkerTask → PoolTask and
// delegates to centralWorkerPool, preserving cancelPath() semantics.

export const workerPool = {
  /** Submit a legacy WorkerTask through the centralWorkerPool. */
  submit<T>(task: LegacyWorkerTask<T>): Promise<void> {
    const poolTask = {
      id:            task.taskId,
      runId:         task.pathId,
      priority:      task.priority <= 2 ? TaskPriority.HIGH : TaskPriority.NORMAL,
      timeoutMs:     task.timeoutMs ?? 60_000,
      maxRetries:    0,
      taskType:      "agent-run",
      executionMode: "parallel" as const,
      fn:            task.fn as () => Promise<T>,
      signal:        task.signal,
      metadata:      { pathId: task.pathId },
    };
    return centralWorkerPool.submit<T>(poolTask).then(result => {
      if (result.success) task.onDone?.(result.data as T);
      else task.onError?.(new Error(result.error ?? "worker failed"));
    });
  },

  /** Cancel all queued tasks for a given pathId. */
  cancelPath(pathId: string): void {
    centralWorkerPool.cancelPath(pathId);
  },

  stats() {
    return centralWorkerPool.stats();
  },
};
