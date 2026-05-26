/**
 * client/src/features/swarm/swarm-types.ts
 *
 * Frontend-side types for the Active Agent Swarm visualization.
 * Mirrors server swarm-types — kept in sync manually (no codegen needed).
 */

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

export type SwarmAgentStatus =
  | "spawned" | "started" | "running" | "blocked"
  | "completed" | "failed" | "recovering" | "replaced";

export type SwarmPhase =
  | "initializing" | "spawning"
  | "wave-1" | "wave-2" | "wave-3" | "wave-4"
  | "merging" | "completed" | "failed" | "recovering";

export type SwarmTaskPriority = "critical" | "high" | "normal" | "low";

export interface SwarmAgentNode {
  agentId:    string;
  role:       SwarmAgentRole;
  taskId:     string;
  status:     SwarmAgentStatus;
  spawnedAt:  number;
}

export interface SwarmTaskNode {
  taskId:     string;
  role:       SwarmAgentRole;
  wave:       number;
  status:     SwarmAgentStatus;
  dependsOn:  string[];
  priority:   SwarmTaskPriority;
  durationMs?: number;
}

export interface SwarmConflict {
  conflictId: string;
  filePath:   string;
  agentA:     string;
  agentB:     string;
  resolved:   boolean;
  strategy:   string;
}

export interface SwarmState {
  swarmId:    string;
  phase:      SwarmPhase;
  agents:     SwarmAgentNode[];
  taskGraph:  SwarmTaskNode[];
  startedAt:  number;
}

export interface SwarmEvent {
  type:      string;
  swarmId:   string;
  runId:     string;
  projectId: number;
  payload:   Record<string, unknown>;
  ts:        number;
}

// Role display metadata
export const ROLE_LABELS: Record<SwarmAgentRole, string> = {
  "planner":            "Planner",
  "ui-agent":           "UI Agent",
  "backend-agent":      "Backend Agent",
  "database-agent":     "Database Agent",
  "runtime-agent":      "Runtime Agent",
  "verification-agent": "Verifier",
  "security-agent":     "Security",
  "recovery-agent":     "Recovery",
  "browser-agent":      "Browser",
  "reflection-agent":   "Reflection",
  "merge-agent":        "Merge Agent",
};

export const STATUS_COLORS: Record<SwarmAgentStatus, string> = {
  spawned:    "bg-slate-500",
  started:    "bg-blue-500",
  running:    "bg-blue-400 animate-pulse",
  blocked:    "bg-yellow-500",
  completed:  "bg-green-500",
  failed:     "bg-red-500",
  recovering: "bg-orange-500 animate-pulse",
  replaced:   "bg-purple-500",
};

export const WAVE_LABELS: Record<number, string> = {
  1: "Planning + Scan",
  2: "Generation",
  3: "Verification",
  4: "Merge + Reflect",
};
