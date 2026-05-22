/**
 * Responsibility: Top-level worker pool — allocates, executes, recovers worker slots.
 *                 Separates IO-bound (max 20), CPU-bound (max 4), LLM (max 5) workers.
 * Dependencies: worker-registry, worker-lifecycle, worker-heartbeat, worker-failure-policy
 * Failure: if no slot available, task is rejected with "pool_exhausted"; never silently drops.
 * Telemetry: delegates all worker.* events to worker-lifecycle + worker-trace.
 */

import { workerRegistry }      from "./worker-registry.ts";
import { workerLifecycle, WorkerTask, WorkerResult } from "./worker-lifecycle.ts";
import { workerHeartbeat }     from "./worker-heartbeat.ts";
import { workerFailurePolicy } from "./worker-failure-policy.ts";
import type { WorkerType }     from "./worker-slot.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const POOL_LIMITS: Record<WorkerType, number> = {
  "io-bound":  20,
  "cpu-bound":  4,
  "llm":        5,
};

// ── Pool ──────────────────────────────────────────────────────────────────────

class WorkerPool {
  private initialized = false;

  /** Boot the pool — pre-allocate minimum slots and start heartbeat monitor. */
  init(preAlloc: Partial<Record<WorkerType, number>> = {}): void {
    if (this.initialized) return;

    const defaults: Partial<Record<WorkerType, number>> = {
      "io-bound":  5,
      "cpu-bound": 2,
      "llm":       2,
      ...preAlloc,
    };

    for (const [type, count] of Object.entries(defaults) as [WorkerType, number][]) {
      for (let i = 0; i < count; i++) {
        workerRegistry.register(type, {
          maxFailures: 3,
          timeoutMs:   type === "llm" ? 120_000 : type === "cpu-bound" ? 60_000 : 30_000,
        });
      }
    }

    workerHeartbeat.start();
    this.initialized = true;
    console.log("[worker-pool] Initialized —", workerRegistry.stats());
  }

  /** Submit a task to an available worker. Grows pool if under limit. */
  async submit<T>(task: WorkerTask<T>): Promise<WorkerResult<T>> {
    const slot = this.acquire(task.type);
    if (!slot) {
      return {
        taskId:     task.taskId,
        workerId:   "none",
        success:    false,
        error:      "pool_exhausted",
        durationMs: 0,
      };
    }

    const result = await workerLifecycle.execute(slot.id, task);

    // Handle failure policy
    if (!result.success) {
      const current = workerRegistry.get(slot.id);
      if (current && (current.status === "failed" || current.status === "terminated")) {
        const decision = workerFailurePolicy.decide(current);
        workerFailurePolicy.apply(current, decision);
        if (decision === "replace") this.grow(task.type, 1);
      }
    } else {
      workerFailurePolicy.resetHistory(slot.id);
    }

    return result;
  }

  /** Stats for health checks and telemetry. */
  stats() {
    return {
      registry:   workerRegistry.stats(),
      limits:     POOL_LIMITS,
      failPolicy: workerFailurePolicy.summary(),
    };
  }

  shutdown(): void {
    workerHeartbeat.stop();
    console.log("[worker-pool] Shutdown complete.");
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private acquire(type: WorkerType) {
    const idle = workerRegistry.getIdle(type);
    if (idle.length > 0) return idle[0];

    const total = workerRegistry.byStatus("idle", type).length
                + workerRegistry.byStatus("busy", type).length
                + workerRegistry.byStatus("draining", type).length;

    if (total < POOL_LIMITS[type]) {
      return workerRegistry.register(type, {
        maxFailures: 3,
        timeoutMs:   type === "llm" ? 120_000 : type === "cpu-bound" ? 60_000 : 30_000,
      });
    }

    return null; // pool exhausted
  }

  private grow(type: WorkerType, n: number): void {
    for (let i = 0; i < n; i++) {
      workerRegistry.register(type, { maxFailures: 3 });
    }
  }
}

export const workerPool = new WorkerPool();
