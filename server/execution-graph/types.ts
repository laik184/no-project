/**
 * server/execution-graph/types.ts
 * Typed node and edge definitions for the execution graph. No logic.
 */

export type NodeKind =
  | "task"
  | "tool"
  | "retry"
  | "failure"
  | "recovery"
  | "verification"
  | "checkpoint";

export interface GraphNode {
  id: string;          // unique within the graph
  kind: NodeKind;
  label: string;
  runId: string;
  ts: number;
  durationMs?: number;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  meta?: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;        // node id
  to: string;         // node id
  label?: string;      // "caused", "retried", "recovered"
}

export interface ExecutionGraph {
  runId: string;
  projectId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  startedAt: number;
  completedAt?: number;
}
