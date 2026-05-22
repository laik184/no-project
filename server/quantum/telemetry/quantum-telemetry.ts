/**
 * quantum-telemetry.ts
 *
 * All telemetry emission for the Quantum Superposition Path System.
 * Integrates with the infrastructure bus + orchestration metrics.
 * Every path spawn, collapse, conflict, and completion MUST call this.
 */

import { bus } from "../../../server/infrastructure/events/bus.ts";
import { incrementCounter, recordDuration } from "../../orchestration/telemetry/orchestration-metrics.ts";
import type { ExecutionPath } from "../types/path.types.ts";
import type { PathConflict } from "../types/path.types.ts";

// ── Event type constants ──────────────────────────────────────────────────────

export const QUANTUM_EVENTS = {
  PATH_SPAWNED:        "quantum.path.spawned",
  PATH_STARTED:        "quantum.path.started",
  PATH_COMPLETED:      "quantum.path.completed",
  PATH_FAILED:         "quantum.path.failed",
  PATH_CANCELLED:      "quantum.path.cancelled",
  CONFLICT_DETECTED:   "quantum.conflict.detected",
  CONFLICT_RESOLVED:   "quantum.conflict.resolved",
  COLLAPSE_STARTED:    "quantum.collapse.started",
  COLLAPSE_COMPLETED:  "quantum.collapse.completed",
  COLLAPSE_FAILED:     "quantum.collapse.failed",
  RUN_STARTED:         "quantum.run.started",
  RUN_COMPLETED:       "quantum.run.completed",
  RUN_FAILED:          "quantum.run.failed",
} as const;

// ── Internal emit helper ──────────────────────────────────────────────────────

function emit(
  runId:     string,
  eventType: string,
  payload:   unknown,
): void {
  (bus as any).emit("agent.event", {
    runId,
    agentName: "quantum-engine",
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Path telemetry ────────────────────────────────────────────────────────────

export function telemetryPathSpawned(path: ExecutionPath, runId: string): void {
  incrementCounter("quantum.paths.spawned", { strategy: path.strategy });
  emit(runId, QUANTUM_EVENTS.PATH_SPAWNED, {
    pathId: path.pathId, strategy: path.strategyName,
  });
}

export function telemetryPathStarted(path: ExecutionPath, runId: string): void {
  incrementCounter("quantum.paths.started", { strategy: path.strategy });
  emit(runId, QUANTUM_EVENTS.PATH_STARTED, { pathId: path.pathId });
}

export function telemetryPathCompleted(path: ExecutionPath, runId: string): void {
  incrementCounter("quantum.paths.completed", {
    strategy: path.strategy,
    verified: String(path.verificationPassed),
  });
  recordDuration("quantum.path.duration_ms", path.telemetry.durationMs, {
    strategy: path.strategy,
  });
  emit(runId, QUANTUM_EVENTS.PATH_COMPLETED, {
    pathId: path.pathId,
    confidence: path.confidenceScore,
    verified: path.verificationPassed,
    durationMs: path.telemetry.durationMs,
  });
}

export function telemetryPathFailed(path: ExecutionPath, runId: string, reason: string): void {
  incrementCounter("quantum.paths.failed", { strategy: path.strategy });
  emit(runId, QUANTUM_EVENTS.PATH_FAILED, { pathId: path.pathId, reason });
}

// ── Conflict telemetry ────────────────────────────────────────────────────────

export function telemetryConflictDetected(conflict: PathConflict, runId: string): void {
  incrementCounter("quantum.conflicts.detected", { file: conflict.filePath.slice(-30) });
  emit(runId, QUANTUM_EVENTS.CONFLICT_DETECTED, {
    conflictId: conflict.conflictId,
    filePath: conflict.filePath,
    pathIds: conflict.pathIds,
  });
}

export function telemetryConflictResolved(
  conflict: PathConflict,
  runId:    string,
  strategy: string,
): void {
  incrementCounter("quantum.conflicts.resolved", { strategy });
  emit(runId, QUANTUM_EVENTS.CONFLICT_RESOLVED, {
    conflictId: conflict.conflictId,
    filePath: conflict.filePath,
    strategy,
    winner: conflict.winnerPathId,
  });
}

// ── Collapse telemetry ────────────────────────────────────────────────────────

export function telemetryCollapseStarted(quantumRunId: string, runId: string, pathCount: number): void {
  incrementCounter("quantum.collapse.started");
  emit(runId, QUANTUM_EVENTS.COLLAPSE_STARTED, { quantumRunId, pathCount });
}

export function telemetryCollapseCompleted(
  quantumRunId: string, runId: string,
  durationMs: number, winnerId: string,
): void {
  incrementCounter("quantum.collapse.completed");
  recordDuration("quantum.collapse.duration_ms", durationMs);
  emit(runId, QUANTUM_EVENTS.COLLAPSE_COMPLETED, { quantumRunId, winnerId, durationMs });
}

// ── Run telemetry ─────────────────────────────────────────────────────────────

export function telemetryRunStarted(quantumRunId: string, runId: string, pathCount: number): void {
  incrementCounter("quantum.runs.started");
  emit(runId, QUANTUM_EVENTS.RUN_STARTED, { quantumRunId, pathCount });
}

export function telemetryRunCompleted(quantumRunId: string, runId: string, durationMs: number): void {
  incrementCounter("quantum.runs.completed");
  recordDuration("quantum.run.duration_ms", durationMs);
  emit(runId, QUANTUM_EVENTS.RUN_COMPLETED, { quantumRunId, durationMs });
}

export function telemetryRunFailed(quantumRunId: string, runId: string, reason: string): void {
  incrementCounter("quantum.runs.failed");
  emit(runId, QUANTUM_EVENTS.RUN_FAILED, { quantumRunId, reason });
}
