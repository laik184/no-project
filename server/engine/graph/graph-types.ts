/**
 * graph-types.ts
 *
 * Canonical type contracts for the DAG-based execution engine.
 * All graph modules import from here — no circular dependencies.
 */

export type NodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "success"
  | "failed"
  | "retrying"
  | "skipped"
  | "rolled-back";

export type NodeType = "tool" | "agent" | "checkpoint" | "decision" | "verify";
export type RetryStrategy = "immediate" | "exponential" | "circuit-break" | "none";

export interface ExecutionNode {
  id:             string;
  type:           NodeType;
  label:          string;

  // Execution
  toolName?:      string;
  agentRole?:     string;
  args:           Record<string, unknown>;

  // DAG structure
  dependsOn:      string[];          // ALL must complete (AND)
  dependsOnAny?:  string[];          // ANY one suffices (OR)

  // State machine
  status:         NodeStatus;
  retryCount:     number;
  maxRetries:     number;
  retryStrategy:  RetryStrategy;

  // Rollback
  rollbackNodeId?:string;
  isCheckpoint:   boolean;

  // Results
  result?:        unknown;
  error?:         string;
  startedAt?:     number;
  completedAt?:   number;
  durationMs?:    number;
}

export interface ExecutionEdge {
  from:  string;    // nodeId
  to:    string;    // nodeId
  type:  "sequential" | "parallel" | "rollback" | "conditional";
}

export type GraphStatus =
  | "building" | "validating" | "ready"
  | "running"  | "paused"    | "complete"
  | "failed"   | "rolled-back";

export interface ExecutionGraph {
  id:          string;   // runId
  projectId:   number;
  goal:        string;
  nodes:       Map<string, ExecutionNode>;
  edges:       ExecutionEdge[];
  status:      GraphStatus;

  // Execution tracking
  currentWave: string[];          // node IDs currently executing
  completedIds:Set<string>;
  failedIds:   Set<string>;

  // Timing
  createdAt:   number;
  startedAt?:  number;
  completedAt?:number;

  // Resume support
  checkpointAt?:string;           // last checkpoint nodeId
}

export interface GraphResult {
  success:     boolean;
  completed:   number;
  failed:      number;
  skipped:     number;
  totalMs:     number;
  errors:      Array<{ nodeId: string; error: string }>;
  stopReason:  "complete" | "failed" | "aborted" | "timeout";
}

export interface GraphValidationResult {
  valid:      boolean;
  errors:     string[];
  warnings:   string[];
  cycleNodes?:string[];
}

/** Max nodes executing in parallel in one wave. */
export const MAX_PARALLEL = 5;
