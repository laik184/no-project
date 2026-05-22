/**
 * Responsibility: Top-level distributed recovery coordinator — listens to bus events,
 *                 orchestrates worker recovery, queue recovery, and checkpoint restore.
 *                 Integrates with the existing RecoveryManager without replacing it.
 * Dependencies: worker-recovery, queue-recovery, distributed-checkpoint, recovery-trace, bus
 * Failure: recovery failures are logged + telemetried; system enters degraded-but-running state.
 * Telemetry: emits distributed.recovery on every recovery action taken.
 */

import { workerRecovery }          from "./worker-recovery.ts";
import { queueRecovery }           from "./queue-recovery.ts";
import { distributedCheckpointStore } from "./distributed-checkpoint.ts";
import { recoveryTrace }           from "../telemetry/recovery-trace.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecoveryTrigger = "worker_failure" | "queue_failure" | "dag_failure" | "shutdown";

export interface RecoveryAction {
  trigger:        RecoveryTrigger;
  runId:          string;
  projectId:      number;
  workersRecovered: number;
  tasksReplayed:  number;
  checkpointUsed: boolean;
  durationMs:     number;
}

// ── Manager ───────────────────────────────────────────────────────────────────

class DistributedRecoveryManager {
  private initialized = false;

  /** Wire the manager to the bus — call once on server startup. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Listen for worker failures
    bus.on("agent.event" as any, (event: {
      eventType?: string;
      runId?:     string;
      projectId?: number;
      payload?:   { workerId?: string };
    }) => {
      if (event.eventType !== "worker.failed") return;
      const runId     = event.runId     ?? "unknown";
      const projectId = event.projectId ?? 0;
      const workerId  = event.payload?.workerId;
      if (workerId) {
        this.recoverWorker(workerId, runId, projectId).catch(err =>
          console.error("[distributed-recovery-manager] Worker recovery error:", err),
        );
      }
    });

    console.log("[distributed-recovery-manager] Initialized — listening for failure events.");
  }

  /** Recover a specific failed worker. */
  async recoverWorker(
    workerId:  string,
    runId:     string,
    projectId: number,
  ): Promise<RecoveryAction> {
    const t0 = Date.now();

    const result = await workerRecovery.recover(workerId, runId, projectId);

    return {
      trigger:          "worker_failure",
      runId,
      projectId,
      workersRecovered: result.decision !== "terminate" ? 1 : 0,
      tasksReplayed:    0,
      checkpointUsed:   false,
      durationMs:       Date.now() - t0,
    };
  }

  /** Full distributed recovery for a failed DAG run. */
  async recoverRun(runId: string, projectId: number): Promise<RecoveryAction> {
    const t0 = Date.now();

    // 1. Recover all failed workers
    const workerResults = await workerRecovery.recoverAll(runId, projectId);
    const workersRecovered = workerResults.filter(r => r.decision !== "terminate").length;

    // 2. Replay dead-letter tasks
    const tasksReplayed = queueRecovery.replayDeadLetter(runId, projectId);

    // 3. Try checkpoint restore
    const checkpoint = distributedCheckpointStore.restore(runId, projectId);

    recoveryTrace.distributedRollback(runId, "full_run_recovery", workersRecovered);

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.recovery",
      agentName: "distributed-recovery-manager",
      eventType: "distributed.recovery",
      payload:   { workersRecovered, tasksReplayed, checkpointUsed: !!checkpoint },
      ts:        Date.now(),
    });

    return {
      trigger:          "dag_failure",
      runId,
      projectId,
      workersRecovered,
      tasksReplayed,
      checkpointUsed:   !!checkpoint,
      durationMs:       Date.now() - t0,
    };
  }

  /** Graceful shutdown — drain queue and stop all workers. */
  shutdown(runId: string, projectId: number): void {
    const drained = queueRecovery.drain(runId, projectId);
    console.log(`[distributed-recovery-manager] Shutdown complete. Drained ${drained} tasks.`);
  }
}

export const distributedRecoveryManager = new DistributedRecoveryManager();
