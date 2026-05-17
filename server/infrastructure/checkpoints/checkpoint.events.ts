/**
 * checkpoint.events.ts
 * Emitters for checkpoint lifecycle events on the shared event bus.
 */

import { bus }            from "../events/bus.ts";
import type { CheckpointMeta, RollbackResult } from "./checkpoint.types.ts";

export function emitCheckpointCreating(meta: CheckpointMeta): void {
  bus.emit("checkpoint.event", {
    eventType: "creating",
    checkpointId: meta.checkpointId,
    projectId:    meta.projectId,
    runId:        meta.runId,
    trigger:      meta.trigger,
    ts:           Date.now(),
  });
}

export function emitCheckpointStable(meta: CheckpointMeta): void {
  bus.emit("checkpoint.event", {
    eventType:    "stable",
    checkpointId: meta.checkpointId,
    projectId:    meta.projectId,
    runId:        meta.runId,
    trigger:      meta.trigger,
    gitSha:       meta.gitCommitSha ?? undefined,
    ts:           Date.now(),
  });
}

export function emitCheckpointFailed(
  checkpointId: string,
  projectId:    number,
  error:        string,
): void {
  bus.emit("checkpoint.event", {
    eventType:    "failed",
    checkpointId,
    projectId,
    error,
    ts: Date.now(),
  });
}

export function emitRollbackStarted(
  checkpointId: string,
  projectId:    number,
  runId?:       string,
): void {
  bus.emit("checkpoint.event", {
    eventType:    "rollback_started",
    checkpointId,
    projectId,
    runId,
    ts: Date.now(),
  });
}

export function emitRollbackCompleted(
  result:    RollbackResult,
  projectId: number,
): void {
  bus.emit("checkpoint.event", {
    eventType:     "rollback_completed",
    checkpointId:  result.checkpointId,
    projectId,
    restoredCount: result.restoredFiles.length,
    success:       result.success,
    ts:            Date.now(),
  });
}
