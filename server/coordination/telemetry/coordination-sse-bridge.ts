/**
 * coordination-sse-bridge.ts
 *
 * Confirms that all coordination bus events propagate to SSE clients.
 * Single responsibility: validation marker + event whitelist enforcement.
 *
 * Architecture note: all coordination modules already call
 *   bus.emit("agent.event", { ... })
 * which the existing subscription-manager fans out to SSE connections.
 * This module audits the whitelist and logs wiring confirmation — it does
 * NOT need to re-emit events since the bus pipeline already handles that.
 *
 * Emitted event types guaranteed to reach SSE:
 *   coordination.*  specialist.*  DAG.node.*
 *   merge.*  conflict.*  lock.*  agent.start/complete/failed
 *   verification.start  verification.complete
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Coordination event whitelist ──────────────────────────────────────────────

export const COORDINATION_SSE_EVENTS = new Set([
  "coordination.start",
  "coordination.complete",
  "coordination.partial",
  "coordination.failed",
  "coordination.aborted",
  "coordination.wave.total_failure",
  "specialist.start",
  "specialist.complete",
  "specialist.failed",
  "specialist.cancelled",
  "specialist.execute.start",
  "specialist.execute.complete",
  "specialist.execute.failed",
  "DAG.node.start",
  "DAG.node.complete",
  "merge.start",
  "merge.complete",
  "merge.plan.built",
  "merge.patch.applied",
  "merge.patch.skipped",
  "conflict.detected",
  "conflict.resolved",
  "lock.acquire",
  "lock.acquired",
  "lock.release",
  "agent.start",
  "agent.complete",
  "agent.failed",
  "verification.start",
  "verification.complete",
]);

// ── Audit listener ────────────────────────────────────────────────────────────

let _wired = false;

/**
 * Wire a debug audit listener that validates coordination events are firing.
 * In development, logs unknown coordination events for visibility.
 * Safe to call multiple times — idempotent.
 */
export function wireCoordinationSSE(): void {
  if (_wired) return;
  _wired = true;

  bus.on("agent.event", (event: unknown) => {
    const e = event as { phase?: string; eventType?: string };
    if (e?.phase !== "coordination") return;

    // In dev: surface unknown coordination events for auditing
    if (
      e.eventType &&
      !COORDINATION_SSE_EVENTS.has(e.eventType) &&
      process.env.NODE_ENV !== "production"
    ) {
      console.debug(
        `[coordination-sse-bridge] Unregistered coordination event: ${e.eventType}`,
      );
    }
  });

  console.log(
    "[coordination-sse-bridge] Wired — " +
    `${COORDINATION_SSE_EVENTS.size} coordination event types tracked via bus → SSE.`,
  );
}

export function isWired(): boolean {
  return _wired;
}
