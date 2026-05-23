/**
 * server/quantum/scheduler/worker-pool-adapter.ts
 *
 * Backward-compatible `workerPool` adapter.
 *
 * path-spawner.ts and other legacy callers import `workerPool` with the
 * old WorkerTask interface.  This thin adapter converts WorkerTask → PoolTask
 * and delegates to centralWorkerPool, preserving cancelPath() semantics.
 *
 * Separated from worker-pool.ts to keep that file under 250 lines.
 */

import { centralWorkerPool }  from "./worker-pool.ts";
import { TaskPriority }       from "./worker-types.ts";
import type { WorkerTask }    from "../types/quantum.types.ts";

export const workerPool = {
  /** Submit a legacy WorkerTask through the centralWorkerPool. */
  submit<T>(task: WorkerTask<T>): Promise<void> {
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
