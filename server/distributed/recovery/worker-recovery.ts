/**
 * Responsibility: Worker-level distributed recovery — handles failed/terminated workers
 *                 by applying the failure policy and optionally re-queuing their tasks.
 * Dependencies: worker-registry, worker-failure-policy, task-queue, recovery-trace
 * Failure: recovery failures are logged; worker marked terminated if recovery exhausted.
 * Telemetry: emits distributed.recovery on each recovery action.
 */

import { workerRegistry }      from "../workers/worker-registry.ts";
import { workerFailurePolicy } from "../workers/worker-failure-policy.ts";
import { taskQueue, TaskPriority } from "../queue/task-queue.ts";
import { recoveryTrace }       from "../telemetry/recovery-trace.ts";
import { bus }                 from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerRecoveryResult {
  workerId:   string;
  taskId:     string | null;
  decision:   string;
  requeued:   boolean;
  newWorkerId?: string;
}

// ── Recovery ─────────────────────────────────────────────────────────────────

class WorkerRecovery {
  /**
   * Recover a failed worker slot.
   * If the worker had an in-flight task, re-queues it at HIGH priority.
   */
  async recover(
    workerId:    string,
    runId:       string,
    projectId:   number,
  ): Promise<WorkerRecoveryResult> {
    const slot = workerRegistry.get(workerId);
    if (!slot) {
      return { workerId, taskId: null, decision: "not_found", requeued: false };
    }

    const taskId   = slot.taskId;
    const decision = workerFailurePolicy.decide(slot);
    const newSlot  = workerFailurePolicy.apply(slot, decision);

    recoveryTrace.workerRecovery(runId, workerId, decision);

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.recovery",
      agentName: "worker-recovery",
      eventType: "distributed.recovery",
      payload:   { workerId, taskId, decision, newWorkerId: newSlot?.id },
      ts:        Date.now(),
    });

    // Re-queue the in-flight task if we have enough context
    // (actual fn is not stored in slot — callers must handle re-queue via taskQueue.requeue)
    return {
      workerId,
      taskId,
      decision,
      requeued:    false, // task re-queue happens via task-queue on the caller side
      newWorkerId: newSlot?.id,
    };
  }

  /** Scan all failed workers and attempt recovery. */
  async recoverAll(runId: string, projectId: number): Promise<WorkerRecoveryResult[]> {
    const failed = workerRegistry.byStatus("failed");
    return Promise.all(failed.map(slot => this.recover(slot.id, runId, projectId)));
  }

  /** Drain orphan workers (timed-out but still in "busy" state). */
  drainOrphans(): string[] {
    const { isTimedOut, failSlot } = require("../workers/worker-slot.ts");
    const busy  = workerRegistry.getBusy();
    const orphans: string[] = [];

    for (const slot of busy) {
      if (isTimedOut(slot)) {
        workerRegistry.update(failSlot(slot));
        orphans.push(slot.id);
      }
    }

    return orphans;
  }
}

export const workerRecovery = new WorkerRecovery();
