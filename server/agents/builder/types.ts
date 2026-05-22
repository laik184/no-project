/**
 * server/agents/builder/types.ts
 * Type contracts for the top-level BuilderAgent coordinator.
 * Single responsibility: typed interfaces only — no logic.
 */

export type BuildPhase =
  | "scaffold"
  | "dependencies"
  | "backend"
  | "frontend"
  | "database"
  | "config"
  | "tests";

export interface BuildTask {
  id:          string;
  phase:       BuildPhase;
  goal:        string;
  tools:       string[];
  dependsOn:   string[];
  critical:    boolean;
  timeoutMs:   number;
}

export interface BuildPlan {
  runId:       string;
  projectId:   number;
  goal:        string;
  tasks:       BuildTask[];
  phases:      BuildPhase[];
  estimatedMs: number;
  parallelGroups: string[][];   // task IDs that can run in parallel
}

export interface BuildRequest {
  runId:       string;
  projectId:   number;
  goal:        string;
  framework?:  string;
  features?:   string[];
  existingFiles?: string[];
  signal?:     AbortSignal;
}

export interface BuildTaskResult {
  taskId:      string;
  phase:       BuildPhase;
  success:     boolean;
  filesWritten: number;
  toolsUsed:   string[];
  durationMs:  number;
  error?:      string;
}

export interface BuildResult {
  runId:       string;
  projectId:   number;
  success:     boolean;
  completedTasks: BuildTaskResult[];
  failedTasks:    BuildTaskResult[];
  filesCreated:   number;
  filesModified:  number;
  totalDurationMs: number;
  checkpointId?:  string;
  ts:          number;
}

export interface BuilderAgentTelemetry {
  runId:      string;
  projectId:  number;
  agentName:  "builder-agent";
  eventType:
    | "agent.started"
    | "agent.completed"
    | "agent.failed"
    | "agent.retry"
    | "agent.blocked"
    | "agent.recovered"
    | "agent.parallel.started"
    | "agent.parallel.completed";
  payload:    Record<string, unknown>;
  ts:         number;
}
