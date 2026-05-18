/**
 * restore/emergency-recovery.service.ts
 * Emergency auto-recovery — triggered when a run crashes or the runtime
 * reports a critical failure. Automatically rolls back to the last stable
 * checkpoint and emits a recovery event on the bus.
 */

import { bus }                      from "../../events/bus.ts";
import { getProjectDir }            from "../../sandbox/sandbox.util.ts";
import { checkpointStore }          from "../checkpoint.service.ts";
import { rollbackLatestForProject } from "../rollback.service.ts";

export interface RecoveryResult {
  triggered:    boolean;
  projectId:    number;
  runId?:       string;
  checkpointId: string | null;
  success:      boolean;
  reason:       string;
}

/**
 * Attempt automatic emergency recovery for a project.
 * Called by the crash responder or verification engine on critical failure.
 */
export async function triggerEmergencyRecovery(
  projectId: number,
  runId?:    string,
  reason?:   string,
): Promise<RecoveryResult> {
  console.warn(`[emergency-recovery] Triggered for project ${projectId} run=${runId ?? "n/a"} — ${reason ?? "unknown reason"}`);

  const result = await rollbackLatestForProject(projectId);

  const recovery: RecoveryResult = {
    triggered:    true,
    projectId,
    runId,
    checkpointId: result?.checkpointId ?? null,
    success:      result?.success ?? false,
    reason:       reason ?? "emergency",
  };

  bus.emit("checkpoint.event", {
    eventType:    "emergency_recovery",
    projectId,
    runId,
    checkpointId: result?.checkpointId ?? null,
    success:      result?.success ?? false,
    reason,
    ts:           Date.now(),
  });

  if (result?.success) {
    console.log(`[emergency-recovery] Project ${projectId} rolled back to ${result.checkpointId}`);
  } else {
    console.error(`[emergency-recovery] Rollback failed for project ${projectId}: ${result?.error}`);
  }

  return recovery;
}

/**
 * Subscribe to run.lifecycle "failed" events and auto-trigger recovery
 * for runs that opted into auto-recovery.
 */
const autoRecoveryProjects = new Set<number>();

export function enableAutoRecovery(projectId: number): void {
  autoRecoveryProjects.add(projectId);
}

export function disableAutoRecovery(projectId: number): void {
  autoRecoveryProjects.delete(projectId);
}

/** Called once at server startup to wire up the auto-recovery listener */
let _listenerStarted = false;

export function startEmergencyRecoveryListener(): void {
  if (_listenerStarted) return;
  _listenerStarted = true;

  bus.on("run.lifecycle", async (event) => {
    if (event.status !== "failed") return;
    if (!autoRecoveryProjects.has(event.projectId)) return;

    const all = await checkpointStore.listForProject(event.projectId);
    const hasStable = all.some((m) => m.status === "stable");
    if (!hasStable) return;

    await triggerEmergencyRecovery(
      event.projectId,
      event.runId,
      "run.lifecycle failed — auto-recovery",
    );
  });

  console.log("[emergency-recovery] Auto-recovery listener started");
}
