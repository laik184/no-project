/**
 * replay-engine.ts
 *
 * Deterministic replay of DAG execution from the last saved checkpoint.
 * Loads checkpoint → restores graph state → re-runs only pending/failed nodes.
 *
 * Single responsibility: replay orchestration. No tool dispatch.
 */

import { bus }                   from "../../infrastructure/events/bus.ts";
import { replayFromCheckpoint }  from "../graph/graph-engine.ts";
import { restoreCheckpoint }     from "../graph/graph-state.ts";
import { validateGraph }         from "../graph/execution-graph.ts";
import { dagCheckpointStore }    from "../checkpoints/dag-checkpoint-store.ts";
import { createDagBusEvents }    from "../dag/dag-telemetry.ts";
import type { ExecutionGraph, GraphResult } from "../graph/graph-types.ts";
import type { NodeExecutor }     from "../graph/parallel-runner.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReplayOptions {
  executor:       NodeExecutor;
  fromNodeId?:    string;          // override — replay from this node
  nodeTimeoutMs?: number;
  graphTimeoutMs?:number;
  autoRollback?:  boolean;
}

export interface ReplayResult {
  success:     boolean;
  graphResult: GraphResult;
  replayedFrom: string | undefined;
  durationMs:   number;
}

// ── Replay from store ─────────────────────────────────────────────────────────

/**
 * Restore last checkpoint from store, then re-run the graph from that point.
 * Returns full GraphResult including replayed nodes.
 */
export async function replayRunFromStore(
  graph:   ExecutionGraph,
  opts:    ReplayOptions,
): Promise<ReplayResult> {
  const t0 = Date.now();
  const ctx = { runId: graph.id, projectId: graph.projectId, graphId: graph.id };

  emitReplayStarted(ctx.runId, ctx.projectId);

  // 1. Load checkpoint (if not already restored)
  const fromNodeId = opts.fromNodeId ?? graph.checkpointAt;

  if (fromNodeId) {
    const cp = dagCheckpointStore.loadAt(graph.id, fromNodeId);
    if (cp) {
      restoreCheckpoint(graph, cp);
      console.log(`[replay-engine] Restored checkpoint at node="${fromNodeId}"`);
    } else {
      console.warn(`[replay-engine] No stored checkpoint found for node="${fromNodeId}" — re-running from scratch`);
    }
  }

  // 2. Validate graph before replay
  const validation = validateGraph(graph);
  if (!validation.valid) {
    emitReplayFailed(ctx.runId, ctx.projectId, `Invalid graph: ${validation.errors.join("; ")}`);
    return {
      success:      false,
      graphResult:  { success: false, completed: 0, failed: 0, skipped: 0, totalMs: 0, errors: [], stopReason: "aborted" },
      replayedFrom: fromNodeId,
      durationMs:   Date.now() - t0,
    };
  }

  // 3. Execute replay
  const graphResult = await replayFromCheckpoint(graph, {
    executor:       opts.executor,
    nodeTimeoutMs:  opts.nodeTimeoutMs,
    graphTimeoutMs: opts.graphTimeoutMs,
    autoRollback:   opts.autoRollback,
    events:         createDagBusEvents(ctx),
  });

  const durationMs = Date.now() - t0;
  const success    = graphResult.stopReason === "complete";

  emitReplayCompleted(ctx.runId, ctx.projectId, success, durationMs, fromNodeId);

  console.log(`[replay-engine] Replay ${success ? "OK" : "FAILED"} from="${fromNodeId ?? "scratch"}" in ${durationMs}ms`);

  return { success, graphResult, replayedFrom: fromNodeId, durationMs };
}

// ── Describe replay steps ─────────────────────────────────────────────────────

export interface ReplayStep {
  step:       number;
  nodeId:     string;
  label:      string;
  status:     string;
  durationMs: number | undefined;
}

/**
 * Returns an ordered list of replay steps for debugging/display.
 */
export function describeReplay(graph: ExecutionGraph): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let step = 1;

  for (const node of graph.nodes.values()) {
    steps.push({
      step:       step++,
      nodeId:     node.id,
      label:      node.label,
      status:     node.status,
      durationMs: node.durationMs,
    });
  }

  // Sort by startedAt for chronological order
  return steps.sort((a, b) => {
    const na = graph.nodes.get(a.nodeId);
    const nb = graph.nodes.get(b.nodeId);
    return (na?.startedAt ?? 0) - (nb?.startedAt ?? 0);
  });
}

// ── Bus events ────────────────────────────────────────────────────────────────

function emitReplayStarted(runId: string, projectId: number): void {
  bus.emit("agent.event" as any, {
    runId, projectId, phase: "dag", agentName: "replay-engine",
    eventType: "dag.replay.started", payload: {}, ts: Date.now(),
  });
}

function emitReplayCompleted(
  runId:       string,
  projectId:   number,
  success:     boolean,
  durationMs:  number,
  fromNodeId:  string | undefined,
): void {
  bus.emit("agent.event" as any, {
    runId, projectId, phase: "dag", agentName: "replay-engine",
    eventType: "dag.replay.completed",
    payload: { success, durationMs, fromNodeId },
    ts: Date.now(),
  });
}

function emitReplayFailed(runId: string, projectId: number, reason: string): void {
  bus.emit("agent.event" as any, {
    runId, projectId, phase: "dag", agentName: "replay-engine",
    eventType: "dag.replay.failed", payload: { reason }, ts: Date.now(),
  });
}
