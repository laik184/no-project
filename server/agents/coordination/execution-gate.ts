/**
 * server/agents/coordination/execution-gate.ts
 *
 * ExecutionGate — controls which nodes are allowed to execute based on
 * dependency completion, resource locks, and concurrency constraints.
 *
 * Single responsibility: gate decisions only — no execution logic.
 */

import type { GateRequest, GateResult, GateDecision, GateReason, CoordinationState } from "./types.ts";

// ── State store ───────────────────────────────────────────────────────────────

const _states = new Map<string, CoordinationState>();   // runId → state

export function initCoordinationState(runId: string, projectId: number): void {
  if (_states.has(runId)) return;
  _states.set(runId, {
    runId,
    projectId,
    activeNodes:     new Set(),
    completedNodes:  new Set(),
    failedNodes:     new Set(),
    lockedResources: new Map(),
    ts:              Date.now(),
  });
}

export function getCoordinationState(runId: string): CoordinationState | undefined {
  return _states.get(runId);
}

export function clearCoordinationState(runId: string): void {
  _states.delete(runId);
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

export function markNodeActive(runId: string, nodeId: string): void {
  const state = _states.get(runId);
  if (!state) return;
  state.activeNodes.add(nodeId);
  state.ts = Date.now();
}

export function markNodeComplete(runId: string, nodeId: string): void {
  const state = _states.get(runId);
  if (!state) return;
  state.activeNodes.delete(nodeId);
  state.completedNodes.add(nodeId);
  // Release any locks held by this node
  for (const [resource, holder] of state.lockedResources.entries()) {
    if (holder === nodeId) state.lockedResources.delete(resource);
  }
  state.ts = Date.now();
}

export function markNodeFailed(runId: string, nodeId: string): void {
  const state = _states.get(runId);
  if (!state) return;
  state.activeNodes.delete(nodeId);
  state.failedNodes.add(nodeId);
  for (const [resource, holder] of state.lockedResources.entries()) {
    if (holder === nodeId) state.lockedResources.delete(resource);
  }
  state.ts = Date.now();
}

// ── Gate evaluation ───────────────────────────────────────────────────────────

export function evaluateGate(req: GateRequest): GateResult {
  const { executionId, nodeId, runId, dependsOn, resourceKeys = [] } = req;
  const ts    = Date.now();
  const state = _states.get(runId);

  if (!state) {
    return { executionId, nodeId, decision: "allow", reason: "allowed", ts };
  }

  // Check dependencies
  const pendingDeps = dependsOn.filter(dep => !state.completedNodes.has(dep));
  if (pendingDeps.length > 0) {
    return {
      executionId,
      nodeId,
      decision:     "hold",
      reason:       "dependency_pending",
      blockedBy:    pendingDeps,
      retryAfterMs: 500,
      ts,
    };
  }

  // Check if any dependency failed (fail-closed: block the node)
  const failedDeps = dependsOn.filter(dep => state.failedNodes.has(dep));
  if (failedDeps.length > 0) {
    return {
      executionId,
      nodeId,
      decision:  "block",
      reason:    "precondition_failed",
      blockedBy: failedDeps,
      ts,
    };
  }

  // Check resource locks
  const blockedResources: string[] = [];
  for (const resource of resourceKeys) {
    const holder = state.lockedResources.get(resource);
    if (holder && holder !== nodeId) {
      blockedResources.push(holder);
    }
  }
  if (blockedResources.length > 0) {
    return {
      executionId,
      nodeId,
      decision:     "hold",
      reason:       "lock_held",
      blockedBy:    blockedResources,
      retryAfterMs: 200,
      ts,
    };
  }

  // Acquire locks
  for (const resource of resourceKeys) {
    state.lockedResources.set(resource, nodeId);
  }
  markNodeActive(runId, nodeId);

  return { executionId, nodeId, decision: "allow", reason: "allowed", ts };
}
