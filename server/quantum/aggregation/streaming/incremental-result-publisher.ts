/**
 * streaming/incremental-result-publisher.ts
 *
 * Publishes partial and final aggregation results to:
 *   1. EventBus (SSE → frontend)
 *   2. Orchestration bus (confidence updates)
 *   3. Verification triggers (partial verification)
 *
 * Single responsibility: result publishing only. No reduction, no storage.
 */

import { bus }                      from "../../../infrastructure/events/bus.ts";
import type {
  PartialAggregationState,
  CollapseResult,
  StreamingConflict,
} from "../contracts/aggregation.types.ts";
import type { IIncrementalResultPublisher } from "../contracts/aggregation.interfaces.ts";
import {
  emitAggregationPartial,
  emitAggregationCollapse,
  emitAggregationConflict,
  emitAggregationFailed,
  emitAggregationRetry,
  emitAggregationRollback,
} from "../telemetry/aggregation-telemetry.ts";
import { recordPartialLatency } from "../telemetry/streaming-metrics.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORCHESTRATION_EVENT = "agent.event" as const;

// ── IncrementalResultPublisher ────────────────────────────────────────────────

export class IncrementalResultPublisher implements IIncrementalResultPublisher {

  // ── Partial publish (called after every path arrival) ─────────────────────

  publishPartial(state: PartialAggregationState): void {
    const start = Date.now();

    // 1. SSE → frontend via EventBus
    emitAggregationPartial(state);

    // 2. Orchestration confidence update
    bus.emit(ORCHESTRATION_EVENT, {
      runId:     state.runId,
      projectId: state.projectId,
      phase:     "quantum.streaming",
      agentName: "incremental-publisher",
      eventType: "orchestration.confidence_update",
      payload: {
        sessionId:     state.sessionId,
        topConfidence: state.topConfidence,
        topPathId:     state.topPathId,
        arrivedPaths:  state.arrivedPaths,
        totalPaths:    state.totalPaths,
        phase:         state.phase,
      },
      ts: Date.now(),
    });

    // 3. Preview progressive update
    bus.emit(ORCHESTRATION_EVENT, {
      runId:     state.runId,
      projectId: state.projectId,
      phase:     "quantum.streaming",
      agentName: "incremental-publisher",
      eventType: "preview.progressive_update",
      payload: {
        sessionId:    state.sessionId,
        confidence:   state.topConfidence,
        mergedFiles:  state.mergedFiles,
        arrivedPaths: state.arrivedPaths,
        totalPaths:   state.totalPaths,
      },
      ts: Date.now(),
    });

    recordPartialLatency(Date.now() - start, state.sessionId);
  }

  // ── Conflict publish ──────────────────────────────────────────────────────

  publishConflict(conflict: StreamingConflict): void {
    emitAggregationConflict(conflict, "", 0); // telemetry only; sessionId carried in conflict
  }

  // ── Collapse publish (final result) ───────────────────────────────────────

  publishCollapse(result: CollapseResult): void {
    emitAggregationCollapse(result);

    // Notify orchestration engine of final result
    bus.emit(ORCHESTRATION_EVENT, {
      runId:     result.runId,
      projectId: result.projectId,
      phase:     "quantum.streaming",
      agentName: "incremental-publisher",
      eventType: "orchestration.aggregation_complete",
      payload: {
        sessionId:        result.sessionId,
        winnerPathId:     result.winnerPathId,
        winnerConfidence: result.winnerConfidence,
        mergedFiles:      result.mergedFiles,
        deterministic:    result.deterministic,
        replayValidated:  result.replayValidated,
        durationMs:       result.durationMs,
      },
      ts: Date.now(),
    });
  }

  // ── Failure publish ───────────────────────────────────────────────────────

  publishFailure(
    sessionId: string,
    runId:     string,
    projectId: number,
    reason:    string,
  ): void {
    emitAggregationFailed(sessionId, runId, projectId, reason, "failed");
  }

  // ── Retry publish ─────────────────────────────────────────────────────────

  publishRetry(
    sessionId: string,
    runId:     string,
    projectId: number,
    attempt:   number,
    reason:    string,
  ): void {
    emitAggregationRetry(sessionId, runId, projectId, attempt, reason, "replaying");
  }

  // ── Rollback publish ──────────────────────────────────────────────────────

  publishRollback(
    sessionId:    string,
    runId:        string,
    projectId:    number,
    checkpointId: string,
    reason:       string,
  ): void {
    emitAggregationRollback(sessionId, runId, projectId, checkpointId, reason);
  }
}

export const resultPublisher = new IncrementalResultPublisher();
