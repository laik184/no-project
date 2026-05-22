/**
 * Responsibility: Worker slot lifecycle transitions (start → busy → idle/failed/terminated).
 *                 Coordinates with registry and emits lifecycle events to the bus.
 * Dependencies: worker-registry, worker-slot, bus, worker-trace
 * Failure: exceptions during task execution mark slot as failed; slot enters recovery queue.
 * Telemetry: emits worker.started, worker.completed, worker.failed on every transition.
 */

import { workerRegistry }                  from "./worker-registry.ts";
import { workerTrace }                     from "../telemetry/worker-trace.ts";
import { assignTask, releaseSlot, failSlot } from "./worker-slot.ts";
import { bus }                             from "../../infrastructure/events/bus.ts";
import type { WorkerType }                 from "./worker-slot.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerTask<T = unknown> {
  taskId:    string;
  runId:     string;
  projectId: number;
  type:      WorkerType;
  fn:        () => Promise<T>;
  timeoutMs?: number;
}

export interface WorkerResult<T = unknown> {
  taskId:     string;
  workerId:   string;
  success:    boolean;
  data?:      T;
  error?:     string;
  durationMs: number;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

class WorkerLifecycle {
  /** Execute a task on the given worker slot id. */
  async execute<T>(slotId: string, task: WorkerTask<T>): Promise<WorkerResult<T>> {
    const slot = workerRegistry.get(slotId);
    if (!slot) throw new Error(`[worker-lifecycle] Slot ${slotId} not found`);

    const assigned = assignTask(slot, task.taskId, task.runId);
    workerRegistry.update(assigned);

    bus.emit("agent.event", {
      runId:     task.runId,
      projectId: task.projectId,
      phase:     "distributed.worker",
      agentName: "worker-lifecycle",
      eventType: "worker.started",
      payload:   { workerId: slotId, taskId: task.taskId, type: slot.type },
      ts:        Date.now(),
    });
    workerTrace.workerStarted(slotId, task.taskId, task.runId);

    const t0 = Date.now();
    try {
      const timeoutMs = task.timeoutMs ?? assigned.timeoutMs;
      const data      = await Promise.race([
        task.fn(),
        this.timeout(timeoutMs, task.taskId),
      ]);

      const released = releaseSlot(assigned);
      workerRegistry.update(released);

      const durationMs = Date.now() - t0;
      workerTrace.workerCompleted(slotId, task.taskId, durationMs);

      bus.emit("agent.event", {
        runId:     task.runId,
        projectId: task.projectId,
        phase:     "distributed.worker",
        agentName: "worker-lifecycle",
        eventType: "worker.completed",
        payload:   { workerId: slotId, taskId: task.taskId, durationMs },
        ts:        Date.now(),
      });

      return { taskId: task.taskId, workerId: slotId, success: true, data, durationMs };

    } catch (err) {
      const failed     = failSlot(assigned);
      workerRegistry.update(failed);

      const durationMs = Date.now() - t0;
      const error      = err instanceof Error ? err.message : String(err);
      workerTrace.workerFailed(slotId, task.taskId, error);

      bus.emit("agent.event", {
        runId:     task.runId,
        projectId: task.projectId,
        phase:     "distributed.worker",
        agentName: "worker-lifecycle",
        eventType: "worker.failed",
        payload:   { workerId: slotId, taskId: task.taskId, error, durationMs },
        ts:        Date.now(),
      });

      return { taskId: task.taskId, workerId: slotId, success: false, error, durationMs };
    }
  }

  private timeout(ms: number, taskId: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Worker task ${taskId} timed out after ${ms}ms`)), ms),
    );
  }
}

export const workerLifecycle = new WorkerLifecycle();
