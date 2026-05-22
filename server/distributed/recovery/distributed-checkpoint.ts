/**
 * Responsibility: Distributed checkpoint store — captures and restores execution state
 *                 snapshots for distributed runs, enabling resume-on-failure semantics.
 * Dependencies: recovery-trace, bus
 * Failure: checkpoint not found → returns null; caller initiates fresh execution.
 * Telemetry: emits distributed.recovery on restore; agent.completed on save.
 */

import { recoveryTrace } from "../telemetry/recovery-trace.ts";
import { bus }           from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistributedCheckpoint {
  runId:         string;
  projectId:     number;
  phase:         string;
  waveIdx:       number;
  completedNodes: string[];
  failedNodes:   string[];
  metadata:      Record<string, unknown>;
  savedAt:       number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_CHECKPOINTS_PER_RUN = 10;

// ── Store ────────────────────────────────────────────────────────────────────

class DistributedCheckpointStore {
  /** runId → ring buffer of checkpoints */
  private readonly store = new Map<string, DistributedCheckpoint[]>();

  /** Save a checkpoint for a run. Evicts oldest if ring buffer is full. */
  save(checkpoint: DistributedCheckpoint): void {
    const existing = this.store.get(checkpoint.runId) ?? [];

    if (existing.length >= MAX_CHECKPOINTS_PER_RUN) {
      existing.shift(); // evict oldest
    }

    existing.push(checkpoint);
    this.store.set(checkpoint.runId, existing);

    bus.emit("agent.event", {
      runId:     checkpoint.runId,
      projectId: checkpoint.projectId,
      phase:     "distributed.checkpoint",
      agentName: "distributed-checkpoint",
      eventType: "agent.completed",
      payload:   { phase: checkpoint.phase, waveIdx: checkpoint.waveIdx, completedNodes: checkpoint.completedNodes.length },
      ts:        Date.now(),
    });
  }

  /** Get the most recent checkpoint for a run. */
  latest(runId: string): DistributedCheckpoint | null {
    const checkpoints = this.store.get(runId) ?? [];
    return checkpoints[checkpoints.length - 1] ?? null;
  }

  /** Restore from checkpoint — emits telemetry. */
  restore(runId: string, projectId: number, phase?: string): DistributedCheckpoint | null {
    const checkpoints = this.store.get(runId) ?? [];
    const checkpoint  = phase
      ? checkpoints.findLast(c => c.phase === phase)
      : checkpoints[checkpoints.length - 1];

    if (!checkpoint) return null;

    recoveryTrace.checkpointRestore(runId, `${runId}:${checkpoint.waveIdx}`, checkpoint.phase);

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.recovery",
      agentName: "distributed-checkpoint",
      eventType: "distributed.recovery",
      payload:   { restoredPhase: checkpoint.phase, waveIdx: checkpoint.waveIdx, type: "checkpoint_restore" },
      ts:        Date.now(),
    });

    return checkpoint;
  }

  /** Clear all checkpoints for a run (called after successful completion). */
  clear(runId: string): void {
    this.store.delete(runId);
  }

  allRuns(): string[] {
    return [...this.store.keys()];
  }
}

export const distributedCheckpointStore = new DistributedCheckpointStore();
