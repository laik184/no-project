/**
 * server/engine/reflection/reflection-engine-wiring.ts
 *
 * Bus wiring for the Reflection Engine.
 *
 * Separated from reflection-engine.ts so the core triggerReflection
 * function stays under 250 lines.  This module owns:
 *   - startReflectionEngine()  — called once at startup
 *   - markReflectionSuccess()  — called when process starts healthy
 *
 * Consumers:
 *   - main.ts                    → startReflectionEngine()
 *   - tool-loop.executor.ts      → markReflectionSuccess()
 */

import { bus }               from "../../infrastructure/events/bus.ts";
import { resetGuard }        from "./retry-guard.ts";
import { triggerReflection } from "./reflection-engine.ts";

let _wired = false;

/**
 * Wire the reflection engine to runtime crash and failure bus events.
 * Call once at startup. Idempotent.
 */
export function startReflectionEngine(): void {
  if (_wired) return;
  _wired = true;

  // Trigger on process.crashed
  bus.subscribe("agent.event", (ev) => {
    if (ev.eventType !== "process.crashed") return;
    if (!ev.projectId) return;

    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    triggerReflection({
      projectId: ev.projectId,
      runId:     ev.runId ?? `reflection-${ev.projectId}-${Date.now()}`,
      trigger:   "crash",
      details:   payload,
    }).catch((err) => {
      console.error(`[reflection-engine] Unhandled error on crash trigger:`, err?.message);
    });
  });

  // Trigger on run.lifecycle failed
  bus.on("run.lifecycle", (ev) => {
    if (ev.status !== "failed") return;

    triggerReflection({
      projectId: ev.projectId,
      runId:     ev.runId ?? `reflection-${ev.projectId}-${Date.now()}`,
      trigger:   "verify_fail",
      details:   { lifecycleStatus: ev.status },
    }).catch((err) => {
      console.error(`[reflection-engine] Unhandled error on lifecycle trigger:`, err?.message);
    });
  });

  console.log("[reflection-engine] Initialized — wired to process.crashed + run.lifecycle failed");
}

/**
 * Mark a reflection cycle as successful (process started healthy after reflection).
 * Resets the retry-guard so subsequent failures get fresh retry budget.
 */
export function markReflectionSuccess(projectId: number): void {
  resetGuard(projectId);
}
