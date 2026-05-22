/**
 * Responsibility: Final arbitration for unresolvable conflicts — routes to SupervisorAgent
 *                 consensus engine when automated resolution fails.
 * Dependencies: bus (for supervisor escalation event), distributed-trace
 * Failure: if supervisor is unavailable, defaults to "use_ancestor" (fail-closed).
 * Telemetry: emits distributed.conflict and distributed.consensus on every arbitration.
 */

import { bus }              from "../../infrastructure/events/bus.ts";
import { distributedTrace } from "../telemetry/distributed-trace.ts";
import type { WriteConflict } from "./write-conflict-detector.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArbitrationOutcome = "supervisor_decided" | "fallback_ancestor" | "timeout";

export interface ArbitrationResult {
  outcome:    ArbitrationOutcome;
  content:    string | null;
  decidedBy:  string;
  durationMs: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const ARBITRATION_TIMEOUT_MS = 10_000;

// ── Arbitrator ────────────────────────────────────────────────────────────────

class ConsensusArbitrator {
  /**
   * Escalate an irresolvable conflict to the supervisor.
   * In this implementation, the bus event triggers downstream supervisor logic.
   * If no response arrives within timeout, falls back to ancestor content.
   */
  async arbitrate(
    runId:           string,
    projectId:       number,
    conflict:        WriteConflict,
    ancestorContent: string,
  ): Promise<ArbitrationResult> {
    const t0 = Date.now();

    distributedTrace.distributedConflict(runId, conflict.path, conflict.writers.map(w => w.ownerId));

    bus.emit("agent.event", {
      runId,
      projectId,
      phase:     "distributed.conflict",
      agentName: "consensus-arbitrator",
      eventType: "distributed.conflict",
      payload:   {
        path:    conflict.path,
        writers: conflict.writers.map(w => ({ ownerId: w.ownerId, runId: w.runId })),
        reason:  "escalated_to_supervisor",
      },
      ts: t0,
    });

    // Wait for a supervisor decision via a bus reply event
    const decision = await Promise.race([
      this.waitForSupervisorDecision(runId, conflict.path),
      this.timeout(ARBITRATION_TIMEOUT_MS),
    ]);

    const durationMs = Date.now() - t0;

    if (decision === null) {
      bus.emit("agent.event", {
        runId, projectId,
        phase:     "distributed.conflict",
        agentName: "consensus-arbitrator",
        eventType: "distributed.recovery",
        payload:   { path: conflict.path, fallback: "ancestor", reason: "arbitration_timeout" },
        ts:        Date.now(),
      });
      return { outcome: "fallback_ancestor", content: ancestorContent, decidedBy: "timeout_fallback", durationMs };
    }

    return { outcome: "supervisor_decided", content: decision, decidedBy: "supervisor-agent", durationMs };
  }

  private waitForSupervisorDecision(runId: string, path: string): Promise<string | null> {
    return new Promise(resolve => {
      const handler = (event: { payload?: { runId?: string; path?: string; content?: string } }) => {
        if (event.payload?.runId === runId && event.payload?.path === path) {
          bus.off("agent.event" as any, handler);
          resolve(event.payload.content ?? null);
        }
      };
      bus.on("agent.event" as any, handler);
    });
  }

  private timeout(ms: number): Promise<null> {
    return new Promise(resolve => setTimeout(() => resolve(null), ms));
  }
}

export const consensusArbitrator = new ConsensusArbitrator();
