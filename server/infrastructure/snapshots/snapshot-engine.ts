/**
 * snapshot-engine.ts
 * High-level snapshot orchestration.
 * Coordinates file snapshot + runtime snapshot into a single atomic operation.
 * Acts as the single entry point for anything that needs a full system snapshot.
 */

import { captureSnapshot, restoreSnapshot, listSnapshots } from "../checkpoints/snapshot.service.ts";
import { captureRuntimeSnapshot, prepareRuntimeForRollback } from "../recovery/runtime-recovery.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FullSnapshot {
  checkpointId:   string;
  projectId:      number;
  capturedAt:     number;
  fileCount:      number;
  budgetExceeded: boolean;
  runtimeCaptured: boolean;
  runtimeStatus:  string;
  runtimePort:    number | null;
}

export interface FullRestoreResult {
  checkpointId:    string;
  filesRestored:   string[];
  filesFailed:     string[];
  runtimeStopped:  boolean;
  previousRuntime: unknown;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Capture a complete system snapshot:
 *  1. File snapshot of the sandbox
 *  2. Runtime state (port, PID, status, logs)
 *
 * All errors are isolated — a runtime capture failure won't abort the file snapshot.
 */
export async function captureFullSnapshot(
  projectId:    number,
  checkpointId: string,
  sandboxRoot:  string,
): Promise<FullSnapshot> {
  const [fileResult, runtimeSnap] = await Promise.allSettled([
    captureSnapshot(projectId, checkpointId, sandboxRoot),
    captureRuntimeSnapshot(projectId, checkpointId),
  ]);

  const fileData = fileResult.status === "fulfilled"
    ? fileResult.value
    : { fileCount: 0, skipped: false };

  const rtData = runtimeSnap.status === "fulfilled"
    ? runtimeSnap.value
    : null;

  return {
    checkpointId,
    projectId,
    capturedAt:      Date.now(),
    fileCount:       fileData.fileCount,
    budgetExceeded:  fileData.skipped,
    runtimeCaptured: rtData !== null,
    runtimeStatus:   rtData?.status    ?? "unknown",
    runtimePort:     rtData?.port      ?? null,
  };
}

// ─── Restore ──────────────────────────────────────────────────────────────────

/**
 * Restore a full snapshot:
 *  1. Stop the running server (if any) to prevent write conflicts
 *  2. Restore all captured files atomically
 *  3. Return previous runtime state for the caller to restart if desired
 */
export async function restoreFullSnapshot(
  projectId:    number,
  checkpointId: string,
  sandboxRoot:  string,
): Promise<FullRestoreResult> {
  // Stop runtime first to avoid write conflicts
  const { stopped, previousSnapshot } = await prepareRuntimeForRollback(
    projectId, checkpointId,
  );

  const { restored, failed } = await restoreSnapshot(
    projectId, checkpointId, sandboxRoot,
  );

  return {
    checkpointId,
    filesRestored:   restored,
    filesFailed:     failed,
    runtimeStopped:  stopped,
    previousRuntime: previousSnapshot,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listAllSnapshots(projectId: number): Promise<string[]> {
  return listSnapshots(projectId);
}
