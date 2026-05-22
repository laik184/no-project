/**
 * server/engine/reflection/reflection-engine.ts
 *
 * Main Reflection Engine coordinator.
 *
 * Pipeline:
 *   trigger → analyze → classify → guard → memory → patch → decide → emit
 *
 * Single responsibility: orchestrate the reflection pipeline. No direct
 * process mutation — decisions are emitted via bus for downstream consumers.
 *
 * Integration points (event-driven, no tight coupling):
 *   IN:  process.crashed, run.lifecycle failed, reflection.trigger
 *   OUT: reflection.completed, reflection.aborted, reflection.patching
 *        reflection.rollback, reflection.retrying
 *
 * Consumers of reflection.completed pick up the PatchPlan and inject it
 * into the next LLM turn context. The engine NEVER directly calls the LLM.
 */

import { buildReflectionContext }  from "./reflection-analyzer.ts";
import { classifyFailure }         from "./reflection-classifier.ts";
import { buildPatchPlan }          from "./patch-strategy.ts";
import { getRetryStrategy, isRetryAllowed, computeDelay } from "./retry-strategy.ts";
import { canReflect, markReflectionStarted, markReflectionDone, resetGuard } from "./retry-guard.ts";
import { recall, remember, updateOutcome }                from "./reflection-memory.ts";
import {
  emitReflectionStarted,
  emitReflectionClassified,
  emitReflectionPatching,
  emitReflectionRollback,
  emitReflectionAborted,
  emitReflectionCompleted,
}                                   from "./reflection-events.ts";
import {
  telemetrySessionStart,
  telemetryRecordClassification,
  telemetryRecordPatch,
  telemetrySessionEnd,
}                                   from "./reflection-telemetry.ts";
import { bus }                      from "../../infrastructure/events/bus.ts";
import type {
  ReflectionTrigger,
  ReflectionOutcome,
  ReflectionDecision,
}                                   from "./reflection-types.ts";

// ── Public trigger API ────────────────────────────────────────────────────────

export interface TriggerInput {
  projectId:    number;
  runId:        string;
  trigger:      ReflectionTrigger;
  verifyErrors?: string[];
  previewDown?:  boolean;
  recentTools?:  string[];
  details?:      Record<string, unknown>;
}

/**
 * Trigger a full reflection cycle for a project.
 *
 * Safe to call from any event handler — the retry-guard prevents recursion,
 * rate-limit abuse, and repeated-failure loops. Always returns ReflectionOutcome,
 * never throws.
 */
export async function triggerReflection(input: TriggerInput): Promise<ReflectionOutcome> {
  const { projectId, runId, trigger } = input;
  const startedAt = Date.now();

  telemetrySessionStart(projectId, runId, trigger);
  emitReflectionStarted(runId, projectId, trigger);

  // ── Step 1: Analyze context ──────────────────────────────────────────────
  const context = buildReflectionContext({
    projectId, runId, trigger,
    verifyErrors: input.verifyErrors,
    previewDown:  input.previewDown,
    recentTools:  input.recentTools,
    extraDetails: input.details,
  });

  // ── Step 2: Classify failure ─────────────────────────────────────────────
  const classification = classifyFailure(
    context.logTail,
    context.verifyErrors,
    context.previewDown,
  );

  emitReflectionClassified(
    runId, projectId,
    classification.primary,
    classification.severity,
    classification.confidence,
    classification.retryable,
  );
  telemetryRecordClassification(projectId, runId, classification.primary);

  // ── Step 3: Guard check ──────────────────────────────────────────────────
  const guardDecision = canReflect(projectId, classification.primary);
  if (!guardDecision.allowed) {
    emitReflectionAborted(runId, projectId, guardDecision.reason ?? "guard blocked");
    telemetrySessionEnd(projectId, runId, "abort");

    return {
      projectId, runId, trigger,
      decision:   _buildSkipDecision(classification, guardDecision.reason!),
      skipped:    true,
      skipReason: guardDecision.reason,
      elapsedMs:  Date.now() - startedAt,
    };
  }

  markReflectionStarted(projectId, classification.primary);

  try {
    // ── Step 4: Memory lookup ──────────────────────────────────────────────
    const priorAttempt = recall(projectId, classification.primary, classification.evidence);
    if (priorAttempt && priorAttempt.outcome === "failure" && priorAttempt.attempts >= 2) {
      // Escalate if same failure class failed twice before
      emitReflectionAborted(runId, projectId,
        `Escalating — "${classification.primary}" failed ${priorAttempt.attempts} times previously`);
      telemetrySessionEnd(projectId, runId, "escalate");

      return {
        projectId, runId, trigger,
        decision:   _buildEscalateDecision(classification),
        skipped:    false,
        elapsedMs:  Date.now() - startedAt,
      };
    }

    // ── Step 5: Retry strategy ─────────────────────────────────────────────
    const retryStrategy  = getRetryStrategy(classification.primary);
    const priorAttempts  = priorAttempt?.attempts ?? 0;
    const retryAllowed   = isRetryAllowed(retryStrategy, priorAttempts);
    const retryDelayMs   = retryAllowed ? computeDelay(retryStrategy, priorAttempts) : 0;

    // ── Step 6: Patch plan ─────────────────────────────────────────────────
    const patchPlan = buildPatchPlan(classification, context);
    telemetryRecordPatch(projectId, runId);

    // Emit appropriate event based on patch plan
    if (patchPlan.rollbackFirst) {
      emitReflectionRollback(runId, projectId, patchPlan.summary);
    } else if (patchPlan.actions.length > 0) {
      const actionNames = patchPlan.actions.map((a) => a.type);
      emitReflectionPatching(runId, projectId, actionNames);
    }

    // ── Step 7: Build decision ─────────────────────────────────────────────
    const decisionType =
      patchPlan.rollbackFirst                        ? "rollback" :
      !classification.retryable                      ? "patch"    :
      !retryAllowed                                  ? "escalate" :
      patchPlan.restartNeeded                        ? "restart"  : "retry";

    const decision: ReflectionDecision = {
      decision:       decisionType,
      classification,
      patchPlan,
      retryAllowed,
      retryDelayMs,
      reason:         patchPlan.summary,
    };

    // ── Step 8: Record to memory ───────────────────────────────────────────
    remember(projectId, classification.primary, classification.evidence, decisionType, "pending");

    emitReflectionCompleted(runId, projectId, decisionType, Date.now() - startedAt);
    telemetrySessionEnd(projectId, runId, decisionType);

    // Emit structured result for downstream consumers (tool-loop context injection)
    bus.emit("agent.event", {
      runId, projectId,
      phase:     "reflection",
      agentName: "reflection-engine",
      eventType: "reflection.decision" as any,
      payload: {
        decision:     decisionType,
        failureClass: classification.primary,
        severity:     classification.severity,
        patchPlan:    {
          summary:       patchPlan.summary,
          restartNeeded: patchPlan.restartNeeded,
          rollbackFirst: patchPlan.rollbackFirst,
          actions:       patchPlan.actions.map((a) => a.type),
        },
        retryAllowed,
        retryDelayMs,
      },
      ts: Date.now(),
    });

    return {
      projectId, runId, trigger,
      decision,
      skipped:  false,
      elapsedMs: Date.now() - startedAt,
    };

  } finally {
    markReflectionDone(projectId);
  }
}

