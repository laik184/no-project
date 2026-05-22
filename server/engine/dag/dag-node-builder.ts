/**
 * dag-node-builder.ts
 *
 * Converts a structured execution plan (from planner/orchestration) into
 * a typed ExecutionGraph with proper DAG edges and dependency wiring.
 *
 * Single responsibility: plan → graph translation. No execution logic.
 */

import { randomUUID }       from "crypto";
import { createGraph, addNode, addEdge } from "../graph/execution-graph.ts";
import type {
  ExecutionGraph,
  ExecutionNode,
  NodeType,
  RetryStrategy,
} from "../graph/graph-types.ts";

// ── Input types ───────────────────────────────────────────────────────────────

export interface PlanTask {
  id:           string;
  name:         string;
  goal:         string;
  type?:        NodeType;
  toolName?:    string;
  agentRole?:   string;
  args?:        Record<string, unknown>;
  dependsOn:    string[];
  dependsOnAny?: string[];
  critical?:    boolean;
  maxRetries?:  number;
  retryStrategy?: RetryStrategy;
  rollbackTaskId?: string;
}

export interface ExecutionPlanInput {
  goal:      string;
  tasks:     PlanTask[];
  projectId: number;
  runId?:    string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Builds a validated ExecutionGraph from a flat list of tasks.
 * Each task maps to a single ExecutionNode.
 * Edges are derived from dependsOn arrays.
 */
export function buildGraphFromPlan(plan: ExecutionPlanInput): ExecutionGraph {
  const runId = plan.runId ?? randomUUID();
  const graph = createGraph(plan.projectId, plan.goal, runId);

  // Pass 1: add all nodes
  for (const task of plan.tasks) {
    const node: ExecutionNode = {
      id:            task.id,
      type:          task.type ?? inferNodeType(task),
      label:         task.name,
      toolName:      task.toolName,
      agentRole:     task.agentRole,
      args:          { goal: task.goal, ...(task.args ?? {}), projectId: plan.projectId },
      dependsOn:     task.dependsOn,
      dependsOnAny:  task.dependsOnAny,
      status:        "pending",
      retryCount:    0,
      maxRetries:    task.maxRetries ?? (task.critical ? 2 : 1),
      retryStrategy: task.retryStrategy ?? "exponential",
      isCheckpoint:  task.critical ?? false,
      rollbackNodeId: task.rollbackTaskId,
    };
    addNode(graph, node);
  }

  // Pass 2: add edges (derived from dependsOn)
  for (const task of plan.tasks) {
    for (const depId of task.dependsOn) {
      if (graph.nodes.has(depId)) {
        addEdge(graph, { from: depId, to: task.id, type: "sequential" });
      }
    }
    if (task.dependsOnAny) {
      for (const depId of task.dependsOnAny) {
        if (graph.nodes.has(depId)) {
          addEdge(graph, { from: depId, to: task.id, type: "conditional" });
        }
      }
    }
  }

  return graph;
}

/**
 * Build a simple linear graph from a list of tool names.
 * Each tool depends on the previous one (fully sequential).
 */
export function buildLinearGraph(
  projectId: number,
  runId:     string,
  goal:      string,
  tools:     Array<{ name: string; toolName: string; args?: Record<string, unknown> }>,
): ExecutionGraph {
  const graph = createGraph(projectId, goal, runId);
  let prevId: string | undefined;

  for (const tool of tools) {
    const nodeId = randomUUID();
    addNode(graph, {
      id:            nodeId,
      type:          "tool",
      label:         tool.name,
      toolName:      tool.toolName,
      args:          { ...(tool.args ?? {}), projectId },
      dependsOn:     prevId ? [prevId] : [],
      status:        "pending",
      retryCount:    0,
      maxRetries:    1,
      retryStrategy: "exponential",
      isCheckpoint:  false,
    });
    if (prevId) {
      addEdge(graph, { from: prevId, to: nodeId, type: "sequential" });
    }
    prevId = nodeId;
  }

  return graph;
}

/**
 * Build a parallel-then-verify graph.
 * All work nodes execute in parallel, then a verify node runs after all.
 */
export function buildParallelGraph(
  projectId:  number,
  runId:      string,
  goal:       string,
  workTasks:  PlanTask[],
  verifyTask?: PlanTask,
): ExecutionGraph {
  const allTasks = [...workTasks];
  if (verifyTask) {
    allTasks.push({
      ...verifyTask,
      dependsOn: workTasks.map(t => t.id),
    });
  }
  return buildGraphFromPlan({ goal, tasks: allTasks, projectId, runId });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferNodeType(task: PlanTask): NodeType {
  if (task.toolName)  return "tool";
  if (task.agentRole) return "agent";
  if (task.name.toLowerCase().includes("verify"))     return "verify";
  if (task.name.toLowerCase().includes("checkpoint")) return "checkpoint";
  if (task.name.toLowerCase().includes("decision"))   return "decision";
  return "agent";
}
