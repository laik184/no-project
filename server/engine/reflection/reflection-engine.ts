/**
 * server/engine/reflection/reflection-engine.ts
 *
 * Reflection Engine coordinator — triggerReflection() pipeline.
 *
 * Pipeline: trigger → analyze → classify → guard → memory → patch → decide → emit
 *
 * Single responsibility: orchestrate the reflection pipeline. No direct
 * process mutation — decisions are emitted via bus for downstream consumers.
 *
 * Bus wiring (startReflectionEngine / markReflectionSuccess) lives in
 * reflection-engine-wiring.ts to keep this file under 250 lines.
 */

import { buildReflectionContext }  from "./reflection-analyzer.ts";
import { classifyFailure }         from "./reflection-classifier.ts";
import { buildPatchPlan }          from "./patch-strategy.ts";
import { getRetryStrategy, isRetryAllowed, computeDelay } from "./retry-strategy.ts";
import { canReflect, markReflectionStarted, markReflectionDone } from "./retry-guard.ts";
import { recall, remember }                              from "./reflection-memory.ts";
import {
  emitReflectionStarted, emitReflectionClassified, emitReflectionPatching,
  emitReflectionRollback, emitReflectionAborted, emitReflectionCompleted,
}                                  from "./reflection-events.ts";
import {
  telemetrySessionStart, telemetryRecordClassification,
  telemetryRecordPatch, telemetrySessionEnd,
}                                  from "./reflection-telemetry.ts";
import { bus }                     from "../../infrastructure/events/bus.ts";
import type {
  ReflectionTrigger, ReflectionOutcome, ReflectionDecision,
}                                  from "./reflection-types.ts";

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

  const context = buildReflectionContext({
    projectId, runId, trigger,
    verifyErrors: input.verifyErrors,
    previewDown:  input.previewDown,
    recentTools:  input.recentTools,
    extraDetails: input.details,
  });

  const classification = classifyFailure(
    context.logTail,
    context.verifyErrors,
    context.previewDown,
  );

  emitReflectionClassified(
    runId, projectId,
    classification.primary, classification.severity,
    classification.confidence, classification.retryable,
  );
  telemetryRecordClassification(projectId, runId, classification.primary);

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
    const priorAttempt = recall(projectId, classification.primary, classification.evidence);
    if (priorAttempt && priorAttempt.outcome === "failure" && priorAttempt.attempts >= 2) {
      emitReflectionAborted(runId, projectId,
        `Escalating — "${classification.primary}" failed ${priorAttempt.attempts} times previously`);
      telemetrySessionEnd(projectId, runId, "escalate");
      return {
        projectId, runId, trigger,
        decision:  _buildEscalateDecision(classification),
        skipped:   false,
        elapsedMs: Date.now() - startedAt,
      };
    }

    const retryStrategy = getRetryStrategy(classification.primary);
    const priorAttempts = priorAttempt?.attempts ?? 0;
    const retryAllowed  = isRetryAllowed(retryStrategy, priorAttempts);
    const retryDelayMs  = retryAllowed ? computeDelay(retryStrategy, priorAttempts) : 0;

    const patchPlan = buildPatchPlan(classification, context);
    telemetryRecordPatch(projectId, runId);

    if (patchPlan.rollbackFirst) {
      emitReflectionRollback(runId, projectId, patchPlan.summary);
    } else if (patchPlan.actions.length > 0) {
      emitReflectionPatching(runId, projectId, patchPlan.actions.map(a => a.type));
    }

    const decisionType =
      patchPlan.rollbackFirst       ? "rollback" :
      !classification.retryable     ? "patch"    :
      !retryAllowed                 ? "escalate" :
      patchPlan.restartNeeded       ? "restart"  : "retry";

    const decision: ReflectionDecision = {
      decision: decisionType,
      classification,
      patchPlan,
      retryAllowed,
      retryDelayMs,
      reason: patchPlan.summary,
    };

    remember(projectId, classification.primary, classification.evidence, decisionType, "pending");
    emitReflectionCompleted(runId, projectId, decisionType, Date.now() - startedAt);
    telemetrySessionEnd(projectId, runId, decisionType);

    bus.emit("agent.event", {
      runId, projectId,
      phase: "reflection", agentName: "reflection-engine",
      eventType: "reflection.decision" as any,
      payload: {
        decision:     decisionType,
        failureClass: classification.primary,
        severity:     classification.severity,
        patchPlan: {
          summary:       patchPlan.summary,
          restartNeeded: patchPlan.restartNeeded,
          rollbackFirst: patchPlan.rollbackFirst,
          actions:       patchPlan.actions.map(a => a.type),
        },
        retryAllowed,
        retryDelayMs,
      },
      ts: Date.now(),
    });

    return { projectId, runId, trigger, decision, skipped: false, elapsedMs: Date.now() - startedAt };

  } finally {
    markReflectionDone(projectId);
  }
}

function _buildSkipDecision(
  classification: ReturnType<typeof classifyFailure>,
  reason: string,
): ReflectionDecision {
  return {
    decision:     "abort",
    classification,
    patchPlan:    { actions: [{ type: "abort", reason }], estimatedFixMs: 0, restartNeeded: false, rollbackFirst: false, summary: reason },
    retryAllowed: false,
    retryDelayMs: 0,
    reason,
  };
}

function _buildEscalateDecision(
  classification: ReturnType<typeof classifyFailure>,
): ReflectionDecision {
  const reason = `Escalating — repeated ${classification.primary} failure without resolution`;
  return {
    decision:     "escalate",
    classification,
    patchPlan:    { actions: [{ type: "escalate", reason }], estimatedFixMs: 0, restartNeeded: false, rollbackFirst: false, summary: reason },
    retryAllowed: false,
    retryDelayMs: 0,
    reason,
  };
}
