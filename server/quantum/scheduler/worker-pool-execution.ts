/**
 * server/quantum/scheduler/worker-pool-execution.ts
 *
 * Standalone async execution kernel for the CentralWorkerPool.
 *
 * Extracted from the private _execute method so that worker-pool.ts
 * stays under the 250-line file-size limit.  All heavy retry/timeout
 * logic lives here; the pool class only owns state management.
 */

import { v4 as uuidv4 }                            from "uuid";
import { withHardTimeout }                          from "../execution/execution-timeout.ts";
import { withRetry, defaultIsRetryable }            from "../execution/execution-retry.ts";
import { workerMetrics }                            from "./worker-metrics.ts";
import {
  emitWorkerCompleted, emitWorkerFailed,
  emitWorkerTimeout, emitWorkerOverloaded,
}                                                  from "../telemetry/worker-telemetry.ts";
import type { PoolTask, SchedulerConfig }           from "./worker-types.ts";
import type { WorkerTask }                          from "../types/quantum.types.ts";
import type { PriorityQueue }                       from "./priority-queue.ts";

/** Mutable active-count reference shared between pool state and executor. */
export interface ActiveRef { value: number; }

/**
 * Execute a single worker task with retry/timeout semantics.
 * Decrements activeRef.value on completion, then triggers the next
 * queue item via the provided onTick callback.
 */
export async function runPoolExecution<T>(
  workerId:     string,
  raw:          WorkerTask,
  release:      () => void,
  originalTask: PoolTask<T>,
  config:       SchedulerConfig,
  activeRef:    ActiveRef,
  queue:        PriorityQueue,
  onTick: (wId: string, pathId: string, task: PoolTask<T>) => void,
): Promise<void> {
  const t0        = Date.now();
  const timeoutMs = raw.timeoutMs ?? config.defaultTimeoutMs;

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
  activeRef.value--;

  if (retryResult.success) {
    workerMetrics.taskCompleted();
    emitWorkerCompleted(originalTask.runId, {
      workerId, taskId: raw.taskId, runId: originalTask.runId, durationMs,
      retryCount: retryResult.attempts - 1,
    });
    raw.onDone?.(retryResult.value);
  } else {
    const errMsg = retryResult.lastError ?? "Unknown failure";
    if (errMsg.includes("timed out")) {
      workerMetrics.taskTimedOut();
      emitWorkerTimeout(originalTask.runId, {
        workerId, taskId: raw.taskId, runId: originalTask.runId, timeoutMs,
      });
    } else {
      workerMetrics.taskFailed();
      emitWorkerFailed(originalTask.runId, {
        workerId, taskId: raw.taskId, runId: originalTask.runId,
        error: errMsg, errorCode: "WORKER_FAILED", durationMs,
      });
    }
    raw.onError?.(new Error(errMsg));
  }

  const saturation = config.maxConcurrency * config.saturationThreshold;
  if (activeRef.value >= saturation) {
    emitWorkerOverloaded(originalTask.runId, {
      active:   activeRef.value,
      capacity: config.maxConcurrency,
      ratio:    activeRef.value / config.maxConcurrency,
    });
  }

  if (!queue.isEmpty) {
    const next = queue.peek();
    if (next) onTick(uuidv4(), next.pathId, originalTask);
  }
}
