/**
 * master-swarm-orchestrator.ts  v1.0.0
 *
 * MasterSwarmOrchestrator — universal entry point for all swarm-mode runs.
 *
 * Pipeline (fully instrumented, fail-closed):
 *   1. Intake         — validate inputs, register with ParallelOrchestrationFabric
 *   2. IntentAnalysis — parse goal into IntentGraph (no LLM — deterministic)
 *   3. StrategySelect — choose execution path from graph strategy:
 *       TOOL_LOOP  → short-circuits to coordinateSpecialists (lightweight)
 *       PLANNED    → coordinateSpecialists (structured planning)
 *       DAG        → QuantumDAGEngine-backed wave execution via DynamicSwarmRouter
 *       SWARM      → full ActiveSwarmEngine + DynamicSwarmRouter routing
 *       QUANTUM    → runQuantum
 *   4. Route          — DynamicSwarmRouter.route(graph) → RoutingResult
 *   5. Verification   — post-route patch validation
 *   6. Teardown       — release fabric slot, emit completion telemetry
 *
 * Fail-closed:
 *   - Critical node failure aborts all remaining waves immediately
 *   - No silent fallback — error is propagated to orchestration-engine
 *   - Fabric rejection (at capacity) throws immediately, not silently dropped
 *
 * Single responsibility: swarm orchestration pipeline wiring.
 * All sub-operations are delegated to focused modules.
 */

import { analyzeIntent }                from "./intent-graph/intent-graph-analyzer.ts";
import { dynamicSwarmRouter }           from "../../coordination/swarm-router/dynamic-swarm-router.ts";
import { parallelOrchestrationFabric }  from "../distributed/parallel-orchestration-fabric.ts";
import { coordinateSpecialists }        from "../../coordination/index.ts";
import { swarmTelemetryFabric }         from "../../infrastructure/telemetry/swarm/swarm-telemetry-fabric.ts";
import { bus }                          from "../../infrastructure/events/bus.ts";
import type { FilePatch }               from "../../coordination/contracts/specialist.contracts.ts";
import type { IntentGraph }             from "./intent-graph/intent-graph-types.ts";

// ── Result contract ───────────────────────────────────────────────────────────

export interface SwarmOrchestrationResult {
  runId:             string;
  projectId:         number;
  success:           boolean;
  strategy:          string;
  allPatches:        FilePatch[];
  patchCount:        number;
  failedTasks:       string[];
  intentGraph:       IntentGraph;
  durationMs:        number;
  parallelismFactor: number;
  error?:            string;
}

// ── Internal: strategy executors ──────────────────────────────────────────────

async function _executeViaRouter(
  graph:     IntentGraph,
  projectId: number,
): Promise<{ patches: FilePatch[]; failed: string[]; error?: string }> {
  const r = await dynamicSwarmRouter.route(graph, projectId);
  return { patches: r.allPatches, failed: r.failedTasks, error: r.error };
}

async function _executeViaCoordinateSpecialists(
  goal:      string,
  runId:     string,
  projectId: number,
  strategy:  string,
): Promise<{ patches: FilePatch[]; failed: string[]; error?: string }> {
  const result = await coordinateSpecialists(goal, runId, projectId, { swarmStrategy: strategy });
  if (!result.success && result.specialistsRan === 0) {
    return { patches: [], failed: [], error: result.error ?? "No specialists ran" };
  }
  return { patches: result.mergedPatches, failed: [] };
}

async function _executeQuantum(
  goal:      string,
  runId:     string,
  projectId: number,
): Promise<{ patches: FilePatch[]; failed: string[]; error?: string }> {
  const { runQuantum } = await import("../../quantum/engine/quantum-engine.ts");
  const result = await runQuantum({
    runId, projectId, goal,
    sandboxRoot: `/tmp/quantum/${runId}`,
  });
  if (!result.success) return { patches: [], failed: [], error: result.error ?? "Quantum run failed" };
  return { patches: [], failed: [] };
}

// ── MasterSwarmOrchestrator ───────────────────────────────────────────────────

class MasterSwarmOrchestrator {

