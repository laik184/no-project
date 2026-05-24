/**
 * server/agents/swarm/dynamic-agent-spawner.ts
 *
 * Dynamically spawns specialized agents for a swarm task graph.
 * Assigns isolated contexts, resource budgets, memory lanes.
 * Single responsibility: agent instantiation only.
 */

import type {
  SwarmTaskNode,
  SpawnedAgent,
  SwarmAgentRole,
} from "../../engine/swarm/swarm-types.ts";
import { registerAgent as registerState } from "../../engine/swarm/swarm-state-store.ts";
import { emitAgentSpawned }              from "../../engine/swarm/swarm-telemetry.ts";
import { createContext, ROLE_TOOLS, ROLE_TOKEN_BUDGET } from "./agent-context-isolator.ts";
import { registerAgent as registerBudget, getBudget, deregisterAgent }  from "./agent-resource-limiter.ts";

let _agentSeq = 0;

function agentId(role: SwarmAgentRole): string {
  return `agent-${role}-${++_agentSeq}-${Date.now()}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Spawn a single agent for a given task.
 * Initializes context, memory lane, resource budget.
 */
export function spawnAgent(
  swarmId:   string,
  runId:     string,
  projectId: number,
  goal:      string,
  task:      SwarmTaskNode,
): SpawnedAgent {
  const id     = agentId(task.agentRole);
  const budget = getBudget(task.agentRole);

  // Create isolated execution context
  createContext(
    id,
    task.agentRole,
    swarmId,
    runId,
    projectId,
    task.taskId,
    goal,
    ROLE_TOOLS[task.agentRole],
    ROLE_TOKEN_BUDGET[task.agentRole],
  );

  // Register resource budget
  registerBudget(id, task.agentRole);

  const agent: SpawnedAgent = {
    agentId:        id,
    role:           task.agentRole,
    taskId:         task.taskId,
    runId,
    projectId,
    status:         "spawned",
    spawnedAt:      Date.now(),
    memoryLane:     `${swarmId}:${id}`,
    resourceBudget: budget,
  };

  // Register in state store
  registerState(swarmId, agent);

  // Telemetry
  emitAgentSpawned(runId, projectId, swarmId, id, task.agentRole, task.taskId);

  return agent;
}

/**
 * Spawn ALL agents for an entire task graph in one call.
 * Returns agents indexed by taskId for dispatcher use.
 */
export function spawnSwarm(
  swarmId:   string,
  runId:     string,
  projectId: number,
  goal:      string,
  tasks:     SwarmTaskNode[],
): SpawnedAgent[] {
  return tasks.map(task => spawnAgent(swarmId, runId, projectId, goal, task));
}

/**
 * Replace a failed agent with a fresh instance.
 * Used by SwarmRecoveryCoordinator for dead-agent replacement.
 */
export function respawnAgent(
  swarmId:    string,
  runId:      string,
  projectId:  number,
  goal:       string,
  task:       SwarmTaskNode,
  oldAgentId: string,
): SpawnedAgent {
  // Deregister old agent resources (context destroy is caller's responsibility)
  deregisterAgent(oldAgentId);

  const fresh = spawnAgent(swarmId, runId, projectId, goal, task);
  return fresh;
}

// ── Wave-level spawn ──────────────────────────────────────────────────────────

export function spawnWaveAgents(
  swarmId:   string,
  runId:     string,
  projectId: number,
  goal:      string,
  tasks:     SwarmTaskNode[],
): SpawnedAgent[] {
  return tasks.map(t => spawnAgent(swarmId, runId, projectId, goal, t));
}
