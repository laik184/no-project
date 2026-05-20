/**
 * crash-responder.ts
 *
 * Autonomous recovery trigger — subscribes to "process.crashed" bus events
 * and delegates to the debug-orchestrator for self-healing.
 *
 * This module is the thin bus listener.  All recovery logic lives in:
 *   server/agents/autonomous-debug/core/debug-orchestrator.ts
 *
 * Guards:
 *   - Skips if OPENROUTER_API_KEY is absent (no LLM available)
 *   - Delegates cooldown + attempt tracking to the orchestrator
 *
 * Exposed API matches the original so main.ts needs no changes:
 *   crashResponder.start()
 *   crashResponder.stop()
 *   crashResponder.resetProject(projectId)
 *   crashResponder.getState(projectId)
 */

import { bus, type AgentEvent }                            from "../../infrastructure/events/bus.ts";
import { handleCrash, resetProject, getOrchestratorState } from "../../debug/index.ts";

// ─── Bus subscriber ───────────────────────────────────────────────────────────

function onAgentEvent(event: AgentEvent): void {
  if (event.eventType !== "process.crashed") return;
  if (!event.projectId) return;
  if (!process.env.OPENROUTER_API_KEY && !process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY) return;

  handleCrash(event.projectId, event.payload).catch((err) =>
    console.error(`[crash-responder] unhandled error: ${err?.message}`)
  );
}

// ─── Singleton API ────────────────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

export const crashResponder = {
  start(): void {
    if (unsubscribe) return;
    unsubscribe = bus.subscribe("agent.event", onAgentEvent);
    console.log("[crash-responder] Started — listening for process.crashed events");
  },

  stop(): void {
    unsubscribe?.();
    unsubscribe = null;
  },

  /** Reset counters for a project (call when user manually re-deploys). */
  resetProject(projectId: number): void {
    resetProject(projectId);
  },

  /** Expose state for health/admin endpoints. */
  getState(projectId: number) {
    return getOrchestratorState(projectId);
  },
};
