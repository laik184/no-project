/**
 * server/infrastructure/runtime/restart/runtime-restart-coordinator.ts
 *
 * Orchestrates the complete post-recovery auto-restart lifecycle:
 *
 *   acquireLock
 *   → runtimeManager.start()
 *   → waitForPort()
 *   → verifyStartup()
 *   → preview.lifecycle: restarting → starting → verifying → ready
 *   → emit runtime.observation (healthy)
 *   → releaseLock
 *
 * Single responsibility: restart orchestration.
 * No recovery logic. No rollback. Only what happens AFTER recovery succeeds.
 */

import { runtimeManager }        from "../runtime-manager.ts";
import { getLifecycleManager }   from "../../../preview/lifecycle/preview-lifecycle.manager.ts";
import { waitForPort }           from "./wait-for-port.ts";
import { verifyStartup }         from "../../../runtime/verification/startup-verifier.ts";
import {
  acquireRestartLock,
  releaseRestartLock,
}                                from "./restart-state-tracker.ts";
import { bus }                   from "../../events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const WAIT_PORT_TIMEOUT_MS = 30_000;

// ── Telemetry helper ──────────────────────────────────────────────────────────

function emit(
  event:     string,
  projectId: number,
  runId:     string | undefined,
  extra:     Record<string, unknown> = {},
): void {
  bus.emit("restart.telemetry" as any, {
    event, projectId, runId, ts: Date.now(), ...extra,
  });
}

// ── Coordinator ───────────────────────────────────────────────────────────────

export interface RestartResult {
  success: boolean;
  reason?: string;
}

/**
 * Execute the full auto-restart sequence for a project after crash recovery.
 * Safe to call from any event handler — acquires mutex internally.
 */
export async function coordinateRestart(
  projectId: number,
  runId?:    string,
): Promise<RestartResult> {
  const lock = acquireRestartLock(projectId);
  if (!lock.acquired) {
    emit("restart.blocked", projectId, runId, { reason: lock.reason });
    console.warn(`[restart-coordinator] Blocked for project ${projectId}: ${lock.reason}`);
    return { success: false, reason: lock.reason };
  }

  const preview = getLifecycleManager(projectId);
  let   success = false;

  try {
    emit("restart.started", projectId, runId);
    preview.forceTransition("restarting", "Crash recovery complete — restarting runtime…");

    // ── Step 1: Start the runtime ─────────────────────────────────────────────
    const startResult = await runtimeManager.start(projectId);

    if (!startResult.ok) {
      const reason = startResult.error ?? "runtimeManager.start() returned ok=false";
      emit("restart.failed", projectId, runId, { reason, step: "start" });
      preview.forceTransition("crashed", `Restart failed: ${reason}`);
      return { success: false, reason };
    }

    const port = startResult.port;
    if (!port) {
      emit("restart.failed", projectId, runId, { reason: "no port allocated", step: "start" });
      preview.forceTransition("crashed", "Restart failed: runtime started but no port was allocated.");
      return { success: false, reason: "no port allocated" };
    }

    preview.forceTransition("starting", `Runtime started (pid=${startResult.pid}) — waiting for port ${port}…`);
    emit("restart.retry", projectId, runId, { port, pid: startResult.pid });

    // ── Step 2: Wait for port ─────────────────────────────────────────────────
    const portResult = await waitForPort(port, projectId, runId, WAIT_PORT_TIMEOUT_MS);

    if (!portResult.reachable) {
      emit("restart.timeout", projectId, runId, { port, elapsedMs: portResult.elapsedMs });
      preview.forceTransition(
        "crashed",
        `Restart timed out — port ${port} never became reachable (${portResult.elapsedMs}ms).`,
      );
      return { success: false, reason: portResult.error };
    }

    preview.forceTransition("verifying", `Port ${port} reachable — verifying server health…`);

    // ── Step 3: Verify startup health ─────────────────────────────────────────
    const verification = await verifyStartup(projectId, port);

    if (verification.outcome === "failed") {
      emit("restart.failed", projectId, runId, {
        reason: "startup verification failed",
        outcome: verification.outcome,
        step: "verify",
      });
      preview.forceTransition("crashed", `Server unhealthy after restart: ${verification.llmSummary}`);
      return { success: false, reason: "startup verification failed" };
    }

    // ── Step 4: Sync RuntimeStore + push to clients ───────────────────────────
    bus.emit("runtime.observation" as any, {
      projectId,
      status:      "healthy",
      port,
      recentErrors: [],
      ts:           Date.now(),
    });

    preview.forceTransition(
      "ready",
      `Runtime fully restored — serving on port ${port} (${verification.outcome}).`,
    );

    emit("restart.completed", projectId, runId, {
      port,
      pid:                startResult.pid,
      verificationOutcome: verification.outcome,
      waitElapsedMs:       portResult.elapsedMs,
    });

    console.log(
      `[restart-coordinator] Project ${projectId} auto-restarted ` +
      `— port=${port} outcome=${verification.outcome}`,
    );

    success = true;
    return { success: true };

  } catch (err: any) {
    const reason = err instanceof Error ? err.message : String(err);
    emit("restart.failed", projectId, runId, { reason, step: "unexpected" });
    preview.forceTransition("crashed", `Restart error: ${reason}`);
    console.error(`[restart-coordinator] Unexpected error for project ${projectId}:`, reason);
    return { success: false, reason };

  } finally {
    releaseRestartLock(projectId, success);
  }
}
