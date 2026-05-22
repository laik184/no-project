/**
 * server/agents/coordination/coordination-agent.ts
 *
 * CoordinationAgent — inter-agent synchronization, dependency awareness,
 * and execution gating. Acts as the distributed-lock and dependency-gate
 * layer between parallel agent executions.
 *
 * Single responsibility: coordination only — no execution, no mutation.
 */

import { bus }    from "../../infrastructure/events/bus.ts";
import { record } from "../../telemetry/index.ts";
import {
  initCoordinationState,
  evaluateGate,
  markNodeComplete,
  markNodeFailed,
  clearCoordinationState,
  getCoordinationState,
} from "./execution-gate.ts";
import type {
  GateRequest,
  GateResult,
  CoordinationSyncRequest,
} from "./types.ts";

const AGENT_NAME = "coordination-agent";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitEvent(
  eventType: string,
  runId: string,
  projectId: number,
  payload: Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "coordination",
    agentName: AGENT_NAME,
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Retry-gate helper ─────────────────────────────────────────────────────────

async function awaitGate(
  req: GateRequest,
  maxWaitMs = 30_000,
): Promise<GateResult> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const result = evaluateGate(req);

    if (result.decision === "allow" || result.decision === "block") {
      return result;
    }

    // "hold" — wait and retry
    const delay = result.retryAfterMs ?? 500;
    await new Promise(r => setTimeout(r, delay));
  }

  return {
    executionId: req.executionId,
    nodeId:      req.nodeId,
    decision:    "block",
    reason:      "rate_limit",
    ts:          Date.now(),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Initialize coordination state for a new run. */
export function initRun(runId: string, projectId: number): void {
  initCoordinationState(runId, projectId);
  emitEvent("agent.started", runId, projectId, { action: "init" });
}

/** Request a gate decision — awaits dependencies if needed. */
export async function requestGate(req: GateRequest): Promise<GateResult> {
  const { runId, projectId, nodeId } = req;

  emitEvent("agent.parallel.started", runId, projectId, {
    nodeId, dependsOn: req.dependsOn,
  });

  const result = await awaitGate(req);

  const eventType = result.decision === "allow"
    ? "agent.parallel.completed"
    : "agent.blocked";

  emitEvent(eventType, runId, projectId, {
    nodeId, decision: result.decision, reason: result.reason,
  });

  if (result.decision === "block") {
    record("agent.started", runId, projectId, {
      agentName: AGENT_NAME, nodeId, blocked: true, reason: result.reason,
    }, [AGENT_NAME]);
  }

  return result;
}

/** Sync agent completion status — called when a node finishes. */
export function syncAgentStatus(req: CoordinationSyncRequest): void {
  const { runId, projectId, agentId, status, nodeId } = req;

  if (nodeId) {
    if (status === "completed") markNodeComplete(runId, nodeId);
    if (status === "failed")    markNodeFailed(runId, nodeId);
  }

  emitEvent("agent.completed", runId, projectId, {
    agentId, nodeId, status,
  });
}

/** Get a snapshot of the current coordination state for a run. */
export function getRunState(runId: string) {
  const state = getCoordinationState(runId);
  if (!state) return null;

  return {
    runId:           state.runId,
    projectId:       state.projectId,
    activeCount:     state.activeNodes.size,
    completedCount:  state.completedNodes.size,
    failedCount:     state.failedNodes.size,
    activeNodes:     Array.from(state.activeNodes),
    completedNodes:  Array.from(state.completedNodes),
    failedNodes:     Array.from(state.failedNodes),
    lockedResources: Object.fromEntries(state.lockedResources),
    ts:              state.ts,
  };
}

/** Tear down coordination state after a run completes. */
export function finalizeRun(runId: string, projectId: number): void {
  const state = getCoordinationState(runId);
  emitEvent("agent.completed", runId, projectId, {
    completed: state ? state.completedNodes.size : 0,
    failed:    state ? state.failedNodes.size : 0,
  });
  clearCoordinationState(runId);
}
