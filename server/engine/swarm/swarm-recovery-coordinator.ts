/**
 * server/engine/swarm/swarm-recovery-coordinator.ts
 *
 * Orchestrates recovery of failed swarm agents.
 * Supports: retry, replacement spawn, partial rollback, dead-agent replacement.
 * Single responsibility: recovery decision and orchestration only.
 */

import type { SwarmTaskNode, SpawnedAgent, SwarmSession } from "./swarm-types.ts";
import { emitRecovery, emitRetry, emitAgentFailed } from "./swarm-telemetry.ts";
import { updateAgentStatus, updateTaskStatus } from "./swarm-state-store.ts";

// ── Recovery strategies ───────────────────────────────────────────────────────

export type RecoveryStrategy = "retry" | "replace" | "skip" | "abort";

interface RecoveryDecision {
  strategy:   RecoveryStrategy;
  reason:     string;
  canProceed: boolean;
}

// ── Strategy selector ─────────────────────────────────────────────────────────

function selectStrategy(
  task:   SwarmTaskNode,
  agent:  SpawnedAgent,
  error:  string,
): RecoveryDecision {
  // Critical tasks with retries remaining → retry
  if (task.priority === "critical" && task.retries < task.maxRetries) {
    return { strategy: "retry", reason: "Critical task retrying", canProceed: true };
  }
  // Non-critical with retries remaining → retry once
  if (task.retries < task.maxRetries) {
    return { strategy: "retry", reason: "Task retrying", canProceed: true };
  }
  // Recovery agent role → skip (avoid infinite recursion)
  if (agent.role === "recovery-agent") {
    return { strategy: "skip", reason: "Recovery agent self-recovery skipped", canProceed: true };
  }
  // Non-critical optional tasks → skip
  if (task.priority === "low" || task.priority === "normal") {
    return { strategy: "skip", reason: "Non-critical task skipped after exhausting retries", canProceed: true };
  }
  // Critical exhausted → abort swarm
  return { strategy: "abort", reason: `Critical task ${task.taskId} exhausted all retries: ${error}`, canProceed: false };
}

// ── Recovery state ────────────────────────────────────────────────────────────

interface RecoveryRecord {
  swarmId:     string;
  taskId:      string;
  agentId:     string;
  strategy:    RecoveryStrategy;
  attempt:     number;
  recoveredAt: number;
}

const _records: RecoveryRecord[] = [];

// ── Public API ────────────────────────────────────────────────────────────────

export function handleAgentFailure(
  session:   SwarmSession,
  task:      SwarmTaskNode,
  agent:     SpawnedAgent,
  error:     string,
): RecoveryDecision {
  const { swarmId, runId, projectId } = session;

  emitAgentFailed(runId, projectId, swarmId, agent.agentId, agent.role, error);

  const decision = selectStrategy(task, agent, error);

  if (decision.strategy === "retry") {
    task.retries++;
    task.status       = "spawned";    // reset for re-dispatch
    task.error        = undefined;
    task.startedAt    = undefined;
    task.completedAt  = undefined;

    updateTaskStatus(swarmId, task.taskId, "spawned");
    updateAgentStatus(swarmId, agent.agentId, "recovering");

    emitRetry(runId, projectId, swarmId, agent.agentId, task.retries, error);
    emitRecovery(runId, projectId, swarmId, agent.agentId, "retry");

    _records.push({
      swarmId, taskId: task.taskId, agentId: agent.agentId,
      strategy: "retry", attempt: task.retries, recoveredAt: Date.now(),
    });
  } else if (decision.strategy === "skip") {
    updateTaskStatus(swarmId, task.taskId, "failed", undefined, error);
    updateAgentStatus(swarmId, agent.agentId, "failed");
    emitRecovery(runId, projectId, swarmId, agent.agentId, "skip");
  }

  return decision;
}

/** Return all tasks that need re-dispatching after recovery. */
export function getRecoveryQueue(swarmId: string): RecoveryRecord[] {
  return _records.filter(r => r.swarmId === swarmId && r.strategy === "retry");
}

export function clearRecovery(swarmId: string): void {
  const idx = _records.findIndex(r => r.swarmId === swarmId);
  if (idx >= 0) _records.splice(idx, 1);
}

export function recoveryCount(swarmId: string): number {
  return _records.filter(r => r.swarmId === swarmId).length;
}
