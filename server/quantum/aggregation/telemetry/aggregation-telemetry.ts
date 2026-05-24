/**
 * telemetry/aggregation-telemetry.ts
 *
 * Single-responsibility: emit all 10 canonical streaming aggregation
 * telemetry events onto the EventBus. No reduction logic, no state.
 */

import { bus }                from "../../../infrastructure/events/bus.ts";
import { AGG_EVENTS, buildCorrelationId } from "./aggregation-event-map.ts";
import type {
  PartialAggregationState,
  CollapseResult,
  StreamingConflict,
  StreamingSessionConfig,
} from "../contracts/aggregation.types.ts";

// ── Internal emitter ──────────────────────────────────────────────────────────

function emit(
  type:      string,
  sessionId: string,
  runId:     string,
  projectId: number,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "quantum.streaming",
    agentName: "streaming-aggregation",
    eventType: type,
    payload:   { sessionId, correlationId: buildCorrelationId(sessionId, type), ...payload },
    ts:        Date.now(),
  });
}

// ── Public emitters (one per canonical event) ─────────────────────────────────

export function emitSessionStarted(cfg: StreamingSessionConfig): void {
  emit(AGG_EVENTS.AGGREGATION_SESSION_STARTED, cfg.sessionId, cfg.runId, cfg.projectId, {
    totalPaths:             cfg.totalPaths,
    timeoutMs:              cfg.timeoutMs,
    replayEnabled:          cfg.replayEnabled,
    earlyCollapseThreshold: cfg.earlyCollapseThreshold,
  });
}

export function emitPathStarted(sessionId: string, runId: string, projectId: number, pathId: string): void {
  emit(AGG_EVENTS.PATH_STARTED, sessionId, runId, projectId, { pathId });
}

export function emitPathPartialResult(
  sessionId: string, runId: string, projectId: number,
  pathId: string, confidence: number, filesWritten: string[],
): void {
  emit(AGG_EVENTS.PATH_PARTIAL_RESULT, sessionId, runId, projectId, {
    pathId, confidence, filesWrittenCount: filesWritten.length,
  });
}

export function emitPathCompleted(
  sessionId: string, runId: string, projectId: number,
  pathId: string, success: boolean, verificationPassed: boolean,
): void {
  emit(AGG_EVENTS.PATH_COMPLETED, sessionId, runId, projectId, {
    pathId, success, verificationPassed,
  });
}

export function emitAggregationPartial(state: PartialAggregationState): void {
  emit(AGG_EVENTS.AGGREGATION_PARTIAL, state.sessionId, state.runId, state.projectId, {
    arrivedPaths:  state.arrivedPaths,
    totalPaths:    state.totalPaths,
    successPaths:  state.successPaths,
    topConfidence: state.topConfidence,
    topPathId:     state.topPathId,
    conflicts:     state.conflicts,
    phase:         state.phase,
  });
}

export function emitAggregationMerge(
  sessionId: string, runId: string, projectId: number,
  filePath: string, strategy: string, winnerId: string, confidence: number,
): void {
  emit(AGG_EVENTS.AGGREGATION_MERGE, sessionId, runId, projectId, {
    filePath, strategy, winnerId, confidence,
  });
}

export function emitAggregationConflict(conflict: StreamingConflict, runId: string, projectId: number): void {
  emit(AGG_EVENTS.AGGREGATION_CONFLICT, conflict.sessionId, runId, projectId, {
    conflictId: conflict.id,
    filePath:   conflict.filePath,
    ownerA:     conflict.ownerA,
    ownerB:     conflict.ownerB,
    strategy:   conflict.strategy,
    resolved:   conflict.resolved,
  });
}

export function emitAggregationRetry(
  sessionId: string, runId: string, projectId: number,
  attempt: number, reason: string, phase: string,
): void {
  emit(AGG_EVENTS.AGGREGATION_RETRY, sessionId, runId, projectId, { attempt, reason, phase });
}

export function emitAggregationRollback(
  sessionId: string, runId: string, projectId: number,
  checkpointId: string, reason: string,
): void {
  emit(AGG_EVENTS.AGGREGATION_ROLLBACK, sessionId, runId, projectId, { checkpointId, reason });
}

export function emitAggregationCollapse(result: CollapseResult): void {
  emit(AGG_EVENTS.AGGREGATION_COLLAPSE, result.sessionId, result.runId, result.projectId, {
    winnerPathId:     result.winnerPathId,
    winnerConfidence: result.winnerConfidence,
    totalPaths:       result.totalPaths,
    successPaths:     result.successPaths,
    durationMs:       result.durationMs,
    deterministic:    result.deterministic,
    replayValidated:  result.replayValidated,
  });
}

export function emitAggregationFailed(
  sessionId: string, runId: string, projectId: number,
  reason: string, phase: string,
): void {
  emit(AGG_EVENTS.AGGREGATION_FAILED, sessionId, runId, projectId, { reason, phase });
}

export function emitSessionClosed(sessionId: string, runId: string, projectId: number): void {
  emit(AGG_EVENTS.AGGREGATION_SESSION_CLOSED, sessionId, runId, projectId, {});
}
