/**
 * server/infrastructure/recovery/recovery-restart-bridge.ts
 *
 * Bridges crash recovery completion → autonomous runtime restart.
 *
 * Listens for the "checkpoint.event" bus event with
 * eventType === "crash_recovery_ok" — this is the signal emitted by
 * crash-recovery.ts after a successful file rollback.
 *
 * On receipt it calls the RuntimeRestartCoordinator, which owns
 * the full restart lifecycle (start → waitForPort → verify → ready).
 *
 * Single responsibility: translate recovery-ok → restart trigger.
 * No recovery logic. No restart logic. Only the bridge.
 */

import { bus }                from "../events/bus.ts";
import { coordinateRestart }  from "../runtime/restart/runtime-restart-coordinator.ts";

let _initialized = false;

/**
 * Wire the recovery→restart bridge onto the event bus.
 * Idempotent — safe to call multiple times.
 */
export function initRecoveryRestartBridge(): void {
  if (_initialized) return;
  _initialized = true;

  bus.on("checkpoint.event", async (e: any) => {
    if (e?.eventType !== "crash_recovery_ok") return;

    const projectId: number | undefined = e?.projectId;
    const runId:     string | undefined = e?.runId;

    if (!projectId) {
      console.warn("[recovery-restart-bridge] crash_recovery_ok received with no projectId — skipped");
      return;
    }

    console.log(
      `[recovery-restart-bridge] Crash recovery OK for project ${projectId} ` +
      `— triggering autonomous restart`,
    );

    await coordinateRestart(projectId, runId);
  });

  console.log("[recovery-restart-bridge] Initialized — autonomous restart wired to crash recovery");
}
