/**
 * lifecycle-events.ts — Bridges state machine events → infrastructure bus.
 * Wires stateMachine listeners to bus + sseManager.
 */

import { bus, sseManager, TOPIC } from "../../infrastructure/index.ts";
import { stateMachine }           from "./lifecycle-state-machine.ts";
import type { PreviewLifecycleEvent } from "../events/preview-events.ts";

let _initialized = false;

export function initLifecycleEvents(): void {
  if (_initialized) return;
  _initialized = true;

  // ── State machine → SSE broadcast ─────────────────────────────────────────
  stateMachine.on((event: PreviewLifecycleEvent) => {
    // Publish on bus so other modules can subscribe
    bus.emit("preview.lifecycle" as never, event as never);

    // Fan out to SSE clients subscribed to TOPIC.PREVIEW_LIFECYCLE
    sseManager.publish(TOPIC.PREVIEW_LIFECYCLE, event, event.projectId);
  });

  // ── Bus: process crashed → trigger crashed state ───────────────────────────
  bus.on("process.crashed", async (payload) => {
    const projectId = (payload as Record<string, unknown>).projectId as number | undefined;
    const code      = (payload as Record<string, unknown>).code      as number | undefined;
    if (projectId == null) return;

    await stateMachine.transition(
      projectId, "crashed",
      `Process exited with code ${code ?? "?"}.`,
      { exitCode: code },
    ).catch(console.error);
  });

  console.log("[lifecycle-events] Initialized.");
}