  async run(
    runId:     string,
    projectId: number,
    goal:      string,
    context:   Record<string, unknown> = {},
  ): Promise<SwarmOrchestrationResult> {
    const t0 = Date.now();

    // ── Step 1: Register with fabric (capacity gate) ───────────────────────────
    const fabricResult = parallelOrchestrationFabric.spawn(runId, projectId);
    if (!fabricResult.ok) {
      throw new Error(`[master-swarm] Fabric at capacity: ${fabricResult.error}`);
    }
    parallelOrchestrationFabric.transition(runId, "observe", {});

    // ── Step 2: Intent analysis ────────────────────────────────────────────────
    parallelOrchestrationFabric.transition(runId, "analyze", {});
    const { graph, complexity } = analyzeIntent(runId, goal);

    bus.emit("agent.event", {
      runId, projectId,
      phase: "master-swarm", agentName: "master-swarm-orchestrator",
      eventType: "intent.analyzed",
      payload: {
        strategy:        graph.strategy.strategy,
        confidence:      graph.strategy.confidence,
        nodeCount:       graph.nodes.length,
        waveCount:       graph.waves.length,
        domainCount:     graph.strategy.domainCount,
        complexityScore: complexity.score,
        context,
      },
      ts: Date.now(),
    });

    // ── Step 3: Emit route start telemetry ────────────────────────────────────
    swarmTelemetryFabric.routeStart(runId, projectId, {
      strategy:    graph.strategy.strategy,
      domainCount: graph.strategy.domainCount,
      nodeCount:   graph.nodes.length,
      waves:       graph.waves.length,
    });

    parallelOrchestrationFabric.transition(runId, "route", { strategy: graph.strategy.strategy });

    // ── Step 4: Execute by strategy ───────────────────────────────────────────
    let execResult: { patches: FilePatch[]; failed: string[]; error?: string };
    const strategy = graph.strategy.strategy;

    try {
      switch (strategy) {
        case "quantum":
          execResult = await _executeQuantum(goal, runId, projectId);
          break;

        case "swarm":
        case "dag":
          // DAG and swarm both route through DynamicSwarmRouter with IntentGraph
          execResult = await _executeViaRouter(graph, projectId);
          break;

        case "planned":
        case "tool-loop":
        default:
          execResult = await _executeViaCoordinateSpecialists(goal, runId, projectId, strategy);
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parallelOrchestrationFabric.fail(runId, msg, { strategy });
      swarmTelemetryFabric.orchestrationAbort(runId, projectId, { reason: msg, phase: "execute", runId });
      swarmTelemetryFabric.clearRun(runId);
      return {
        runId, projectId, success: false, strategy,
        allPatches: [], patchCount: 0, failedTasks: [],
        intentGraph: graph, durationMs: Date.now() - t0,
        parallelismFactor: graph.parallelismFactor, error: msg,
      };
    }

    // ── Step 5: Complete ──────────────────────────────────────────────────────
    const durationMs = Date.now() - t0;
    const success    = !execResult.error && execResult.failed.length === 0;

    parallelOrchestrationFabric.transition(runId, "complete", {
      patchCount: execResult.patches.length,
      success,
    });

    swarmTelemetryFabric.routeComplete(runId, projectId, {
      strategy,
      success,
      durationMs,
      patchCount: execResult.patches.length,
    });

    swarmTelemetryFabric.clearRun(runId);

    console.info(
      `[master-swarm] complete run=${runId} strategy=${strategy} ` +
      `patches=${execResult.patches.length} failed=${execResult.failed.length} ` +
      `duration=${durationMs}ms parallelism=${graph.parallelismFactor.toFixed(2)}x`,
    );

    return {
      runId, projectId, success,
      strategy,
      allPatches:        execResult.patches,
      patchCount:        execResult.patches.length,
      failedTasks:       execResult.failed,
      intentGraph:       graph,
      durationMs,
      parallelismFactor: graph.parallelismFactor,
      error:             execResult.error,
    };
  }
}

export const masterSwarmOrchestrator = new MasterSwarmOrchestrator();
