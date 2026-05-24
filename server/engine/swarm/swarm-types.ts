/**
 * server/engine/swarm/swarm-types.ts
 *
 * All canonical type contracts for the Active Agent Swarm System.
 * Zero external imports — safe to import from any swarm module.
 */

// ── Agent roles in the swarm ──────────────────────────────────────────────────

export type SwarmAgentRole =
  | "planner"
  | "ui-agent"
  | "backend-agent"
  | "database-agent"
  | "runtime-agent"
  | "verification-agent"
  | "security-agent"
  | "recovery-agent"
  | "browser-agent"
  | "reflection-agent"
  | "merge-agent";

// ── Task wave classification ──────────────────────────────────────────────────

export type SwarmWaveIndex = 1 | 2 | 3 | 4;

export const WAVE_LABELS: Record<SwarmWaveIndex, string> = {
  1: "planning+scan",
  2: "generation",
  3: "verification",
  4: "merge+reflect",
};

// ── Agent lifecycle states ────────────────────────────────────────────────────

export type SwarmAgentStatus =
  | "spawned"
  | "started"
  | "running"
  | "blocked"
  | "completed"
  | "failed"
  | "recovering"
  | "replaced";

// ── Swarm session states ──────────────────────────────────────────────────────

export type SwarmPhase =
  | "initializing"
  | "spawning"
  | "wave-1"
  | "wave-2"
  | "wave-3"
  | "wave-4"
  | "merging"
  | "completed"
  | "failed"
  | "recovering";

// ── Task node in swarm task graph ─────────────────────────────────────────────

export interface SwarmTaskNode {
  taskId:         string;
  agentRole:      SwarmAgentRole;
  wave:           SwarmWaveIndex;
  dependsOn:      string[];        // taskIds that must complete first
  description:    string;
  priority:       SwarmTaskPriority;
  timeoutMs:      number;
  maxRetries:     number;
  status:         SwarmAgentStatus;
  startedAt?:     number;
  completedAt?:   number;
  result?:        unknown;
  error?:         string;
  retries:        number;
}

export type SwarmTaskPriority = "critical" | "high" | "normal" | "low";

// ── Spawned agent record ──────────────────────────────────────────────────────

export interface SpawnedAgent {
  agentId:    string;
  role:       SwarmAgentRole;
  taskId:     string;
  runId:      string;
  projectId:  number;
  status:     SwarmAgentStatus;
  spawnedAt:  number;
  memoryLane: string;           // isolated memory lane key
  resourceBudget: ResourceBudget;
}

export interface ResourceBudget {
  maxTokens:   number;
  maxTools:    number;
  maxDurationMs: number;
}

// ── Swarm execution session ───────────────────────────────────────────────────

export interface SwarmSession {
  swarmId:      string;
  runId:        string;
  projectId:    number;
  goal:         string;
  phase:        SwarmPhase;
  agents:       Map<string, SpawnedAgent>;
  tasks:        Map<string, SwarmTaskNode>;
  currentWave:  SwarmWaveIndex;
  startedAt:    number;
  completedAt?: number;
  recoveryCount: number;
}

// ── Swarm result ──────────────────────────────────────────────────────────────

export interface SwarmTaskResult {
  taskId:       string;
  agentId:      string;
  role:         SwarmAgentRole;
  success:      boolean;
  confidence:   number;
  output:       unknown;
  filesWritten: string[];
  durationMs:   number;
  retries:      number;
  error?:       string;
}

export interface SwarmFinalResult {
  swarmId:        string;
  runId:          string;
  projectId:      number;
  success:        boolean;
  agentCount:     number;
  tasksCompleted: number;
  tasksFailed:    number;
  conflicts:      number;
  durationMs:     number;
  mergedFiles:    string[];
  confidence:     number;
}

// ── Conflict ──────────────────────────────────────────────────────────────────

export interface SwarmConflict {
  conflictId: string;
  swarmId:    string;
  filePath:   string;
  agentA:     string;
  agentB:     string;
  resolved:   boolean;
  strategy:   "ast_safe" | "confidence" | "precedence";
  detectedAt: number;
}
