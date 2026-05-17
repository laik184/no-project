/**
 * recovery-manager.ts
 * Central recovery coordinator.
 *
 * Single entry point for ALL recovery operations. Enforces:
 *  - Recovery locks (no double-recovery per project)
 *  - Timeout guards (recovery cannot run forever)
 *  - Consecutive failure limits (circuit breaker)
 *  - Structured audit trail (bus events)
 *
 * Architecture: thin coordinator — delegates to crash-recovery and
 * rollback/restore services. Does NOT implement recovery logic itself.
 */

import {
  acquireRecoveryLock,
  releaseRecoveryLock,
  resetRecoveryState,
  getLockDiagnostics,
  isLocked,
} from "./recovery-lock.ts";
import { executeCrashRecovery }    from "./crash-recovery.ts";
import { rollbackLatestForRun, rollbackLatestForProject } from "../checkpoints/rollback.service.ts";
import { checkpointStore }         from "../checkpoints/checkpoint.service.ts";
import { getProjectDir }           from "../sandbox/sandbox.util.ts";
import { bus }                     from "../events/bus.ts";
import type { CrashRecoveryResult } from "./crash-recovery.ts";
import type { RollbackResult }      from "../checkpoints/checkpoint.types.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const RECOVERY_TIMEOUT_MS = 45_000; // 45 s hard ceiling for any recovery operation

// ─── Internal: timeout wrapper ────────────────────────────────────────────────

function withTimeout<T>(
  promise:   Promise<T>,
  ms:        number,
  label:     string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Recovery timed out after ${ms}ms: ${label}`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Trigger crash recovery for a project.
 * Acquires the recovery lock, runs recovery with a timeout, then releases.
 */
export async function recoverFromCrash(opts: {
  projectId: number;
  runId?:    string;
  reason:    string;
  crashData?: unknown;
}): Promise<CrashRecoveryResult | { skipped: true; reason: string }> {
  const { projectId } = opts;

  const lock = acquireRecoveryLock(projectId);
  if (!lock.acquired) {
    console.warn(`[recovery-manager] Crash recovery skipped for ${projectId}: ${lock.reason}`);
    return { skipped: true, reason: lock.reason ?? "locked" };
  }

  let success = false;
  try {
    const result = await withTimeout(
      executeCrashRecovery(opts),
      RECOVERY_TIMEOUT_MS,
      `crash recovery project ${projectId}`,
    );
    success = result.success;
    return result;
  } catch (err: any) {
    console.error(`[recovery-manager] Recovery error for project ${projectId}:`, err.message);
    bus.emit("checkpoint.event", {
      eventType: "crash_recovery_failed",
      projectId,
      error:     err.message,
      reason:    opts.reason,
      ts:        Date.now(),
    });
    return {
      attempted: true, success: false, projectId,
      checkpointId: null, rollback: null,
      reason: opts.reason, error: err.message,
    } as CrashRecoveryResult;
  } finally {
    releaseRecoveryLock(projectId, lock.token!, success);
  }
}

/**
 * Manually roll back a specific run (user-initiated undo).
 */
export async function undoRun(
  runId:     string,
  projectId: number,
): Promise<RollbackResult | { skipped: true; reason: string }> {
  const lock = acquireRecoveryLock(projectId);
  if (!lock.acquired) {
    return { skipped: true, reason: lock.reason ?? "locked" };
  }

  let success = false;
  try {
    const result = await withTimeout(
      rollbackLatestForRun(runId, projectId).then(
        (r) => r ?? {
          success: false, checkpointId: "none",
          restoredFiles: [], skippedFiles: [],
          error: "No stable run checkpoint found",
        },
      ),
      RECOVERY_TIMEOUT_MS,
      `undo run ${runId}`,
    );
    success = result.success;
    return result;
  } finally {
    releaseRecoveryLock(projectId, lock.token!, success);
  }
}

/**
 * Roll back to the last stable checkpoint (safe fallback for any failure).
 */
export async function safeRollback(
  projectId: number,
): Promise<RollbackResult | { skipped: true; reason: string }> {
  const lock = acquireRecoveryLock(projectId);
  if (!lock.acquired) {
    return { skipped: true, reason: lock.reason ?? "locked" };
  }

  let success = false;
  try {
    const result = await withTimeout(
      rollbackLatestForProject(projectId).then(
        (r) => r ?? {
          success: false, checkpointId: "none",
          restoredFiles: [], skippedFiles: [],
          error: "No stable checkpoint available",
        },
      ),
      RECOVERY_TIMEOUT_MS,
      `safe rollback project ${projectId}`,
    );
    success = (result as RollbackResult).success ?? false;
    return result;
  } finally {
    releaseRecoveryLock(projectId, lock.token!, success);
  }
}

/**
 * Validate checkpoint integrity — check that the checkpoint exists in both
 * the DB store and as a file-system snapshot (or has a git SHA).
 */
export async function validateCheckpoint(
  projectId:    number,
  checkpointId: string,
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  const meta = await checkpointStore.get(projectId, checkpointId);
  if (!meta) {
    issues.push("Checkpoint not found in store");
    return { valid: false, issues };
  }
  if (meta.status === "failed") {
    issues.push("Checkpoint has status=failed");
  }
  if (!meta.gitCommitSha && meta.fileCount === 0) {
    issues.push("No git SHA and no captured files — checkpoint is empty");
  }
  if (meta.status === "rolled_back") {
    issues.push("Checkpoint has already been rolled back");
  }

  return { valid: issues.length === 0, issues };
}

// ─── Admin / diagnostic API ───────────────────────────────────────────────────

export function resetProject(projectId: number): void {
  resetRecoveryState(projectId);
  console.log(`[recovery-manager] State reset for project ${projectId}`);
}

export function getRecoveryDiagnostics(projectId: number): object {
  return {
    projectId,
    lockState: getLockDiagnostics(projectId),
    isLocked:  isLocked(projectId),
  };
}

// ─── Startup: wire bus listeners ──────────────────────────────────────────────

let _started = false;

/**
 * Start the recovery manager — subscribes to run.lifecycle failed events.
 * Safe to call multiple times (idempotent).
 */
export function startRecoveryManager(): void {
  if (_started) return;
  _started = true;

  bus.on("run.lifecycle", async (event) => {
    if (event.status !== "failed") return;

    // Only auto-recover if there are stable checkpoints
    const all    = await checkpointStore.listForProject(event.projectId);
    const stable = all.filter((m) => m.status === "stable");
    if (stable.length === 0) return;

    await recoverFromCrash({
      projectId: event.projectId,
      runId:     event.runId,
      reason:    "run.lifecycle failed — auto recovery",
    });
  });

  console.log("[recovery-manager] Started — listening for run.lifecycle failed events");
}
