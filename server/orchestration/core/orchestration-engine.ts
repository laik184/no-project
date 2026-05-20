/**
 * orchestration-engine.ts
 *
 * Central orchestration engine — the single entry point for executing
 * any run through the full observe→complete lifecycle.
 * Coordinates context, state, checkpoints, and recovery.
 */

import { createContext, clearContext }                            from "./orchestration-context.ts";
import { createState, transitionPhase, markStatus, clearState }  from "./orchestration-state.ts";
import { captureCheckpoint, clearCheckpoints }                   from "./orchestration-replay.ts";
import { applyOrchestrationRecovery }                            from "./orchestration-recovery.ts";
import { emitOrchestrationLifecycle }                            from "./orchestration-events.ts";
import { routeExecution }                                        from "../execution/execution-router.ts";
import { recordSpanStart, recordSpanEnd }                        from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration }                      from "../telemetry/orchestration-metrics.ts";
import type { OrchestrationMode, OrchestrationPhase }            from "./orchestration-types.ts";

// ── Engine Input ──────────────────────────────────────────────────────────────

export interface EngineInput {
  runId:       string;
  projectId:   number;
  goal:        string;
  mode:        OrchestrationMode;
  sessionId?:  string;
  parentRunId?: string;
  maxSteps?:   number;
  maxRetries?: number;
  metadata?:   Record<string, unknown>;
}

// ── Engine Result ─────────────────────────────────────────────────────────────

export interface EngineResult {
  runId:      string;
  projectId:  number;
  success:    boolean;
  phase:      OrchestrationPhase;
  durationMs: number;
  score?:     number;
  error?:     string;
}

// ── Main engine entry ─────────────────────────────────────────────────────────

export async function executeOrchestration(input: EngineInput): Promise<EngineResult> {
  const { runId, projectId } = input;
  const startedAt = Date.now();

  const spanId = recordSpanStart(runId, "orchestration.full-run", {
    projectId: String(projectId),
    mode:      input.mode,
    goal:      input.goal.slice(0, 80),
  });

  // 1. Bootstrap context and state
  const ctx = createContext({
    runId, projectId,
    goal:       input.goal,
    mode:       input.mode,
    sessionId:  input.sessionId,
    parentRunId: input.parentRunId,
    maxSteps:   input.maxSteps,
    maxRetries: input.maxRetries,
    metadata:   input.metadata,
  });

  const state = createState({ runId, projectId, mode: input.mode });
  markStatus(runId, "running");

  emitOrchestrationLifecycle({
    runId, projectId,
    phase:   "observe",
    status:  "running",
    mode:    input.mode,
    traceId: ctx.traceId,
  });

  incrementCounter("orchestration.runs.started", { mode: input.mode });

  try {
    // 2. OBSERVE → ANALYZE → PLAN phases (synchronous classification)
    transitionPhase(runId, "analyze", "Classifying goal complexity");
    captureCheckpoint(runId, projectId, "analyze");

    transitionPhase(runId, "plan", "Planning execution strategy");

    // 3. PLAN → DECOMPOSE (for DAG/planned modes)
    if (input.mode === "dag" || input.mode === "planned") {
      transitionPhase(runId, "decompose", "Decomposing into task graph");
      captureCheckpoint(runId, projectId, "decompose");
      transitionPhase(runId, "route", "Routing to executor");
    } else {
      transitionPhase(runId, "route", "Routing to executor");
    }

    captureCheckpoint(runId, projectId, "route");

    // 4. Execute via router
    transitionPhase(runId, "execute", "Executing");
    await routeExecution(ctx, state);

    // 5. POST-EXECUTION: verify → reflect → score → learn
    captureCheckpoint(runId, projectId, "execute");
    transitionPhase(runId, "verify", "Verifying execution results");
    transitionPhase(runId, "reflect", "Reflecting on outcomes");
    transitionPhase(runId, "score", "Scoring execution quality");
    transitionPhase(runId, "learn", "Persisting learnings to memory");
    transitionPhase(runId, "complete", "Orchestration complete");
    markStatus(runId, "completed");

    const durationMs = Date.now() - startedAt;
    incrementCounter("orchestration.runs.completed", { mode: input.mode });
    recordDuration("orchestration.run.duration", durationMs, { mode: input.mode });
    recordSpanEnd(spanId, "ok");

    return { runId, projectId, success: true, phase: "complete", durationMs, score: state.score };

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const phase  = state.phase;

    const { shouldContinue, resumePhase } = await applyOrchestrationRecovery(
      runId, projectId, error, phase,
    );

    if (shouldContinue && resumePhase !== "failed") {
      console.log(`[orchestration-engine] Recovery succeeded — resuming from ${resumePhase}`);
      // Re-enter execution from recovery phase
      transitionPhase(runId, "execute", "Resuming after recovery");
      try {
        await routeExecution(ctx, state);
        transitionPhase(runId, "complete", "Recovered and completed");
        markStatus(runId, "completed");
        const durationMs = Date.now() - startedAt;
        recordSpanEnd(spanId, "ok");
        return { runId, projectId, success: true, phase: "complete", durationMs };
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        transitionPhase(runId, "failed", msg);
        markStatus(runId, "failed");
        recordSpanEnd(spanId, "error");
        return { runId, projectId, success: false, phase: "failed", durationMs: Date.now() - startedAt, error: msg };
      }
    }

    markStatus(runId, "failed");
    incrementCounter("orchestration.runs.failed", { mode: input.mode, phase });
    recordSpanEnd(spanId, "error");

    return {
      runId, projectId,
      success:    false,
      phase,
      durationMs: Date.now() - startedAt,
      error:      error.message,
    };
  } finally {
    // Clean up transient state (keep checkpoints for debugging)
    clearContext(runId);
    clearState(runId);
    clearCheckpoints(runId);
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getEngineVersion(): string {
  return "orchestration-engine@1.0.0";
}
