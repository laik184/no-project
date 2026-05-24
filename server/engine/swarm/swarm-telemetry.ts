/**
 * server/engine/swarm/swarm-telemetry.ts
 *
 * Emits all 12 canonical swarm telemetry events onto the EventBus.
 * Single responsibility: telemetry emission only.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type { SwarmAgentRole, SwarmPhase, SwarmFinalResult } from "./swarm-types.ts";

// ── Canonical event names ─────────────────────────────────────────────────────

export const SWARM_EVENTS = {
  AGENT_SPAWNED:        "agent.spawned",
  AGENT_STARTED:        "agent.started",
  AGENT_BLOCKED:        "agent.blocked",
  AGENT_COMPLETED:      "agent.completed",
  AGENT_FAILED:         "agent.failed",
  BARRIER_WAIT:         "swarm.barrier.wait",
  MERGE_STARTED:        "swarm.merge.started",
  MERGE_COMPLETED:      "swarm.merge.completed",
  RETRY:                "swarm.retry",
  RECOVERY:             "swarm.recovery",
  CONFLICT_DETECTED:    "swarm.conflict.detected",
  CONFLICT_RESOLVED:    "swarm.conflict.resolved",
  PHASE_CHANGED:        "swarm.phase.changed",
  SWARM_COMPLETED:      "swarm.completed",
  SWARM_FAILED:         "swarm.failed",
} as const;

// ── Internal emitter ──────────────────────────────────────────────────────────

function emit(
  eventType: string,
  runId:     string,
  projectId: number,
  swarmId:   string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase:     "swarm",
    agentName: "active-swarm-engine",
    eventType,
    payload:   { swarmId, ...payload },
    ts:        Date.now(),
  });
}

// ── Public event emitters ─────────────────────────────────────────────────────

export function emitAgentSpawned(
  runId: string, projectId: number, swarmId: string,
  agentId: string, role: SwarmAgentRole, taskId: string,
): void {
  emit(SWARM_EVENTS.AGENT_SPAWNED, runId, projectId, swarmId, { agentId, role, taskId });
}

export function emitAgentStarted(
  runId: string, projectId: number, swarmId: string,
  agentId: string, role: SwarmAgentRole, wave: number,
): void {
  emit(SWARM_EVENTS.AGENT_STARTED, runId, projectId, swarmId, { agentId, role, wave });
}

export function emitAgentBlocked(
  runId: string, projectId: number, swarmId: string,
  agentId: string, reason: string,
): void {
  emit(SWARM_EVENTS.AGENT_BLOCKED, runId, projectId, swarmId, { agentId, reason });
}

export function emitAgentCompleted(
  runId: string, projectId: number, swarmId: string,
  agentId: string, role: SwarmAgentRole, durationMs: number, success: boolean,
): void {
  emit(SWARM_EVENTS.AGENT_COMPLETED, runId, projectId, swarmId, { agentId, role, durationMs, success });
}

export function emitAgentFailed(
  runId: string, projectId: number, swarmId: string,
  agentId: string, role: SwarmAgentRole, error: string,
): void {
  emit(SWARM_EVENTS.AGENT_FAILED, runId, projectId, swarmId, { agentId, role, error });
}

export function emitBarrierWait(
  runId: string, projectId: number, swarmId: string,
  waveIndex: number, waiting: number, total: number,
): void {
  emit(SWARM_EVENTS.BARRIER_WAIT, runId, projectId, swarmId, { waveIndex, waiting, total });
}

export function emitMergeStarted(
  runId: string, projectId: number, swarmId: string, fileCount: number,
): void {
  emit(SWARM_EVENTS.MERGE_STARTED, runId, projectId, swarmId, { fileCount });
}

export function emitMergeCompleted(
  runId: string, projectId: number, swarmId: string, merged: number, conflicts: number,
): void {
  emit(SWARM_EVENTS.MERGE_COMPLETED, runId, projectId, swarmId, { merged, conflicts });
}

export function emitRetry(
  runId: string, projectId: number, swarmId: string,
  agentId: string, attempt: number, reason: string,
): void {
  emit(SWARM_EVENTS.RETRY, runId, projectId, swarmId, { agentId, attempt, reason });
}

export function emitRecovery(
  runId: string, projectId: number, swarmId: string,
  agentId: string, strategy: string,
): void {
  emit(SWARM_EVENTS.RECOVERY, runId, projectId, swarmId, { agentId, strategy });
}

export function emitConflictDetected(
  runId: string, projectId: number, swarmId: string,
  conflictId: string, filePath: string, agentA: string, agentB: string,
): void {
  emit(SWARM_EVENTS.CONFLICT_DETECTED, runId, projectId, swarmId, { conflictId, filePath, agentA, agentB });
}

export function emitConflictResolved(
  runId: string, projectId: number, swarmId: string,
  conflictId: string, strategy: string, winner: string,
): void {
  emit(SWARM_EVENTS.CONFLICT_RESOLVED, runId, projectId, swarmId, { conflictId, strategy, winner });
}

export function emitPhaseChanged(
  runId: string, projectId: number, swarmId: string, phase: SwarmPhase,
): void {
  emit(SWARM_EVENTS.PHASE_CHANGED, runId, projectId, swarmId, { phase });
}

export function emitSwarmCompleted(
  runId: string, projectId: number, result: SwarmFinalResult,
): void {
  emit(SWARM_EVENTS.SWARM_COMPLETED, runId, projectId, result.swarmId, {
    tasksCompleted: result.tasksCompleted,
    tasksFailed:    result.tasksFailed,
    durationMs:     result.durationMs,
    confidence:     result.confidence,
  });
}

export function emitSwarmFailed(
  runId: string, projectId: number, swarmId: string, reason: string,
): void {
  emit(SWARM_EVENTS.SWARM_FAILED, runId, projectId, swarmId, { reason });
}
