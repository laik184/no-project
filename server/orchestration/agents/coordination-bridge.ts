/**
 * coordination-bridge.ts
 *
 * Typed bridge between the orchestration engine and the CoordinationAgent.
 * Provides execution gating, dependency tracking, and inter-agent sync
 * primitives to the orchestration layer.
 */

import {
  initRun,
  requestGate,
  syncAgentStatus,
  getRunState,
  finalizeRun,
}                                 from "../../agents/coordination/coordination-agent.ts";
import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }       from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";
import type {
  GateRequest,
  GateResult,
  CoordinationSyncRequest,
} from "../../agents/coordination/types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoordinationInitInput {
  runId:     string;
  projectId: number;
}

export interface CoordinationGateInput extends GateRequest {
  maxWaitMs?: number;
}

export interface CoordinationRunState {
  runId:          string;
  projectId:      number;
  activeCount:    number;
  completedCount: number;
  failedCount:    number;
  activeNodes:    string[];
  completedNodes: string[];
  failedNodes:    string[];
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class CoordinationBridge {
  /** Initialize coordination tracking for a new run. */
  init(input: CoordinationInitInput): BridgeResult<void> {
    const { runId, projectId } = input;
    try {
      initRun(runId, projectId);
      emitAgentCoordination({
        runId, projectId,
        agentName: "coordination-agent",
        role:      "coordination",
        outcome:   "success",
        phase:     "execute",
      });
      return { success: true, durationMs: 0, retryable: false };
    } catch (err) {
      return {
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        durationMs: 0,
        retryable:  false,
      };
    }
  }

  /** Request a gate — awaits until dependencies are met or times out. */
  async gate(input: CoordinationGateInput): Promise<BridgeResult<GateResult>> {
    const { runId, projectId } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "coordination.gate", {
      nodeId: input.nodeId,
      deps:   input.dependsOn.join(","),
    });

    try {
      const result = await requestGate(input);
      const allowed = result.decision === "allow";

      incrementCounter(
        allowed ? "coordination.gate.allowed" : "coordination.gate.blocked",
        { projectId: String(projectId) },
      );
      recordSpanEnd(spanId, allowed ? "ok" : "error");

      return {
        success:    allowed,
        data:       result,
        durationMs: Date.now() - t0,
        retryable:  result.decision === "hold",
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  /** Sync completion/failure status for a node. */
  sync(req: CoordinationSyncRequest): BridgeResult<void> {
    try {
      syncAgentStatus(req);
      return { success: true, durationMs: 0, retryable: false };
    } catch (err) {
      return {
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        durationMs: 0,
        retryable:  false,
      };
    }
  }

  /** Get a snapshot of coordination state for a run. */
  getState(runId: string): BridgeResult<CoordinationRunState | null> {
    try {
      const state = getRunState(runId);
      return { success: true, data: state, durationMs: 0, retryable: false };
    } catch (err) {
      return {
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        durationMs: 0,
        retryable:  false,
      };
    }
  }

  /** Finalize and clean up coordination state for a run. */
  finalize(runId: string, projectId: number): BridgeResult<void> {
    try {
      finalizeRun(runId, projectId);
      return { success: true, durationMs: 0, retryable: false };
    } catch (err) {
      return {
        success:    false,
        error:      err instanceof Error ? err.message : String(err),
        durationMs: 0,
        retryable:  false,
      };
    }
  }
}

export const coordinationBridge = new CoordinationBridge();
