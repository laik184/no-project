/**
 * server/engine/reflection/reflection-events.ts
 *
 * Structured event emitters for the Reflection Engine pipeline.
 *
 * Single responsibility: emit reflection lifecycle events to the bus.
 * No logic, no state, no side effects beyond bus.emit().
 *
 * All events are emitted as "agent.event" with a structured payload so they
 * fan-out through the existing SSE pipeline without requiring BusEvents changes.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type {
  ReflectionTrigger,
  ReflectionFailureClass,
  ReflectionDecisionType,
  ReflectionSeverity,
} from "./reflection-types.ts";

// ── Internal emit ─────────────────────────────────────────────────────────────

function emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "reflection",
    agentName: "reflection-engine",
    eventType: eventType as any,
    payload,
    ts:        Date.now(),
  });
}

// ── Public emitters ───────────────────────────────────────────────────────────

export function emitReflectionStarted(
  runId:     string,
  projectId: number,
  trigger:   ReflectionTrigger,
): void {
  console.log(`[reflection-engine] STARTED project=${projectId} trigger=${trigger} run=${runId.slice(0, 8)}`);
  emit(runId, projectId, "reflection.started", { trigger });
}

export function emitReflectionClassified(
  runId:       string,
  projectId:   number,
  primary:     ReflectionFailureClass,
  severity:    ReflectionSeverity,
  confidence:  number,
  retryable:   boolean,
): void {
  console.log(`[reflection-engine] CLASSIFIED project=${projectId} class=${primary} severity=${severity} confidence=${confidence.toFixed(2)}`);
  emit(runId, projectId, "reflection.classified", { primary, severity, confidence, retryable });
}

export function emitReflectionRetrying(
  runId:     string,
  projectId: number,
  attempt:   number,
  delayMs:   number,
  reason:    string,
): void {
  console.log(`[reflection-engine] RETRYING project=${projectId} attempt=${attempt} delayMs=${delayMs}`);
  emit(runId, projectId, "reflection.retrying", { attempt, delayMs, reason });
}

export function emitReflectionPatching(
  runId:     string,
  projectId: number,
  actions:   string[],
): void {
  console.log(`[reflection-engine] PATCHING project=${projectId} actions=[${actions.join(", ")}]`);
  emit(runId, projectId, "reflection.patching", { actions });
}

export function emitReflectionRollback(
  runId:     string,
  projectId: number,
  reason:    string,
): void {
  console.warn(`[reflection-engine] ROLLBACK project=${projectId} reason="${reason}"`);
  emit(runId, projectId, "reflection.rollback", { reason });
}

export function emitReflectionAborted(
  runId:     string,
  projectId: number,
  reason:    string,
): void {
  console.warn(`[reflection-engine] ABORTED project=${projectId} reason="${reason}"`);
  emit(runId, projectId, "reflection.aborted", { reason });
}

export function emitReflectionCompleted(
  runId:     string,
  projectId: number,
  decision:  ReflectionDecisionType,
  elapsedMs: number,
): void {
  console.log(`[reflection-engine] COMPLETED project=${projectId} decision=${decision} elapsed=${elapsedMs}ms`);
  emit(runId, projectId, "reflection.completed", { decision, elapsedMs });
}
