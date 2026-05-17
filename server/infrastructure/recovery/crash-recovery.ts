/**
 * crash-recovery.ts
 * Checkpoint-aware crash recovery.
 * Integrates the recovery lock, runtime stop, and rollback pipeline
 * so that crashes trigger a structured, guarded recovery — not an
 * uncoordinated file restore that could make things worse.
 *
 * Called by the recovery manager; NOT called directly from bus listeners.
 */

import { getProjectDir }             from "../sandbox/sandbox.util.ts";
import { checkpointStore }           from "../checkpoints/checkpoint.service.ts";
import { rollbackToCheckpoint }      from "../checkpoints/rollback.service.ts";
import { prepareRuntimeForRollback } from "./runtime-recovery.ts";
import { bus }                       from "../events/bus.ts";
import type { RollbackResult }       from "../checkpoints/checkpoint.types.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrashRecoveryInput {
  projectId:  number;
  runId?:     string;
  reason:     string;
  crashData?: unknown;
}

export interface CrashRecoveryResult {
  attempted:    boolean;
  success:      boolean;
  projectId:    number;
  checkpointId: string | null;
  rollback:     RollbackResult | null;
  reason:       string;
  error?:       string;
}

// ─── Strategy: find best rollback target ──────────────────────────────────────

/**
 * Picks the best stable checkpoint to roll back to.
 * Priority:
 *  1. Most recent "run_start" checkpoint for the crashed run
 *  2. Most recent stable checkpoint for the project
 */
async function selectRollbackTarget(
  projectId: number,
  runId?:    string,
): Promise<string | null> {
  const all    = await checkpointStore.listForProject(projectId);
  const stable = all.filter((m) => m.status === "stable");
  if (stable.length === 0) return null;

  // Prefer pre-run checkpoint for this specific run
  if (runId) {
    const forRun = stable
      .filter((m) => m.runId === runId && m.trigger === "run_start")
      .sort((a, b) => a.createdAt - b.createdAt);
    if (forRun.length > 0) return forRun[0].checkpointId;
  }

  // Fall back to most recent stable checkpoint
  return stable.sort((a, b) => b.createdAt - a.createdAt)[0].checkpointId;
}

// ─── Main crash recovery ──────────────────────────────────────────────────────

/**
 * Execute crash recovery for a project.
 * Caller MUST hold the recovery lock before calling this.
 * Returns a structured result — does not throw.
 */
export async function executeCrashRecovery(
  input: CrashRecoveryInput,
): Promise<CrashRecoveryResult> {
  const { projectId, runId, reason } = input;
  const sandboxRoot = getProjectDir(projectId);

  console.log(`[crash-recovery] Starting recovery for project ${projectId} — ${reason}`);

  // ── 1. Find rollback target ───────────────────────────────────────────────
  const checkpointId = await selectRollbackTarget(projectId, runId);
  if (!checkpointId) {
    const result: CrashRecoveryResult = {
      attempted:    true,
      success:      false,
      projectId,
      checkpointId: null,
      rollback:     null,
      reason,
      error:        "No stable checkpoint available — cannot recover",
    };
    emitCrashRecoveryEvent(result);
    return result;
  }

  // ── 2. Stop runtime to prevent write conflicts ────────────────────────────
  await prepareRuntimeForRollback(projectId, checkpointId);

  // ── 3. Execute rollback ───────────────────────────────────────────────────
  const rollback = await rollbackToCheckpoint({
    checkpointId,
    projectId,
    sandboxRoot,
    scope: "full_run",
  });

  const result: CrashRecoveryResult = {
    attempted:    true,
    success:      rollback.success,
    projectId,
    checkpointId,
    rollback,
    reason,
    error:        rollback.error,
  };

  emitCrashRecoveryEvent(result);

  if (rollback.success) {
    console.log(`[crash-recovery] Project ${projectId} recovered to checkpoint ${checkpointId}`);
  } else {
    console.error(`[crash-recovery] Recovery failed for project ${projectId}: ${rollback.error}`);
  }

  return result;
}

// ─── Event emission ───────────────────────────────────────────────────────────

function emitCrashRecoveryEvent(result: CrashRecoveryResult): void {
  bus.emit("checkpoint.event", {
    eventType:    result.success ? "crash_recovery_ok" : "crash_recovery_failed",
    projectId:    result.projectId,
    checkpointId: result.checkpointId ?? undefined,
    success:      result.success,
    reason:       result.reason,
    error:        result.error,
    ts:           Date.now(),
  });
}
