/**
 * server/agents/coordination/coordination-agent.ts — STUB
 * Coordination agent was removed.
 */

import type { GateRequest, GateResult, CoordinationSyncRequest } from "./types.ts";

const _runStates = new Map<string, { activeCount: number; completedCount: number; failedCount: number; activeNodes: string[]; completedNodes: string[]; failedNodes: string[] }>();

export function initRun(runId: string, _projectId: number): void {
  _runStates.set(runId, { activeCount: 0, completedCount: 0, failedCount: 0, activeNodes: [], completedNodes: [], failedNodes: [] });
}

export async function requestGate(req: GateRequest): Promise<GateResult> {
  return { nodeId: req.nodeId, decision: "allow", reason: "stub — always allow" };
}

export function syncAgentStatus(req: CoordinationSyncRequest): void {
  const state = _runStates.get(req.runId);
  if (!state) return;
  if (req.status === "completed") {
    state.completedNodes.push(req.nodeId);
    state.completedCount++;
  } else {
    state.failedNodes.push(req.nodeId);
    state.failedCount++;
  }
}

export function getRunState(runId: string) {
  return _runStates.get(runId) ?? null;
}

export function finalizeRun(runId: string, _projectId: number): void {
  _runStates.delete(runId);
}
