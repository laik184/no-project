/**
 * coordination-bridge.ts
 * Coordination agent was removed — inlined as no-op stubs.
 */

import { emitAgentCoordination }  from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }       from "../telemetry/orchestration-metrics.ts";
import type { BridgeResult }      from "../core/orchestration-types.ts";

export interface CoordinationInitInput   { runId: string; projectId: number; }
export interface GateRequest             { runId: string; projectId: number; nodeId: string; dependsOn: string[]; }
export interface GateResult              { nodeId: string; decision: "allow" | "block" | "hold"; reason: string; }
export interface CoordinationGateInput extends GateRequest { maxWaitMs?: number; }
export interface CoordinationSyncRequest { runId: string; projectId: number; nodeId: string; status: "completed" | "failed"; output?: string; }
export interface CoordinationRunState    { runId: string; projectId: number; activeCount: number; completedCount: number; failedCount: number; activeNodes: string[]; completedNodes: string[]; failedNodes: string[]; }

const _states = new Map<string, CoordinationRunState>();

class CoordinationBridge {
  init(input: CoordinationInitInput): BridgeResult<void> {
    _states.set(input.runId, { ...input, activeCount: 0, completedCount: 0, failedCount: 0, activeNodes: [], completedNodes: [], failedNodes: [] });
    emitAgentCoordination({ ...input, agentName: "coordination-agent", role: "coordination", outcome: "success", phase: "execute" });
    return { success: true, durationMs: 0, retryable: false };
  }

  async gate(input: CoordinationGateInput): Promise<BridgeResult<GateResult>> {
    const t0     = Date.now();
    const spanId = recordSpanStart(input.runId, "coordination.gate", { nodeId: input.nodeId, deps: input.dependsOn.join(",") });
    incrementCounter("coordination.gate.allowed", { projectId: String(input.projectId) });
    recordSpanEnd(spanId, "ok");
    return { success: true, data: { nodeId: input.nodeId, decision: "allow", reason: "stub" }, durationMs: Date.now() - t0, retryable: false };
  }

  sync(req: CoordinationSyncRequest): BridgeResult<void> {
    const s = _states.get(req.runId);
    if (s) {
      if (req.status === "completed") { s.completedNodes.push(req.nodeId); s.completedCount++; }
      else                           { s.failedNodes.push(req.nodeId);    s.failedCount++;    }
    }
    return { success: true, durationMs: 0, retryable: false };
  }

  getState(runId: string): BridgeResult<CoordinationRunState | null> {
    return { success: true, data: _states.get(runId) ?? null, durationMs: 0, retryable: false };
  }

  finalize(runId: string, _projectId: number): BridgeResult<void> {
    _states.delete(runId);
    return { success: true, durationMs: 0, retryable: false };
  }
}

export const coordinationBridge = new CoordinationBridge();
