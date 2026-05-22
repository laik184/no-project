/**
 * execution-router.ts
 *
 * Routes an orchestration run to the correct executor based on mode.
 * Single decision point — no execution logic lives here.
 * Integrates with dynamic-rerouter for runtime escalation.
 */

import { runManager }          from "../../chat/run/controller.ts";
import { supervisorBridge }    from "../agents/supervisor-bridge.ts";
import { plannerBridge }       from "../agents/planner-bridge.ts";
import { builderBridge }       from "../agents/builder-bridge.ts";
import { emitPhaseTransition } from "../core/orchestration-events.ts";
import type { OrchestrationContext, OrchestrationState } from "../core/orchestration-types.ts";
import { withRerouting }       from "./execution-reroute-hook.ts";
import { getMetricsSnapshot }  from "./run-metrics-tracker.ts";

// ── Re-export mutation helpers so execution subsystems can feed metrics ────────

export {
  recordToolFailure,
  recordFileTouched,
  recordVerificationFailure,
  recordRetry,
  recordRuntimeRestart,
  recordRuntimeCrash,
  recordStepDuration,
  recordDependencies,
  recordConfidence,
  recordHallucination,
  recordReflectionSeverity,
  clearRunMetrics,
} from "./run-metrics-tracker.ts";

// ── Router ────────────────────────────────────────────────────────────────────

export async function routeExecution(
  ctx:   OrchestrationContext,
  state: OrchestrationState,
): Promise<void> {
  const { runId, projectId, mode } = ctx;
  const t0 = Date.now();

  console.log(`[execution-router] mode=${mode} run=${runId} project=${projectId}`);

  try {
    switch (mode) {
      case "tool-loop":
        await _routable(ctx, state, executeToolLoop);
        break;

      case "planned":
        await _routable(ctx, state, executePlanned);
        break;

      case "pipeline":
        await executePipeline(ctx);
        break;

      case "dag":
        await _routable(ctx, state, executeDAG);
        break;

      case "recovery":
        await executeRecovery(ctx);
        break;

      case "quantum":
        await executeQuantum(ctx);
        break;

      default:
        await executeAutoRouted(ctx);
    }

    emitPhaseTransition({
      runId, projectId, phase: "execute",
      outcome: "success", durationMs: Date.now() - t0, notes: `mode=${mode}`,
    });

  } catch (err) {
    emitPhaseTransition({
      runId, projectId, phase: "execute",
      outcome: "failure", durationMs: Date.now() - t0,
      notes: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Reroutable wrapper — injects dynamic escalation ───────────────────────────

async function _routable(
  ctx:     OrchestrationContext,
  state:   OrchestrationState,
  handler: (c: OrchestrationContext) => Promise<void>,
): Promise<void> {
  await withRerouting({
    ctx, state,
    handler,
    getMetrics: () => getMetricsSnapshot(ctx.runId),
    reInvoke:   (updatedCtx) => routeExecution(updatedCtx, state),
  });
}

// ── Execution mode handlers ────────────────────────────────────────────────────

async function executeToolLoop(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal, maxSteps } = ctx;
  console.log(`[execution-router] tool-loop run=${runId}`);
  const handle = await runManager.runGoal({
    runId, projectId, goal, mode: "agent", context: { maxSteps },
  });
  await waitForRunHandle(handle.runId);
}

async function executePlanned(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal } = ctx;
  console.log(`[execution-router] planned run=${runId}`);
  const plan = await plannerBridge.createPlan({ runId, projectId, goal });
  if (!plan.success) throw new Error(`Planner failed: ${plan.error}`);
  await supervisorBridge.coordinateExecution({ runId, projectId, goal, plan: plan.data });
}

async function executePipeline(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal } = ctx;
  console.log(`[execution-router] pipeline run=${runId}`);
  const handle = await runManager.runGoal({ runId, projectId, goal, mode: "pipeline", context: {} });
  await waitForRunHandle(handle.runId);
}

async function executeDAG(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal } = ctx;
  console.log(`[execution-router] dag run=${runId}`);
  const plan = await plannerBridge.createPlan({ runId, projectId, goal });
  if (!plan.success) throw new Error(`DAG planning failed: ${plan.error}`);
  await builderBridge.executeWithDAG({ runId, projectId, plan: plan.data });
}

async function executeRecovery(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal } = ctx;
  console.log(`[execution-router] recovery run=${runId}`);
  await supervisorBridge.coordinateExecution({ runId, projectId, goal, plan: null });
}

async function executeQuantum(ctx: OrchestrationContext): Promise<void> {
  const { runId, projectId, goal } = ctx;
  console.log(`[execution-router] quantum run=${runId} project=${projectId}`);
  const { runQuantum } = await import("../../quantum/engine/quantum-engine.ts");
  const result = await runQuantum({ runId, projectId, goal, sandboxRoot: `/tmp/quantum/${runId}` });
  if (!result.success) {
    throw new Error(`[execution-router] Quantum run failed: ${result.error ?? "unknown"}`);
  }
  console.log(
    `[execution-router] quantum complete run=${runId} ` +
    `winner=${result.selectedPath} confidence=${result.finalState?.confidenceScore.toFixed(2)}`,
  );
}

async function executeAutoRouted(ctx: OrchestrationContext): Promise<void> {
  const { needsPlanning } = await import("../../agents/planning/index.ts");
  return needsPlanning(ctx.goal) ? executePlanned(ctx) : executeToolLoop(ctx);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForRunHandle(runId: string, timeoutMs = 900_000): Promise<void> {
  const { getRun } = await import("../../chat/run/registry.ts");
  const deadline   = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const handle = getRun(runId);
    if (!handle || handle.status !== "running") return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`[execution-router] Run ${runId} timed out after ${timeoutMs}ms`);
}
