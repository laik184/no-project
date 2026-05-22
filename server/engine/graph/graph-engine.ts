/**
 * graph-engine.ts
 *
 * Main orchestrator: runs an ExecutionGraph wave-by-wave,
 * handles retries, rollback, checkpointing, and timeouts.
 *
 * FIXED: Emits dag.node.ready for each node before its wave executes.
 */

import { getNextWave, createSchedulerEvents, buildSchedule, describeSchedule } from "./node-scheduler.ts";
import { runParallelBatch, aggregateResults }   from "./parallel-runner.ts";
import { buildRollbackPlan, executeRollback, skipBlockedNodes } from "./rollback-graph.ts";
import { createCheckpoint, prepareReplay }      from "./graph-state.ts";
import { setGraphStatus, hasCriticalFailure, isGraphComplete, graphSummary, setNodeStatus } from "./execution-graph.ts";
import { bus }                                  from "../../infrastructure/events/bus.ts";
import type { ExecutionGraph, GraphResult }     from "./graph-types.ts";
import type { NodeExecutor }                    from "./parallel-runner.ts";
import type { RollbackExecutor }               from "./rollback-graph.ts";
import type { SchedulerEvents }                from "./node-scheduler.ts";

export interface GraphEngineOptions {
  executor:          NodeExecutor;
  rollbackExecutor?: RollbackExecutor;
  events?:           Partial<SchedulerEvents>;
  nodeTimeoutMs?:    number;
  graphTimeoutMs?:   number;
  autoRollback?:     boolean;
}

const DEFAULT_NODE_TIMEOUT  = 120_000;   // 2 min per node
const DEFAULT_GRAPH_TIMEOUT = 900_000;   // 15 min for full graph

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runGraph(
  graph: ExecutionGraph,
  opts:  GraphEngineOptions,
): Promise<GraphResult> {
  const nodeTimeoutMs  = opts.nodeTimeoutMs  ?? DEFAULT_NODE_TIMEOUT;
  const graphTimeoutMs = opts.graphTimeoutMs ?? DEFAULT_GRAPH_TIMEOUT;
  const events = createSchedulerEvents(opts.events ?? {});
  const t0     = Date.now();

  setGraphStatus(graph, "validating");
  const schedule = buildSchedule(graph);
  console.log(`[graph-engine] Plan:\n${describeSchedule(schedule)}`);

  setGraphStatus(graph, "running");
  console.log(graphSummary(graph));

  const graphTimer = setTimeout(() => {
    console.error("[graph-engine] Graph timeout reached — aborting");
    setGraphStatus(graph, "failed");
  }, graphTimeoutMs);

  let waveIndex = 0;

  try {
    while (!isGraphComplete(graph) && graph.status === "running") {
      const wave = getNextWave(graph);

      if (wave.length === 0) {
        // No ready nodes — check for deadlock
        const running = [...graph.nodes.values()].filter(n => n.status === "running");
        const retrying = [...graph.nodes.values()].filter(n => n.status === "retrying");
        if (running.length === 0 && retrying.length === 0) {
          console.warn("[graph-engine] No ready nodes and nothing running/retrying — possible deadlock");
          break;
        }
        // Still waiting for retrying nodes to re-queue — short poll
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      // Emit dag.node.ready for each node about to execute
      for (const node of wave) {
        bus.emit("agent.event" as any, {
          runId:     graph.id,
          projectId: graph.projectId,
          phase:     "dag",
          agentName: "dag-engine",
          eventType: "dag.node.ready",
          payload:   { nodeId: node.id, label: node.label, waveIndex },
          ts:        Date.now(),
        });
      }

      events.onWaveStart({ waveIndex, nodes: wave, isParallel: wave.length > 1, estimatedMs: nodeTimeoutMs }, waveIndex);
      console.log(`[graph-engine] Wave ${waveIndex + 1} — ${wave.length} node(s): ${wave.map(n => n.label).join(", ")}`);

      const { passed, failed } = await runParallelBatch(wave, graph, {
        executor:  opts.executor,
        timeoutMs: nodeTimeoutMs,
        onNodeStart:    n    => console.log(`[graph-engine] → ${n.label}`),
        onNodeComplete: n    => console.log(`[graph-engine] ✓ ${n.label} (${n.durationMs}ms)`),
        onNodeFailed:  (n, e) => console.error(`[graph-engine] ✗ ${n.label}: ${e.message}`),
      });

      events.onWaveEnd(waveIndex, passed.length, failed.length);

      // Checkpoint at each successful wave
      if (passed.length > 0) {
        const lastPassed = passed[passed.length - 1];
        const cp = createCheckpoint(graph, lastPassed);
        graph.checkpointAt = cp.checkpointAt;
      }

      // Handle permanent failures
      for (const failedId of failed) {
        const node = graph.nodes.get(failedId);
        if (!node || node.status !== "failed") continue;
        if (node.retryCount < node.maxRetries) continue; // still retrying

        // Transitively skip all blocked descendants
        skipBlockedNodes(graph, failedId);

        // Auto rollback if enabled
        if (opts.autoRollback && opts.rollbackExecutor) {
          const plan = buildRollbackPlan(graph, failedId);
          if (plan.nodesToRollback.length > 0) {
            console.log(`[graph-engine] Rolling back ${plan.nodesToRollback.length} node(s)`);
            await executeRollback(graph, plan, opts.rollbackExecutor);
          }
        }

        if (hasCriticalFailure(graph)) {
          events.onGraphFailed(failedId, node.error ?? "Unknown");
          setGraphStatus(graph, "failed");
          break;
        }
      }

      waveIndex++;
    }
  } finally {
    clearTimeout(graphTimer);
  }

  if (graph.status === "running") {
    const finalStatus = hasCriticalFailure(graph) ? "failed" : "complete";
    setGraphStatus(graph, finalStatus);
  }

  const stopReason: GraphResult["stopReason"] =
    graph.status === "complete" ? "complete"
    : graph.status === "failed"  ? "failed"
    : "aborted";

  const result = aggregateResults(graph, Date.now() - t0, stopReason);
  events.onGraphDone(waveIndex);
  console.log(`[graph-engine] Done — ${result.completed} passed, ${result.failed} failed in ${result.totalMs}ms`);
  return result;
}

/** Replay from last checkpoint after a failure. */
export async function replayFromCheckpoint(
  graph: ExecutionGraph,
  opts:  GraphEngineOptions,
): Promise<GraphResult> {
  const fromNodeId = graph.checkpointAt;
  if (!fromNodeId) {
    console.log("[graph-engine] No checkpoint — replaying from scratch");
    for (const node of graph.nodes.values()) {
      node.status     = "pending";
      node.retryCount = 0;
      node.result     = undefined;
      node.error      = undefined;
    }
    graph.completedIds.clear();
    graph.failedIds.clear();
  } else {
    prepareReplay(graph, fromNodeId);
  }
  graph.status = "running";
  return runGraph(graph, opts);
}
