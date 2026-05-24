/**
 * contracts/aggregation.interfaces.ts
 *
 * Interface contracts for all 10 streaming aggregation modules.
 * Ensures low coupling — modules communicate through these contracts only.
 */

import type {
  StreamingSessionId,
  StreamingPathEvent,
  PartialAggregationState,
  AggregationCheckpoint,
  CollapseResult,
  StreamingConflict,
  StreamingSessionConfig,
} from "./aggregation.types.ts";

// ── 1. PartialAggregationBuffer ───────────────────────────────────────────────

export interface IPartialAggregationBuffer {
  push(event: StreamingPathEvent): PartialAggregationState;
  getState(sessionId: StreamingSessionId): PartialAggregationState | undefined;
  snapshot(sessionId: StreamingSessionId): PartialAggregationState | undefined;
  clear(sessionId: StreamingSessionId): void;
}

// ── 2. IncrementalReducer ─────────────────────────────────────────────────────

export interface IIncrementalReducer {
  reduce(
    current: PartialAggregationState,
    event: StreamingPathEvent,
  ): PartialAggregationState;
  reset(sessionId: StreamingSessionId): void;
}

// ── 3. ConfidenceReducer (sub-reducer, used by IncrementalReducer) ────────────

export interface IConfidenceReducer {
  score(events: StreamingPathEvent[]): { topPathId: string; topConfidence: number };
}

// ── 4. StreamingConflictResolver ──────────────────────────────────────────────

export interface IStreamingConflictResolver {
  detect(
    eventA: StreamingPathEvent,
    eventB: StreamingPathEvent,
  ): StreamingConflict | null;
  resolve(conflict: StreamingConflict): StreamingConflict;
  resolveAll(sessionId: StreamingSessionId): StreamingConflict[];
  getUnresolved(sessionId: StreamingSessionId): StreamingConflict[];
  rollback(sessionId: StreamingSessionId): void;
}

// ── 5. IncrementalResultPublisher ─────────────────────────────────────────────

export interface IIncrementalResultPublisher {
  publishPartial(state: PartialAggregationState): void;
  publishConflict(conflict: StreamingConflict): void;
  publishCollapse(result: CollapseResult): void;
  publishFailure(sessionId: string, runId: string, projectId: number, reason: string): void;
  publishRetry(sessionId: string, runId: string, projectId: number, attempt: number, reason: string): void;
  publishRollback(sessionId: string, runId: string, projectId: number, checkpointId: string, reason: string): void;
}

// ── 6. AggregationReplayManager ───────────────────────────────────────────────

export interface IAggregationReplayManager {
  startReplay(
    sessionId: StreamingSessionId,
    checkpoint: AggregationCheckpoint,
  ): Promise<PartialAggregationState>;
  getStatus(sessionId: StreamingSessionId): "idle" | "replaying" | "done" | "failed";
}

// ── 7. AggregationCheckpointStore ────────────────────────────────────────────

export interface IAggregationCheckpointStore {
  save(checkpoint: AggregationCheckpoint): void;
  load(sessionId: StreamingSessionId): AggregationCheckpoint | undefined;
  loadAll(sessionId: StreamingSessionId): AggregationCheckpoint[];
  prune(sessionId: StreamingSessionId, keepLast?: number): void;
  clear(sessionId: StreamingSessionId): void;
}

// ── 8. AggregationTelemetryBridge ────────────────────────────────────────────

export interface IAggregationTelemetryBridge {
  emit(
    type: string,
    sessionId: string,
    runId: string,
    projectId: number,
    payload: Record<string, unknown>,
  ): void;
  recordLatency(metric: string, durationMs: number, tags?: Record<string, string>): void;
}

// ── 9. PartialVerificationTrigger ────────────────────────────────────────────

export interface IPartialVerificationTrigger {
  maybeTrigger(state: PartialAggregationState): void;
  reset(sessionId: StreamingSessionId): void;
}

// ── 10. FinalCollapseCoordinator ─────────────────────────────────────────────

export interface IFinalCollapseCoordinator {
  isReady(sessionId: StreamingSessionId): boolean;
  collapse(sessionId: StreamingSessionId, config: StreamingSessionConfig): CollapseResult;
}

// ── 11. StreamingAggregationCoordinator (top-level orchestrator) ──────────────

export interface IStreamingAggregationCoordinator {
  startSession(config: StreamingSessionConfig): void;
  reportPath(event: StreamingPathEvent): void;
  getState(sessionId: StreamingSessionId): PartialAggregationState | undefined;
  closeSession(sessionId: StreamingSessionId): void;
}
