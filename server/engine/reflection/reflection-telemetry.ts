/**
 * server/engine/reflection/reflection-telemetry.ts
 *
 * Structured telemetry for the Reflection Engine.
 *
 * Single responsibility: collect and emit telemetry metrics.
 * No decision logic. No bus events (those live in reflection-events.ts).
 * Telemetry is emitted as bus "agent.event" with phase="reflection.telemetry".
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type { ReflectionFailureClass, ReflectionDecisionType, ReflectionTrigger } from "./reflection-types.ts";

// ── Session tracking ──────────────────────────────────────────────────────────

interface TelemetrySession {
  projectId:   number;
  runId:       string;
  trigger:     ReflectionTrigger;
  startedAt:   number;
  failureClass?: ReflectionFailureClass;
  decision?:   ReflectionDecisionType;
  retryCount:  number;
  patchCount:  number;
}

const _sessions = new Map<string, TelemetrySession>();

function sessionKey(projectId: number, runId: string): string {
  return `${projectId}:${runId}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function telemetrySessionStart(
  projectId: number,
  runId:     string,
  trigger:   ReflectionTrigger,
): void {
  _sessions.set(sessionKey(projectId, runId), {
    projectId, runId, trigger,
    startedAt:  Date.now(),
    retryCount: 0,
    patchCount: 0,
  });
}

export function telemetryRecordClassification(
  projectId:    number,
  runId:        string,
  failureClass: ReflectionFailureClass,
): void {
  const key = sessionKey(projectId, runId);
  const s   = _sessions.get(key);
  if (s) s.failureClass = failureClass;
}

export function telemetryRecordRetry(projectId: number, runId: string): void {
  const s = _sessions.get(sessionKey(projectId, runId));
  if (s) s.retryCount++;
}

export function telemetryRecordPatch(projectId: number, runId: string): void {
  const s = _sessions.get(sessionKey(projectId, runId));
  if (s) s.patchCount++;
}

export function telemetrySessionEnd(
  projectId: number,
  runId:     string,
  decision:  ReflectionDecisionType,
): void {
  const key = sessionKey(projectId, runId);
  const s   = _sessions.get(key);
  if (!s) return;

  s.decision = decision;
  const elapsedMs = Date.now() - s.startedAt;

  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "reflection.telemetry",
    agentName: "reflection-engine",
    eventType: "reflection.telemetry" as any,
    payload: {
      trigger:      s.trigger,
      failureClass: s.failureClass ?? "unknown",
      decision,
      elapsedMs,
      retryCount:   s.retryCount,
      patchCount:   s.patchCount,
    },
    ts: Date.now(),
  });

  _sessions.delete(key);
}

/** How many active reflection sessions exist (for diagnostics). */
export function activeTelemetrySessions(): number {
  return _sessions.size;
}
