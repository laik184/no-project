/**
 * server/engine/swarm/swarm-state-store.ts
 *
 * In-process state store for active swarm sessions.
 * Single responsibility: CRUD for SwarmSession only.
 * Thread-safe through single-event-loop design.
 */

import type {
  SwarmSession,
  SwarmPhase,
  SwarmTaskNode,
  SpawnedAgent,
  SwarmAgentStatus,
} from "./swarm-types.ts";

// ── Store ─────────────────────────────────────────────────────────────────────

const _sessions = new Map<string, SwarmSession>();

// ── Session CRUD ──────────────────────────────────────────────────────────────

export function createSession(
  swarmId:   string,
  runId:     string,
  projectId: number,
  goal:      string,
): SwarmSession {
  const session: SwarmSession = {
    swarmId,
    runId,
    projectId,
    goal,
    phase:         "initializing",
    agents:        new Map(),
    tasks:         new Map(),
    currentWave:   1,
    startedAt:     Date.now(),
    recoveryCount: 0,
  };
  _sessions.set(swarmId, session);
  return session;
}

export function getSession(swarmId: string): SwarmSession | undefined {
  return _sessions.get(swarmId);
}

export function requireSession(swarmId: string): SwarmSession {
  const s = _sessions.get(swarmId);
  if (!s) throw new Error(`[swarm-state-store] Unknown swarm: ${swarmId}`);
  return s;
}

export function deleteSession(swarmId: string): void {
  _sessions.delete(swarmId);
}

export function allActiveSessions(): SwarmSession[] {
  return Array.from(_sessions.values()).filter(
    s => s.phase !== "completed" && s.phase !== "failed",
  );
}

// ── Phase transitions ─────────────────────────────────────────────────────────

export function setPhase(swarmId: string, phase: SwarmPhase): void {
  const s = requireSession(swarmId);
  s.phase = phase;
  if (phase === "completed" || phase === "failed") {
    s.completedAt = Date.now();
  }
}

// ── Agent management ──────────────────────────────────────────────────────────

export function registerAgent(swarmId: string, agent: SpawnedAgent): void {
  requireSession(swarmId).agents.set(agent.agentId, agent);
}

export function updateAgentStatus(
  swarmId:  string,
  agentId:  string,
  status:   SwarmAgentStatus,
): void {
  const agent = requireSession(swarmId).agents.get(agentId);
  if (agent) agent.status = status;
}

export function getAgent(swarmId: string, agentId: string): SpawnedAgent | undefined {
  return _sessions.get(swarmId)?.agents.get(agentId);
}

export function agentsByWave(swarmId: string, wave: number): SpawnedAgent[] {
  const session = _sessions.get(swarmId);
  if (!session) return [];
  const tasksInWave = Array.from(session.tasks.values())
    .filter(t => t.wave === wave)
    .map(t => t.taskId);
  return Array.from(session.agents.values()).filter(a => tasksInWave.includes(a.taskId));
}

// ── Task management ───────────────────────────────────────────────────────────

export function registerTask(swarmId: string, task: SwarmTaskNode): void {
  requireSession(swarmId).tasks.set(task.taskId, task);
}

export function updateTaskStatus(
  swarmId: string,
  taskId:  string,
  status:  SwarmAgentStatus,
  result?: unknown,
  error?:  string,
): void {
  const task = requireSession(swarmId).tasks.get(taskId);
  if (!task) return;
  task.status      = status;
  if (result !== undefined) task.result = result;
  if (error  !== undefined) task.error  = error;
  if (status === "started")   task.startedAt   = Date.now();
  if (status === "completed" || status === "failed") task.completedAt = Date.now();
}

export function tasksByWave(swarmId: string, wave: number): SwarmTaskNode[] {
  return Array.from(
    (_sessions.get(swarmId)?.tasks.values() ?? [])
  ).filter(t => t.wave === wave);
}

export function pendingTasks(swarmId: string): SwarmTaskNode[] {
  return Array.from(
    (_sessions.get(swarmId)?.tasks.values() ?? [])
  ).filter(t => t.status === "spawned");
}

// ── Counters ──────────────────────────────────────────────────────────────────

export function sessionSummary(swarmId: string): {
  agents:     number;
  completed:  number;
  failed:     number;
  running:    number;
} {
  const session = _sessions.get(swarmId);
  if (!session) return { agents: 0, completed: 0, failed: 0, running: 0 };
  const agents = Array.from(session.agents.values());
  return {
    agents:    agents.length,
    completed: agents.filter(a => a.status === "completed").length,
    failed:    agents.filter(a => a.status === "failed").length,
    running:   agents.filter(a => a.status === "running").length,
  };
}
