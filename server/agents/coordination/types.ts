/**
 * server/agents/coordination/types.ts
 * Type contracts for the CoordinationAgent.
 * Single responsibility: typed interfaces only — no logic.
 */

export type GateDecision = "allow" | "hold" | "block";
export type GateReason =
  | "dependency_pending"
  | "lock_held"
  | "resource_conflict"
  | "rate_limit"
  | "precondition_failed"
  | "allowed";

export interface ExecutionDependency {
  nodeId:    string;
  dependsOn: string[];   // nodeIds that must complete first
  status:    "pending" | "running" | "complete" | "failed";
}

export interface GateRequest {
  executionId: string;
  nodeId:      string;
  runId:       string;
  projectId:   number;
  dependsOn:   string[];
  resourceKeys?: string[];   // resources this node needs exclusive access to
}

export interface GateResult {
  executionId: string;
  nodeId:      string;
  decision:    GateDecision;
  reason:      GateReason;
  blockedBy?:  string[];   // nodeIds blocking this execution
  retryAfterMs?: number;
  ts:          number;
}

export interface CoordinationSyncRequest {
  runId:       string;
  projectId:   number;
  agentId:     string;
  status:      "started" | "completed" | "failed";
  nodeId?:     string;
  output?:     unknown;
}

export interface CoordinationState {
  runId:       string;
  projectId:   number;
  activeNodes: Set<string>;
  completedNodes: Set<string>;
  failedNodes: Set<string>;
  lockedResources: Map<string, string>;   // resourceKey → nodeId holding it
  ts:          number;
}

export interface CoordinationAgentTelemetry {
  runId:      string;
  projectId:  number;
  agentName:  "coordination-agent";
  eventType:
    | "agent.started"
    | "agent.completed"
    | "agent.failed"
    | "agent.blocked"
    | "agent.parallel.started"
    | "agent.parallel.completed";
  payload:    Record<string, unknown>;
  ts:         number;
}