// ── Bus listener (auto-wiring entry point) ────────────────────────────────────

let _wired = false;

/**
 * Wire the reflection engine to runtime crash and failure bus events.
 * Call once at startup. Idempotent.
 */
export function startReflectionEngine(): void {
  if (_wired) return;
  _wired = true;

  // Trigger on process.crashed
  bus.subscribe("agent.event", (ev) => {
    if (ev.eventType !== "process.crashed") return;
    if (!ev.projectId) return;

    const payload = (ev.payload ?? {}) as Record<string, unknown>;
    triggerReflection({
      projectId: ev.projectId,
      runId:     ev.runId ?? `reflection-${ev.projectId}-${Date.now()}`,
      trigger:   "crash",
      details:   payload,
    }).catch((err) => {
      console.error(`[reflection-engine] Unhandled error on crash trigger:`, err?.message);
    });
  });

  // Trigger on run.lifecycle failed
  bus.on("run.lifecycle", (ev) => {
    if (ev.status !== "failed") return;

    triggerReflection({
      projectId: ev.projectId,
      runId:     ev.runId ?? `reflection-${ev.projectId}-${Date.now()}`,
      trigger:   "verify_fail",
      details:   { lifecycleStatus: ev.status },
    }).catch((err) => {
      console.error(`[reflection-engine] Unhandled error on lifecycle trigger:`, err?.message);
    });
  });

  console.log("[reflection-engine] Initialized — wired to process.crashed + run.lifecycle failed");
}

/**
 * Mark a reflection outcome as successful (call when process starts healthy after a reflection).
 */
export function markReflectionSuccess(projectId: number): void {
  resetGuard(projectId);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _buildSkipDecision(
  classification: ReturnType<typeof classifyFailure>,
  reason: string,
): ReflectionDecision {
  return {
    decision:       "abort",
    classification,
    patchPlan:      { actions: [{ type: "abort", reason }], estimatedFixMs: 0, restartNeeded: false, rollbackFirst: false, summary: reason },
    retryAllowed:   false,
    retryDelayMs:   0,
    reason,
  };
}

function _buildEscalateDecision(
  classification: ReturnType<typeof classifyFailure>,
): ReflectionDecision {
  const reason = `Escalating — repeated ${classification.primary} failure without resolution`;
  return {
    decision:       "escalate",
    classification,
    patchPlan:      { actions: [{ type: "escalate", reason }], estimatedFixMs: 0, restartNeeded: false, rollbackFirst: false, summary: reason },
    retryAllowed:   false,
    retryDelayMs:   0,
    reason,
  };
}
