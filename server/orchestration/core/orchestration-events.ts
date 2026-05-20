/**
 * orchestration-events.ts
 *
 * Extends the existing event bus with orchestration-specific events.
 * Provides typed emit helpers so callers never raw-emit.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type {
  OrchestrationLifecyclePayload,
  OrchestrationPhasePayload,
  OrchestrationMetric,
  OrchestrationPhase,
  OrchestrationStatus,
  OrchestrationMode,
} from "./orchestration-types.ts";

// ── Emit helpers ──────────────────────────────────────────────────────────────

export function emitOrchestrationLifecycle(
  payload: Omit<OrchestrationLifecyclePayload, "ts">,
): void {
  bus.emit("agent.event", {
    runId:     payload.runId,
    projectId: payload.projectId,
    phase:     "orchestration",
    agentName: "orchestration-engine",
    eventType: `orchestration.${payload.status}`,
    payload:   { ...payload, ts: Date.now() },
    ts:        Date.now(),
  });
}

export function emitPhaseTransition(
  payload: Omit<OrchestrationPhasePayload, "ts">,
): void {
  bus.emit("agent.event", {
    runId:     payload.runId,
    projectId: payload.projectId,
    phase:     "orchestration",
    agentName: "orchestration-engine",
    eventType: `phase.${payload.phase}.${payload.outcome}`,
    payload:   { ...payload, ts: Date.now() },
    ts:        Date.now(),
  });
}

export function emitOrchestrationMetric(metric: OrchestrationMetric): void {
  bus.emit("agent.event", {
    runId:     metric.runId,
    projectId: metric.projectId,
    phase:     "orchestration.telemetry",
    agentName: "orchestration-metrics",
    eventType: `metric.${metric.metricName}`,
    payload:   metric,
    ts:        metric.ts,
  });
}

export function emitOrchestrationError(opts: {
  runId:     string;
  projectId: number;
  phase:     OrchestrationPhase;
  error:     string;
  retryable: boolean;
}): void {
  bus.emit("agent.event", {
    runId:     opts.runId,
    projectId: opts.projectId,
    phase:     "orchestration",
    agentName: "orchestration-engine",
    eventType: "orchestration.error",
    payload:   { ...opts, ts: Date.now() },
    ts:        Date.now(),
  });
}

export function emitOrchestrationCheckpoint(opts: {
  runId:        string;
  projectId:    number;
  checkpointId: string;
  phase:        OrchestrationPhase;
}): void {
  bus.emit("checkpoint.event", {
    eventType:    "orchestration.checkpoint.created",
    checkpointId: opts.checkpointId,
    projectId:    opts.projectId,
    runId:        opts.runId,
    trigger:      `phase:${opts.phase}`,
    ts:           Date.now(),
  });
}

export function emitAgentCoordination(opts: {
  runId:     string;
  projectId: number;
  agentName: string;
  role:      string;
  outcome:   string;
  phase:     OrchestrationPhase;
}): void {
  bus.emit("agent.event", {
    runId:     opts.runId,
    projectId: opts.projectId,
    phase:     "orchestration.agents",
    agentName: opts.agentName,
    eventType: `agent.coordination.${opts.outcome}`,
    payload:   opts,
    ts:        Date.now(),
  });
}

// ── Bus subscription helpers ──────────────────────────────────────────────────

export function onOrchestrationEvent(
  runId: string,
  handler: (eventType: string, payload: unknown) => void,
): () => void {
  return bus.subscribe("agent.event", (e) => {
    if (e.runId !== runId || e.phase !== "orchestration") return;
    handler(e.eventType, e.payload);
  });
}

export function onRunLifecycle(
  handler: (status: OrchestrationStatus, runId: string, projectId: number) => void,
): () => void {
  return bus.subscribe("run.lifecycle", (e) => {
    handler(e.status as OrchestrationStatus, e.runId, e.projectId);
  });
}

export function onRuntimeSync(
  projectId: number,
  handler: (phase: string, healthy: boolean) => void,
): () => void {
  return bus.subscribe("runtime.sync", (e) => {
    if (e.projectId !== projectId) return;
    handler(e.snapshot.phase, e.snapshot.healthy);
  });
}

export function onCheckpointEvent(
  projectId: number,
  handler: (eventType: string, checkpointId?: string) => void,
): () => void {
  return bus.subscribe("checkpoint.event", (e) => {
    if (e.projectId !== projectId) return;
    handler(e.eventType, e.checkpointId);
  });
}
