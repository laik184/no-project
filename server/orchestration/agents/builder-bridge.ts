/**
 * builder-bridge.ts
 *
 * Typed bridge between the orchestration engine and the builder/generator system.
 * Routes work to the generator orchestrator and wires DAG execution.
 */

import { runGraph }              from "../../engine/graph/graph-engine.ts";
import { createGraph, addNode }  from "../../engine/graph/execution-graph.ts";
import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter }      from "../telemetry/orchestration-metrics.ts";
import { createNodeExecutor }    from "../../engine/execution/node-executor.ts";
// bus import removed — no longer needed (createNodeExecutor handles bus events)
import { createDagBusEvents }    from "../../engine/dag/dag-telemetry.ts";
import { dagCheckpointStore }    from "../../engine/checkpoints/dag-checkpoint-store.ts";
import { graphStateStore }       from "../../engine/state/graph-state-store.ts";
import { createCheckpoint }      from "../../engine/graph/graph-state.ts";
import type { BridgeResult }     from "../core/orchestration-types.ts";
import type { ExecutionPlan }    from "./planner-bridge.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BuilderDAGInput {
  runId:     string;
  projectId: number;
  plan:      ExecutionPlan | null;
  signal?:   AbortSignal;
}

export interface BuilderResult {
  filesModified:  number;
  filesCreated:   number;
  toolsExecuted:  number;
  durationMs:     number;
  checkpointId?:  string;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class BuilderBridge {
  async executeWithDAG(input: BuilderDAGInput): Promise<BridgeResult<BuilderResult>> {
    const { runId, projectId, plan } = input;
    const t0     = Date.now();
    const spanId = recordSpanStart(runId, "builder.dag", {
      projectId: String(projectId),
      phases:    String(plan?.phases?.length ?? 0),
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "builder",
        role:      "builder",
        outcome:   "success",
        phase:     "execute",
      });

      if (!plan || !plan.phases || plan.phases.length === 0) {
        recordSpanEnd(spanId, "ok");
        return {
          success:    true,
          data:       { filesModified: 0, filesCreated: 0, toolsExecuted: 0, durationMs: 0 },
          durationMs: Date.now() - t0,
          retryable:  false,
        };
      }

      // createGraph(projectId, goal, runId?)
      const graph = createGraph(projectId, plan.phases.map(p => p.goal).join("; ").slice(0, 120), runId);

      for (const phase of plan.phases) {
        addNode(graph, {
          id:            phase.id,
          label:         phase.name,
          type:          "agent",
          args:          { goal: phase.goal, tools: phase.tools, projectId },
          dependsOn:     phase.dependsOn,
          dependsOnAny:  undefined,
          maxRetries:    phase.critical ? 2 : 1,
          retryCount:    0,
          retryStrategy: "exponential",
          isCheckpoint:  phase.critical,
          status:        "pending",
          rollbackNodeId: undefined,
        });
      }

      // Register graph in state store for observability
      graphStateStore.register(graph);

      // Real node executor — dispatches tools/agents, emits dag.node.* bus events
      const executor  = createNodeExecutor({ runId, projectId });
      const busEvents = createDagBusEvents({ runId, projectId, graphId: runId });

      const graphResult = await runGraph(graph, {
        executor,
        events:         busEvents,
        autoRollback:   true,
        nodeTimeoutMs:  120_000,
        graphTimeoutMs: 900_000,
      });

      // Persist final checkpoint
      if (graph.checkpointAt) {
        const cp = createCheckpoint(graph, graph.checkpointAt);
        dagCheckpointStore.save(runId, projectId, cp);
      }

      const success = graphResult.stopReason === "complete";
      incrementCounter(
        success ? "builder.dag.completed" : "builder.dag.failed",
        { projectId: String(projectId) },
      );
      recordSpanEnd(spanId, success ? "ok" : "error");

      return {
        success,
        data: {
          filesModified:  graphResult.completed,
          filesCreated:   0,
          toolsExecuted:  graphResult.completed,
          durationMs:     graphResult.totalMs,
          checkpointId:   graph.checkpointAt,
        },
        durationMs: Date.now() - t0,
        retryable:  !success,
      };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[builder-bridge] DAG execution failed: ${msg}`);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }
}

export const builderBridge = new BuilderBridge();
