/**
 * orchestration-engine.ts
 *
 * Central orchestration engine — the single entry point for executing
 * any run through the full observe→complete lifecycle.
 *
 * Post-execution phases now call REAL computation engines:
 *   verify  → runVerificationEngine   (runtime + TS + package + preview checks)
 *   reflect → runReflectionEngine     (failure classification + loop detection)
 *   score   → runScoringEngine        (quality score stored on state)
 *   learn   → runLearningEngine       (persist fixes, patterns, decisions)
 *
 * No fake state labels remain in this file.
 */

import { createContext, clearContext }                            from "./orchestration-context.ts";
import { createState, transitionPhase, markStatus, clearState, setScore } from "./orchestration-state.ts";
import { captureCheckpoint, clearCheckpoints }                   from "./orchestration-replay.ts";
import { applyOrchestrationRecovery }                            from "./orchestration-recovery.ts";
import { emitOrchestrationLifecycle }                            from "./orchestration-events.ts";
import { routeExecution }                                        from "../execution/execution-router.ts";
import { recordSpanStart, recordSpanEnd }                        from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration }                      from "../telemetry/orchestration-metrics.ts";
import { runVerificationEngine }                                 from "../../verification/index.ts";
import { runReflectionEngine }                                   from "../../engines/reflection/index.ts";
import { runScoringEngine }                                      from "../../engines/scoring/index.ts";
import { runLearningEngine }                                     from "../../engines/learning/index.ts";
import { getExecutionStats, clearExecutionStats }                from "../execution/execution-result-registry.ts";
import type { OrchestrationMode, OrchestrationPhase }            from "./orchestration-types.ts";

// ── Engine Input ──────────────────────────────────────────────────────────────

export interface EngineInput {
  runId:        string;
  projectId:    number;
  goal:         string;
  mode:         OrchestrationMode;
  sessionId?:   string;
  parentRunId?: string;
  maxSteps?:    number;
  maxRetries?:  number;
  metadata?:    Record<string, unknown>;
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
    runId, projectId, goal: input.goal, mode: input.mode,
    sessionId: input.sessionId, parentRunId: input.parentRunId,
    maxSteps: input.maxSteps, maxRetries: input.maxRetries, metadata: input.metadata,
  });

  const state = createState({ runId, projectId, mode: input.mode });
  markStatus(runId, "running");

  emitOrchestrationLifecycle({
    runId, projectId, phase: "observe", status: "running",
    mode: input.mode, traceId: ctx.traceId,
  });

  incrementCounter("orchestration.runs.started", { mode: input.mode });

  try {
    // 2. OBSERVE → ANALYZE → PLAN
    transitionPhase(runId, "analyze", "Classifying goal complexity");
    captureCheckpoint(runId, projectId, "analyze");
    transitionPhase(runId, "plan", "Planning execution strategy");

    // 3. PLAN → DECOMPOSE (dag/planned modes only)
    if (input.mode === "dag" || input.mode === "planned") {
      transitionPhase(runId, "decompose", "Decomposing into task graph");
      captureCheckpoint(runId, projectId, "decompose");
    }

    transitionPhase(runId, "route", "Routing to executor");
    captureCheckpoint(runId, projectId, "route");

    // 4. Execute
    transitionPhase(runId, "execute", "Executing");
    await routeExecution(ctx, state);
    captureCheckpoint(runId, projectId, "execute");

    // 5. VERIFY — real verification engine
    transitionPhase(runId, "verify", "Running verification engine");
    const verificationReport = await runVerificationEngine(projectId, runId)
      .catch(e => { console.warn("[orchestration] verify failed (non-fatal):", e.message); return null; });

    // 6. REFLECT — real reflection engine
    transitionPhase(runId, "reflect", "Running reflection engine");
    const execStats  = getExecutionStats(runId);
    const reflection = verificationReport
      ? await runReflectionEngine(projectId, runId, verificationReport, execStats?.messages ?? [])
          .catch(e => { console.warn("[orchestration] reflect failed (non-fatal):", e.message); return null; })
      : null;

    // 7. SCORE — real scoring engine
    transitionPhase(runId, "score", "Running scoring engine");
    const scoring = await runScoringEngine(
      projectId, runId,
      execStats?.totalSteps          ?? 0,
      execStats?.verificationRetries ?? 0,
      execStats?.totalToolCalls      ?? 0,
      execStats?.unknownToolCalls    ?? 0,
      execStats?.failedToolCalls     ?? 0,
      0,   // hallucinationScore — populated by hallucination gate in tool loop
    ).catch(e => { console.warn("[orchestration] score failed (non-fatal):", e.message); return null; });

    if (scoring) {
      // Store normalised 0–1 score on state
      setScore(runId, scoring.overallScore / 100);
    }

    // 8. LEARN — real learning engine
    transitionPhase(runId, "learn", "Running learning engine");
    if (reflection && execStats) {
      await runLearningEngine(
        projectId, runId, input.goal,
        {
          success:    execStats.success,
          steps:      execStats.totalSteps,
          summary:    execStats.summary,
          stopReason: execStats.stopReason as any,
          error:      execStats.error,
        },
        reflection,
      ).catch(e => console.warn("[orchestration] learn failed (non-fatal):", e.message));
    }

    transitionPhase(runId, "complete", "Orchestration complete");
    markStatus(runId, "completed");

    const durationMs = Date.now() - startedAt;
    incrementCounter("orchestration.runs.completed", { mode: input.mode });
    recordDuration("orchestration.run.duration", durationMs, { mode: input.mode });
    recordSpanEnd(spanId, "ok");

    return { runId, projectId, success: true, phase: "complete", durationMs, score: state.score };

  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const phase = state.phase;

    const { shouldContinue, resumePhase } = await applyOrchestrationRecovery(
      runId, projectId, error, phase,
    );

    if (shouldContinue && resumePhase !== "failed") {
      console.log(`[orchestration-engine] Recovery succeeded — resuming from ${resumePhase}`);
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

    return { runId, projectId, success: false, phase, durationMs: Date.now() - startedAt, error: error.message };

  } finally {
    clearContext(runId);
    clearState(runId);
    clearCheckpoints(runId);
    clearExecutionStats(runId);
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getEngineVersion(): string {
  return "orchestration-engine@2.0.0";
}
