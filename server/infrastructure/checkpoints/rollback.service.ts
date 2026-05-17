/**
 * rollback.service.ts
 * Orchestrates rollback of a project to a checkpoint.
 * Strategy: git reset --hard (primary) → snapshot restore (fallback).
 */

import { getProjectDir }        from "../sandbox/sandbox.util.ts";
import { gitResetToSha }        from "./git-checkpoint.service.ts";
import { restoreSnapshot, snapshotExists } from "./snapshot.service.ts";
import { checkpointStore }      from "./checkpoint.service.ts";
import {
  emitRollbackStarted,
  emitRollbackCompleted,
} from "./checkpoint.events.ts";
import type { RollbackOptions, RollbackResult } from "./checkpoint.types.ts";

// ─── Main rollback entry point ────────────────────────────────────────────────

export async function rollbackToCheckpoint(
  opts: RollbackOptions,
): Promise<RollbackResult> {
  const { checkpointId, projectId, sandboxRoot } = opts;

  emitRollbackStarted(checkpointId, projectId);

  const meta = await checkpointStore.get(projectId, checkpointId);
  if (!meta) {
    const result: RollbackResult = {
      success:       false,
      checkpointId,
      restoredFiles: [],
      skippedFiles:  [],
      error:         `Checkpoint ${checkpointId} not found for project ${projectId}`,
    };
    emitRollbackCompleted(result, projectId);
    return result;
  }

  // ── Strategy 1: git reset --hard ──────────────────────────────────────────
  if (meta.gitCommitSha) {
    const gitOk = await gitResetToSha(sandboxRoot, meta.gitCommitSha);
    if (gitOk) {
      await checkpointStore.markRolledBack(projectId, checkpointId);
      const result: RollbackResult = {
        success:       true,
        checkpointId,
        restoredFiles: ["[git reset --hard applied]"],
        skippedFiles:  [],
        gitResetSha:   meta.gitCommitSha,
      };
      emitRollbackCompleted(result, projectId);
      return result;
    }
    console.warn(`[rollback] git reset failed for ${checkpointId} — falling back to snapshot`);
  }

  // ── Strategy 2: file snapshot restore ────────────────────────────────────
  const hasSnapshot = await snapshotExists(projectId, checkpointId);
  if (!hasSnapshot) {
    const result: RollbackResult = {
      success:       false,
      checkpointId,
      restoredFiles: [],
      skippedFiles:  [],
      error:         "No git SHA and no file snapshot available for this checkpoint",
    };
    emitRollbackCompleted(result, projectId);
    return result;
  }

  const { restored, failed } = await restoreSnapshot(projectId, checkpointId, sandboxRoot);
  await checkpointStore.markRolledBack(projectId, checkpointId);

  const result: RollbackResult = {
    success:       failed.length === 0,
    checkpointId,
    restoredFiles: restored,
    skippedFiles:  failed,
    error:         failed.length > 0 ? `${failed.length} files failed to restore` : undefined,
  };
  emitRollbackCompleted(result, projectId);
  return result;
}

// ─── Convenience: rollback latest checkpoint for a project/run ────────────────

export async function rollbackLatestForRun(
  runId:    string,
  projectId: number,
): Promise<RollbackResult | null> {
  const sandboxRoot = getProjectDir(projectId);
  const all         = await checkpointStore.listForProject(projectId);
  const forRun      = all.filter((m) => m.runId === runId && m.status === "stable");
  if (forRun.length === 0) return null;

  const latest = forRun.sort((a, b) => b.createdAt - a.createdAt)[0];
  return rollbackToCheckpoint({
    checkpointId: latest.checkpointId,
    projectId,
    sandboxRoot,
    scope: "full_run",
  });
}

export async function rollbackLatestForProject(
  projectId: number,
): Promise<RollbackResult | null> {
  const sandboxRoot = getProjectDir(projectId);
  const all         = await checkpointStore.listForProject(projectId);
  const stable      = all.filter((m) => m.status === "stable");
  if (stable.length === 0) return null;

  const latest = stable.sort((a, b) => b.createdAt - a.createdAt)[0];
  return rollbackToCheckpoint({
    checkpointId: latest.checkpointId,
    projectId,
    sandboxRoot,
    scope: "full_run",
  });
}
