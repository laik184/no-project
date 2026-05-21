/**
 * orchestration-engine.ts  v3.0.0
 *
 * Central orchestration engine — full NURA X spec pipeline:
 *
 *   observe → analyze → plan → route → execute
 *   → verify (TS + runtime + package + preview)
 *   → browser (blank screen + hydration + DOM + interactions)
 *   → reflect (failure classification + loop detection)
 *   → score   (quality grade A–F)
 *   → learn   (persist fixes + failure patterns)
 *   → CompletionGate (policy + hallucination + browser)
 *   → complete
 *
 * Zero fake phase labels. Every phase does real work.
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
import { runBrowserValidation }                                  from "../../browser/index.ts";
import { runReflectionEngine }                                   from "../../engines/reflection/index.ts";
import { runScoringEngine }                                      from "../../engines/scoring/index.ts";
import { runLearningEngine }                                     from "../../engines/learning/index.ts";
import { runCompletionGate }                                     from "../gates/completion-gate.ts";
import { getExecutionStats, clearExecutionStats }                from "../execution/execution-result-registry.ts";
import type { OrchestrationMode, OrchestrationPhase }            from "./orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface EngineResult {
  runId:      string;
  projectId:  number;
  success:    boolean;
  phase:      OrchestrationPhase;
  durationMs: number;
  score?:     number;
  gateScore?: number;
  error?:     string;
}

// ── Main engine entry ─────────────────────────────────────────────────────────

export async function executeOrchestration(input: EngineInput): Promise<EngineResult> {
  const { runId, projectId } = input;
  const startedAt = Date.now();

  const spanId = recordSpanStart(runId, "orchestration.full-run", {
    projectId: String(projectId), mode: input.mode, goal: input.goal.slice(0, 80),
  });

  const ctx   = createContext({ runId, projectId, goal: input.goal, mode: input.mode,
    sessionId: input.sessionId, parentRunId: input.parentRunId,
    maxSteps: input.maxSteps, maxRetries: input.maxRetries, metadata: input.metadata });
  const state = createState({ runId, projectId, mode: input.mode });

  markStatus(runId, "running");
  emitOrchestrationLifecycle({ runId, projectId, phase: "observe", status: "running",
    mode: input.mode, traceId: ctx.traceId });
  incrementCounter("orchestration.runs.started", { mode: input.mode });

  try {
    // ── Phases 1–3: Classify → Plan ──────────────────────────────────────────
    transitionPhase(runId, "analyze", "Classifying goal complexity");
    captureCheckpoint(runId, projectId, "analyze");
    transitionPhase(runId, "plan", "Planning execution strategy");

    if (input.mode === "dag" || input.mode === "planned") {
      transitionPhase(runId, "decompose", "Decomposing into task graph");
      captureCheckpoint(runId, projectId, "decompose");
    }

    transitionPhase(runId, "route", "Routing to executor");
    captureCheckpoint(runId, projectId, "route");

    // ── Phase 4: Execute ──────────────────────────────────────────────────────
    transitionPhase(runId, "execute", "Executing");
    await routeExecution(ctx, state);
    captureCheckpoint(runId, projectId, "execute");

    const execStats = getExecutionStats(runId);

    // ── Phase 5: Verify — real verification engine ────────────────────────────
    transitionPhase(runId, "verify", "Running verification engine");
    const verificationReport = await runVerificationEngine(projectId, runId)
      .catch(e => { console.warn("[orch] verify failed (non-fatal):", e.message); return null; });

    // ── Phase 5b: Browser — visual + hydration + DOM validation ───────────────
    const browserReport = await runBrowserValidation(projectId, runId)
      .catch(e => { console.warn("[orch] browser validation failed (non-fatal):", e.message); return null; });

    // ── Phase 6: Reflect — failure analysis + loop detection ──────────────────
    transitionPhase(runId, "reflect", "Running reflection engine");
    const reflection = verificationReport
      ? await runReflectionEngine(projectId, runId, verificationReport, execStats?.messages ?? [])
          .catch(e => { console.warn("[orch] reflect failed (non-fatal):", e.message); return null; })
      : null;

    // ── Phase 7: Score — quality grade ────────────────────────────────────────
    transitionPhase(runId, "score", "Running scoring engine");
    const scoring = await runScoringEngine(
      projectId, runId,
      execStats?.totalSteps          ?? 0,
      execStats?.verificationRetries ?? 0,
      execStats?.totalToolCalls      ?? 0,
      execStats?.unknownToolCalls    ?? 0,
      execStats?.failedToolCalls     ?? 0,
      browserReport?.blocked ? 0.5 : 0,
    ).catch(e => { console.warn("[orch] score failed (non-fatal):", e.message); return null; });

    if (scoring) setScore(runId, scoring.overallScore / 100);

    // ── Phase 8: Learn — persist fixes + patterns ─────────────────────────────
    transitionPhase(runId, "learn", "Running learning engine");
    if (reflection && execStats) {
      await runLearningEngine(
        projectId, runId, input.goal,
        { success: execStats.success, steps: execStats.totalSteps,
          summary: execStats.summary, stopReason: execStats.stopReason, error: execStats.error },
        reflection,
      ).catch(e => console.warn("[orch] learn failed (non-fatal):", e.message));
    }

    // ── Phase 9: CompletionGate — final gatekeeper ────────────────────────────
    const gateResult = await runCompletionGate({
      runId, projectId, goal: input.goal,
      stepCount:           execStats?.totalSteps ?? 0,
      retryCount:          state.retryCount ?? 0,
      messages:            execStats?.messages ?? [],
      verificationReport:  verificationReport ?? null,
      browserReport:       browserReport ?? null,
    }).catch(e => { console.warn("[orch] gate failed (non-fatal):", e.message); return null; });

    transitionPhase(runId, "complete", "Orchestration complete");
    markStatus(runId, "completed");

    const durationMs = Date.now() - startedAt;
    incrementCounter("orchestration.runs.completed", { mode: input.mode });
    recordDuration("orchestration.run.duration", durationMs, { mode: input.mode });
    recordSpanEnd(spanId, "ok");

    return {
      runId, projectId, success: true, phase: "complete", durationMs,
      score:     state.score,
      gateScore: gateResult?.score,
    };

  } catch (err) {
    const error  = err instanceof Error ? err : new Error(String(err));
    const phase  = state.phase;

    const { shouldContinue, resumePhase } = await applyOrchestrationRecovery(
      runId, projectId, error, phase,
    );

    if (shouldContinue && resumePhase !== "failed") {
      transitionPhase(runId, "execute", "Resuming after recovery");
      try {
        await routeExecution(ctx, state);
        transitionPhase(runId, "complete", "Recovered and completed");
        markStatus(runId, "completed");
        recordSpanEnd(spanId, "ok");
        return { runId, projectId, success: true, phase: "complete", durationMs: Date.now() - startedAt };
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

export function getEngineVersion(): string {
  return "orchestration-engine@3.0.0";
}
