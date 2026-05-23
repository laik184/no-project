/**
 * server/quantum/scheduler/worker-pool.ts
 *
 * CentralWorkerPool — priority-scheduled, backpressure-governed execution hub.
 * Heavy execution logic lives in worker-pool-execution.ts (≤250 LOC split).
 * Backward-compat adapter lives in worker-pool-adapter.ts.
 */

import { v4 as uuidv4 }              from "uuid";
import { PriorityQueue }             from "./priority-queue.ts";
import { backpressureController }    from "./backpressure-controller.ts";
import { executionLimiter }          from "../execution/execution-limiter.ts";
import { taskRouter }                from "./task-router.ts";
import { queuePolicy }               from "./queue-policy.ts";
import { workerMetrics }             from "./worker-metrics.ts";
import {
  emitWorkerCreated, emitWorkerAssigned, emitWorkerStarted, emitWorkerCancelled,
}                                    from "../telemetry/worker-telemetry.ts";
import {
  emitQueueSaturated, emitQueueOverflow, emitExecutionRejected, emitExecutionThrottled,
}                                    from "../telemetry/queue-telemetry.ts";
import {
  QueueOverflowError, BackpressureError, TaskCancelledError,
}                                    from "./worker-errors.ts";
import type { PoolTask, PoolResult, SchedulerConfig } from "./worker-types.ts";
import { DEFAULT_SCHEDULER_CONFIG, TaskPriority }    from "./worker-types.ts";
import type { WorkerTask }           from "../types/quantum.types.ts";
import { runPoolExecution }          from "./worker-pool-execution.ts";
import type { ActiveRef }            from "./worker-pool-execution.ts";

export class CentralWorkerPool {
  private readonly _queue      = new PriorityQueue();
  private readonly _activeRef: ActiveRef = { value: 0 };
  private          _draining   = false;
  private          _config: SchedulerConfig;
  private readonly _pathTasks  = new Map<string, Set<string>>();

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

  async submit<T>(task: PoolTask<T>): Promise<PoolResult<T>> {
    if (this._draining) {
      return this._rejected(task, "Pool is draining — no new submissions", "POOL_EXHAUSTED");
    }
    if (task.signal?.aborted) {
      emitWorkerCancelled(task.runId, { taskId: task.id, runId: task.runId });
      workerMetrics.taskCancelled();
      return this._rejected(task, "Task cancelled before submission", "TASK_CANCELLED");
    }

    const active = this._activeRef.value;
    const bp = backpressureController.evaluate(active, this._queue.size);
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

    if (!executionLimiter.hasCapacity(task.runId)) {
      emitExecutionRejected(task.runId, { taskId: task.id, runId: task.runId, reason: "per-run limit", code: "PER_RUN_LIMIT" });
      return this._rejected(task, `Run ${task.runId} at concurrency limit`, "PER_RUN_LIMIT");
    }

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

    return this._enqueue(task);
  }

  cancel(taskId: string, runId: string): boolean {
    const removed = this._queue.remove(taskId);
    if (removed) {
      emitWorkerCancelled(runId, { taskId, runId });
      workerMetrics.taskCancelled();
    }
    return removed;
  }

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

  async drain(): Promise<void> {
    this._draining = true;
    while (this._activeRef.value > 0 || !this._queue.isEmpty) {
      await new Promise(r => setTimeout(r, 50));
    }
    this._draining = false;
  }

  get activeCount(): number  { return this._activeRef.value; }
  get pendingCount(): number { return this._queue.size; }

  stats() {
    return {
      active:       this._activeRef.value,
      pending:      this._queue.size,
      draining:     this._draining,
      metrics:      workerMetrics.snapshot(),
      backpressure: backpressureController.snapshot(),
      limiter:      executionLimiter.stats(),
    };
  }

  private _enqueue<T>(task: PoolTask<T>): Promise<PoolResult<T>> {
    return new Promise<PoolResult<T>>((resolve) => {
      const workerId = uuidv4();
      emitWorkerCreated(task.runId, { workerId, workerType: taskRouter.route(task), poolSize: this._activeRef.value });
      emitWorkerAssigned(task.runId, { workerId, taskId: task.id, runId: task.runId, priority: task.priority, taskType: task.taskType });

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
        onError: (err) => {
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
    if (this._activeRef.value >= this._config.maxConcurrency || this._queue.isEmpty) return;

    const raw = this._queue.dequeue();
    if (!raw) return;

    if (raw.signal?.aborted) {
      emitWorkerCancelled(runId, { taskId: raw.taskId, runId });
      workerMetrics.taskCancelled();
      raw.onError?.(new TaskCancelledError(raw.taskId));
      this._tick(workerId, runId, originalTask);
      return;
    }

    this._activeRef.value++;
    workerMetrics.taskDequeued();
    workerMetrics.taskStarted();
    emitWorkerStarted(runId, { workerId, taskId: raw.taskId, runId, startedAt: Date.now() });

    const release = executionLimiter.acquire(runId);
    runPoolExecution(
      workerId, raw, release, originalTask,
      this._config, this._activeRef, this._queue,
      (wId, pathId, task) => this._tick(wId, pathId as any, task),
    );
  }

  private _rejected<T>(task: PoolTask<T>, reason: string, _code: string): PoolResult<T> {
    return { taskId: task.id, runId: task.runId, success: false, error: reason, durationMs: 0, retryCount: 0, workerId: "none" };
  }
}

export const centralWorkerPool = new CentralWorkerPool();

export { workerPool } from "./worker-pool-adapter.ts";
