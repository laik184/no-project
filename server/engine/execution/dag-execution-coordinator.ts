/**
 * dag-execution-coordinator.ts
 *
 * Top-level entry point for DAG-based execution.
 * Accepts a plan or pre-built graph, validates it, runs it with real node dispatch,
 * saves checkpoints, and emits full telemetry.
 *
 * Single responsibility: wiring. Delegates to graph-engine, node-executor, telemetry.
 */

import { runGraph }          from "../graph/graph-engine.ts";
import { validateGraph }     from "../graph/execution-graph.ts";
import { createCheckpoint }  from "../graph/graph-state.ts";
import { buildGraphFromPlan }from "../dag/dag-node-builder.ts";
import { createDagBusEvents, emitExecutionCompleted } from "../dag/dag-telemetry.ts";
import { dagCheckpointStore }from "../checkpoints/dag-checkpoint-store.ts";
import { graphStateStore }   from "../state/graph-state-store.ts";
import { createNodeExecutor }from "./node-executor.ts";
import type { ExecutionGraph, GraphResult } from "../graph/graph-types.ts";
import type { ExecutionPlanInput }          from "../dag/dag-node-builder.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DagExecutionOptions {
  nodeTimeoutMs?:  number;
  graphTimeoutMs?: number;
  autoRollback?:   boolean;
}

export interface DagExecutionResult {
  success:      boolean;
  graphId:      string;
  completed:    number;
  failed:       number;
  skipped:      number;
  totalMs:      number;
  checkpointAt: string | undefined;
  errors:       Array<{ nodeId: string; error: string }>;
  stopReason:   GraphResult["stopReason"];
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Build an ExecutionGraph from a plan and run it to completion.
 * Full pipeline: build → validate → register → run → checkpoint → emit.
 */
export async function runDagFromPlan(
  plan: ExecutionPlanInput,
  opts: DagExecutionOptions = {},
): Promise<DagExecutionResult> {
  const graph = buildGraphFromPlan(plan);
  return runDagGraph(graph, opts);
}

/**
 * Run a pre-built ExecutionGraph.
 * Validates, registers, executes with real node dispatch, and checkpoints.
 */
export async function runDagGraph(
  graph: ExecutionGraph,
  opts:  DagExecutionOptions = {},
): Promise<DagExecutionResult> {
  const t0  = Date.now();
  const ctx = { runId: graph.id, projectId: graph.projectId, graphId: graph.id };

  // 1. Validate
  const validation = validateGraph(graph);
  if (!validation.valid) {
    const errMsg = validation.errors.join("; ");
    console.error(`[dag-coordinator] Graph invalid: ${errMsg}`);
    return {
      success: false, graphId: graph.id,
      completed: 0, failed: 0, skipped: 0,
      totalMs: Date.now() - t0,
      checkpointAt: undefined,
      errors: [{ nodeId: "graph", error: errMsg }],
      stopReason: "aborted",
    };
  }
  if (validation.warnings.length > 0) {
    console.warn(`[dag-coordinator] Graph warnings: ${validation.warnings.join("; ")}`);
  }

  // 2. Register in state store
  graphStateStore.register(graph);

  // 3. Create executor with full telemetry + tool dispatch
  const executor    = createNodeExecutor({ runId: graph.id, projectId: graph.projectId });
  const busEvents   = createDagBusEvents(ctx);

  console.log(`[dag-coordinator] Starting graph=${graph.id.slice(0,8)} nodes=${graph.nodes.size} projectId=${graph.projectId}`);

  // 4. Run the graph (parallel, wave-based)
  const graphResult = await runGraph(graph, {
    executor,
    events:         busEvents,
    nodeTimeoutMs:  opts.nodeTimeoutMs  ?? 120_000,
    graphTimeoutMs: opts.graphTimeoutMs ?? 900_000,
    autoRollback:   opts.autoRollback   ?? true,
  });

  // 5. Save final checkpoint if anything completed
  if (graph.checkpointAt) {
    const cp = createCheckpoint(graph, graph.checkpointAt);
    dagCheckpointStore.save(graph.id, graph.projectId, cp);
  }

  // 6. Emit execution completed
  const totalMs = Date.now() - t0;
  emitExecutionCompleted(ctx, totalMs, graphResult.completed, graphResult.failed);

  const success = graphResult.stopReason === "complete";
  console.log(`[dag-coordinator] Graph ${success ? "COMPLETE" : "FAILED"} — ${graphResult.completed}/${graph.nodes.size} nodes in ${totalMs}ms`);

  return {
    success,
    graphId:      graph.id,
    completed:    graphResult.completed,
    failed:       graphResult.failed,
    skipped:      graphResult.skipped,
    totalMs,
    checkpointAt: graph.checkpointAt,
    errors:       graphResult.errors,
    stopReason:   graphResult.stopReason,
  };
}
