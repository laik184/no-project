/**
 * Responsibility: Distributed recovery telemetry — records worker crash recovery,
 *                 queue replay, checkpoint restore, and distributed rollback events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the distributed recovery layer.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecoveryMetrics {
  workerRecoveries:     number;
  queueReplays:         number;
  checkpointRestores:   number;
  distributedRollbacks: number;
  failed:               number;
}

// ── Trace ────────────────────────────────────────────────────────────────────

class RecoveryTrace {
  private readonly metrics: RecoveryMetrics = {
    workerRecoveries: 0, queueReplays: 0,
    checkpointRestores: 0, distributedRollbacks: 0, failed: 0,
  };

  workerRecovery(runId: string, workerId: string, strategy: string): void {
    this.metrics.workerRecoveries++;
    this.emit("distributed.recovery", runId, { workerId, strategy, type: "worker_recovery" });
  }

  queueReplay(runId: string, taskId: string, attempt: number): void {
    this.metrics.queueReplays++;
    this.emit("distributed.retry", runId, { taskId, attempt, type: "queue_replay" });
  }

  checkpointRestore(runId: string, checkpointId: string, phase: string): void {
    this.metrics.checkpointRestores++;
    this.emit("distributed.recovery", runId, { checkpointId, phase, type: "checkpoint_restore" });
  }

  distributedRollback(runId: string, scope: string, nodesRolledBack: number): void {
    this.metrics.distributedRollbacks++;
    this.emit("distributed.recovery", runId, { scope, nodesRolledBack, type: "distributed_rollback" });
  }

  recoveryFailed(runId: string, reason: string): void {
    this.metrics.failed++;
    this.emit("agent.failed", runId, { reason, type: "recovery_failed" });
  }

  snapshot(): RecoveryMetrics {
    return { ...this.metrics };
  }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId,
        projectId: 0,
        phase:     "distributed.recovery",
        agentName: "recovery-trace",
        eventType,
        payload,
        ts: Date.now(),
      });
    } catch (err) {
      console.error("[recovery-trace] Emit error:", err);
    }
  }
}

export const recoveryTrace = new RecoveryTrace();
