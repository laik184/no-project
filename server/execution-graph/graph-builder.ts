/**
 * server/execution-graph/graph-builder.ts
 * Builds a causal execution graph from a stream of agent events.
 * Single responsibility: construct graph nodes/edges. No persistence.
 */

import { v4 as uuidv4 } from "uuid";
import { bus }          from "../infrastructure/events/bus.ts";
import type { ExecutionGraph, GraphNode, GraphEdge, NodeKind } from "./types.ts";
import { storeGraph }   from "./graph-store.ts";

export interface AgentEventInput {
  eventType: string;
  phase?:    string;
  payload?:  Record<string, unknown>;
  ts:        number;
}

export function buildGraph(
  runId:     string,
  projectId: number,
  events:    AgentEventInput[],
): ExecutionGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let lastNodeId: string | undefined;

  for (const event of events) {
    const kind   = eventKind(event.eventType);
    if (!kind) continue;

    const node: GraphNode = {
      id:       uuidv4(),
      kind,
      label:    event.eventType,
      runId,
      ts:       event.ts,
      status:   eventStatus(event.eventType),
      meta:     event.payload,
    };

    nodes.push(node);

    if (lastNodeId) {
      edges.push({ from: lastNodeId, to: node.id, label: "caused" });
    }
    lastNodeId = node.id;
  }

  return {
    runId,
    projectId,
    nodes,
    edges,
    startedAt:   events[0]?.ts ?? Date.now(),
    completedAt: events[events.length - 1]?.ts,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventKind(eventType: string): NodeKind | null {
  if (eventType.includes("task") || eventType.includes("phase")) return "task";
  if (eventType.includes("tool"))        return "tool";
  if (eventType.includes("retry"))       return "retry";
  if (eventType.includes("fail"))        return "failure";
  if (eventType.includes("recovery") || eventType.includes("heal")) return "recovery";
  if (eventType.includes("verif"))       return "verification";
  if (eventType.includes("checkpoint")) return "checkpoint";
  return null;
}

function eventStatus(eventType: string): GraphNode["status"] {
  if (eventType.includes("started") || eventType.includes("running")) return "running";
  if (eventType.includes("completed") || eventType.includes("passed")) return "success";
  if (eventType.includes("failed") || eventType.includes("error"))    return "failed";
  if (eventType.includes("skipped"))  return "skipped";
  return "pending";
}

// ── Incremental live wiring (bus-driven) ──────────────────────────────────────
// Accumulates events per-run and rebuilds graph on each event.
const runEventBuffers = new Map<string, { projectId: number; events: AgentEventInput[] }>();

export function wireGraphBus(): void {
  bus.on("agent.event", (e: any) => {
    if (!e?.runId) return;

    const entry = runEventBuffers.get(e.runId) ?? { projectId: e.projectId ?? 0, events: [] };
    entry.events.push({ eventType: e.eventType, phase: e.phase, payload: e.payload, ts: e.ts ?? Date.now() });
    runEventBuffers.set(e.runId, entry);

    const graph = buildGraph(e.runId, entry.projectId, entry.events);
    storeGraph(graph);
  });
}

/** Release the event buffer for a completed/failed run. Called by run-cleanup-manager. */
export function evictRunBuffer(runId: string): void {
  runEventBuffers.delete(runId);
}
