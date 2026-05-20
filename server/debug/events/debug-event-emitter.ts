/**
 * debug-event-emitter.ts
 *
 * Typed wrappers for emitting autonomous-debug lifecycle events on the shared bus.
 *
 * All events are emitted as "agent.event" so SSE clients and the existing
 * event infrastructure receive them without modification.
 *
 * Event types emitted:
 *   debug.session.started      — a new debug session has begun
 *   debug.analysis.complete    — errors extracted and correlated
 *   debug.checkpoint.created   — files snapshotted before patching
 *   debug.patch.applied        — LLM recovery run completed
 *   debug.verify.complete      — post-patch verification finished
 *   debug.rollback.triggered   — patch worsened things; rolling back
 *   debug.rollback.complete    — rollback finished
 *   debug.escalation           — max attempts exceeded; human needed
 *
 * Ownership: autonomous-debug/events — single responsibility: bus emission.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type { DebugVerdict, ErrorCorrelation, EscalationEvent } from "../types/debug-types.ts";

// ─── Helper ───────────────────────────────────────────────────────────────────

function emit(projectId: number, eventType: string, payload: unknown): void {
  bus.emit("agent.event", {
    runId:     `debug-${projectId}`,
    projectId,
    phase:     "autonomous-debug",
    eventType: eventType as any,
    payload,
    ts: Date.now(),
  });
}

// ─── Emitters ─────────────────────────────────────────────────────────────────

export function emitSessionStarted(
  projectId: number,
  sessionId: string,
  errorType: string,
  attempt:   number,
): void {
  emit(projectId, "debug.session.started", { sessionId, errorType, attempt });
}

export function emitAnalysisComplete(
  projectId:    number,
  sessionId:    string,
  correlations: readonly ErrorCorrelation[],
  errorCount:   number,
): void {
  emit(projectId, "debug.analysis.complete", {
    sessionId,
    errorCount,
    correlations: correlations.map(c => ({
      errorType:       c.errorType,
      suggestedAction: c.suggestedAction,
      hint:            c.hint.slice(0, 200),
    })),
  });
}

export function emitCheckpointCreated(
  projectId: number,
  sessionId: string,
  fileCount: number,
): void {
  emit(projectId, "debug.checkpoint.created", { sessionId, fileCount });
}

export function emitPatchApplied(
  projectId: number,
  sessionId: string,
  success:   boolean,
  summary:   string,
  steps:     number,
): void {
  emit(projectId, "debug.patch.applied", { sessionId, success, summary: summary.slice(0, 300), steps });
}

export function emitVerifyComplete(
  projectId: number,
  sessionId: string,
  verdict:   DebugVerdict,
): void {
  emit(projectId, "debug.verify.complete", {
    sessionId,
    outcome:       verdict.outcome,
    healthy:       verdict.healthy,
    errorCount:    verdict.errorCount,
    portReachable: verdict.portReachable,
    summary:       verdict.summary.slice(0, 300),
  });
}

export function emitRollbackTriggered(
  projectId: number,
  sessionId: string,
  reason:    string,
): void {
  emit(projectId, "debug.rollback.triggered", { sessionId, reason: reason.slice(0, 300) });
}

export function emitRollbackComplete(
  projectId:     number,
  sessionId:     string,
  restoredCount: number,
  success:       boolean,
): void {
  emit(projectId, "debug.rollback.complete", { sessionId, restoredCount, success });
}

export function emitEscalation(ev: EscalationEvent): void {
  emit(ev.projectId, "debug.escalation", {
    sessionId:  ev.sessionId,
    reason:     ev.reason.slice(0, 400),
    attempts:   ev.attempts,
    lastError:  ev.lastError.slice(0, 300),
  });
}
