/**
 * Responsibility: Central entry point for all distributed worker execution.
 *                 Governs admission, capacity, priority routing, backpressure,
 *                 lifecycle, and telemetry for every task in the system.
 * Dependencies: worker-pool, worker-capacity, worker-backpressure, worker-priority, worker-telemetry
 * Failure: submit() returns error result on admission rejection; never throws.
 * Telemetry: delegates all events to worker-telemetry and existing worker-pool.
 */

import { workerPool }        from "./worker-pool.ts";
import { workerCapacity }    from "./worker-capacity.ts";
import { workerBackpressure } from "./worker-backpressure.ts";
import { priorityToTier, priorityTimeout, type TaskPriority } from "./worker-priority.ts";
import { centralWorkerTelemetry } from "./worker-telemetry.ts";
import type { WorkerTask, WorkerResult } from "./worker-lifecycle.ts";
import type { CentralWorkerStats }       from "./types/index.ts";

export interface CentralTask<T = unknown> extends WorkerTask<T> {
  priority?: TaskPriority;
}

class CentralWorkerPool {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    workerPool.init();
    this.initialized = true;
    console.log("[central-worker-pool] Initialized — governing all distributed execution.");
  }

  async submit<T>(task: CentralTask<T>): Promise<WorkerResult<T>> {
    const tier    = priorityToTier(task.priority ?? "normal");
    const timeout = task.timeoutMs ?? priorityTimeout(task.priority ?? "normal");

    if (!workerBackpressure.isAdmissionAllowed(tier)) {
      centralWorkerTelemetry.onBackpressure(task.taskId, task.runId, tier);
      return {
        taskId: task.taskId, workerId: "none",
        success: false, error: "worker_backpressure_rejected",
        durationMs: 0,
      };
    }

    workerBackpressure.onAdmit(tier);
    centralWorkerTelemetry.onSubmitted(task.taskId, task.runId, tier);

    const workerTask: WorkerTask<T> = { ...task, type: tier, timeoutMs: timeout };
    const result = await workerPool.submit<T>(workerTask);

    workerBackpressure.onComplete(tier);
    if (result.success) {
      centralWorkerTelemetry.onCompleted(task.taskId, task.runId, result.durationMs);
    } else {
      centralWorkerTelemetry.onFailed(task.taskId, task.runId, result.error ?? "unknown");
    }

    return result;
  }

  stats(): CentralWorkerStats {
    return workerCapacity.all();
  }

  shutdown(): void {
    workerPool.shutdown();
    console.log("[central-worker-pool] Shutdown complete.");
  }
}

export const centralWorkerPool = new CentralWorkerPool();
