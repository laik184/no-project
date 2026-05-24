/**
 * server/engine/swarm/swarm-task-graph.ts
 *
 * Wave-based task graph for the agent swarm.
 * Decomposes a goal into 4 waves of parallelizable tasks.
 * Single responsibility: task graph construction and wave resolution.
 */

import type {
  SwarmTaskNode,
  SwarmAgentRole,
  SwarmTaskPriority,
  SwarmWaveIndex,
} from "./swarm-types.ts";

let _seq = 0;
function taskId(role: SwarmAgentRole): string {
  return `task-${role}-${++_seq}-${Date.now()}`;
}

// ── Default wave blueprint ────────────────────────────────────────────────────

interface WaveSpec {
  wave:       SwarmWaveIndex;
  role:       SwarmAgentRole;
  description: string;
  priority:   SwarmTaskPriority;
  timeoutMs:  number;
  dependsOn:  SwarmAgentRole[];  // roles (resolved to taskIds at build time)
}

const DEFAULT_BLUEPRINT: WaveSpec[] = [
  // Wave 1: Planning + security scan (parallel, no deps)
  { wave: 1, role: "planner",           description: "Decompose goal into subtasks",          priority: "critical", timeoutMs: 60_000,  dependsOn: [] },
  { wave: 1, role: "security-agent",    description: "Scan codebase for security risks",       priority: "high",     timeoutMs: 45_000,  dependsOn: [] },

  // Wave 2: Generation (parallel, depends on wave-1 planner)
  { wave: 2, role: "ui-agent",          description: "Generate frontend components",            priority: "high",     timeoutMs: 120_000, dependsOn: ["planner"] },
  { wave: 2, role: "backend-agent",     description: "Generate API endpoints and services",     priority: "high",     timeoutMs: 120_000, dependsOn: ["planner"] },
  { wave: 2, role: "database-agent",    description: "Generate schema and migrations",          priority: "high",     timeoutMs: 90_000,  dependsOn: ["planner"] },
  { wave: 2, role: "runtime-agent",     description: "Configure runtime environment",           priority: "normal",   timeoutMs: 60_000,  dependsOn: ["planner"] },

  // Wave 3: Verification (parallel, depends on wave-2)
  { wave: 3, role: "verification-agent", description: "Static + build verification",           priority: "critical", timeoutMs: 90_000,  dependsOn: ["ui-agent", "backend-agent", "database-agent"] },
  { wave: 3, role: "browser-agent",     description: "Browser and preview validation",          priority: "high",     timeoutMs: 60_000,  dependsOn: ["runtime-agent"] },

  // Wave 4: Merge + reflect (sequential final gate)
  { wave: 4, role: "merge-agent",       description: "Merge and reconcile all outputs",         priority: "critical", timeoutMs: 60_000,  dependsOn: ["verification-agent", "browser-agent"] },
  { wave: 4, role: "reflection-agent",  description: "Analyze quality and emit learning",       priority: "normal",   timeoutMs: 45_000,  dependsOn: ["merge-agent"] },
  { wave: 4, role: "recovery-agent",    description: "Handle any failed agents",                priority: "high",     timeoutMs: 60_000,  dependsOn: ["verification-agent"] },
];

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildSwarmTaskGraph(
  swarmId: string,
  _goal:   string,
  overrides?: Partial<WaveSpec>[],
): SwarmTaskNode[] {
  const blueprint = overrides
    ? [...DEFAULT_BLUEPRINT, ...overrides as WaveSpec[]]
    : DEFAULT_BLUEPRINT;

  // First pass: assign taskIds
  const roleToTaskId = new Map<SwarmAgentRole, string>();
  for (const spec of blueprint) {
    const id = taskId(spec.role);
    roleToTaskId.set(spec.role, id);
  }

  // Second pass: build nodes with resolved dependsOn
  const nodes: SwarmTaskNode[] = blueprint.map(spec => ({
    taskId:       roleToTaskId.get(spec.role)!,
    agentRole:    spec.role,
    wave:         spec.wave,
    dependsOn:    spec.dependsOn.map(r => roleToTaskId.get(r) ?? "").filter(Boolean),
    description:  spec.description,
    priority:     spec.priority,
    timeoutMs:    spec.timeoutMs,
    maxRetries:   spec.priority === "critical" ? 2 : 1,
    status:       "spawned",
    retries:      0,
  }));

  return nodes;
}

// ── Wave resolution ───────────────────────────────────────────────────────────

export function getWaveTasks(
  nodes:     SwarmTaskNode[],
  waveIndex: SwarmWaveIndex,
): SwarmTaskNode[] {
  return nodes.filter(n => n.wave === waveIndex);
}

export function areWaveDepsComplete(
  nodes:     SwarmTaskNode[],
  waveIndex: SwarmWaveIndex,
): boolean {
  const waveTasks   = getWaveTasks(nodes, waveIndex);
  const allDepIds   = new Set(waveTasks.flatMap(t => t.dependsOn));
  const priorTasks  = nodes.filter(n => allDepIds.has(n.taskId));
  return priorTasks.every(t => t.status === "completed");
}

// ── Graph serialization for SSE ───────────────────────────────────────────────

export function serializeGraph(nodes: SwarmTaskNode[]): object[] {
  return nodes.map(n => ({
    taskId:    n.taskId,
    role:      n.agentRole,
    wave:      n.wave,
    status:    n.status,
    dependsOn: n.dependsOn,
    priority:  n.priority,
    durationMs: n.completedAt && n.startedAt
      ? n.completedAt - n.startedAt
      : undefined,
  }));
}
