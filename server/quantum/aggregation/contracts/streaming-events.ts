/**
 * contracts/streaming-events.ts
 *
 * SSE event shape contracts — what streams over the wire to clients
 * and to the orchestration engine. Zero external imports.
 */

// ── Event type catalogue ───────────────────────────────────────────────────────

export type StreamingAggregationEventType =
  | "path.started"
  | "path.partial_result"
  | "path.completed"
  | "aggregation.partial"
  | "aggregation.merge"
  | "aggregation.conflict"
  | "aggregation.retry"
  | "aggregation.rollback"
  | "aggregation.collapse"
  | "aggregation.failed"
  | "aggregation.session_started"
  | "aggregation.session_closed"
  | "aggregation.checkpoint"
  | "aggregation.replay_started"
  | "aggregation.replay_completed";

// ── Envelope ──────────────────────────────────────────────────────────────────

export interface StreamingAggregationEvent {
  type:          StreamingAggregationEventType;
  sessionId:     string;
  runId:         string;
  projectId:     number;
  ts:            number;
  correlationId: string;
  payload:       Record<string, unknown>;
}

// ── Typed payloads ────────────────────────────────────────────────────────────

export interface SessionStartedPayload {
  sessionId:    string;
  totalPaths:   number;
  timeoutMs:    number;
  replayEnabled: boolean;
}

export interface PathArrivedPayload {
  pathId:        string;
  success:       boolean;
  confidence:    number;
  arrivedPaths:  number;
  totalPaths:    number;
  verificationPassed: boolean;
}

export interface PartialResultPayload {
  sessionId:        string;
  arrivedPaths:     number;
  totalPaths:       number;
  successPaths:     number;
  topConfidence:    number;
  topPathId?:       string;
  conflicts:        number;
  phase:            string;
}

export interface MergePayload {
  filePath:   string;
  strategy:   string;
  winnerId:   string;
  confidence: number;
}

export interface ConflictPayload {
  conflictId: string;
  filePath:   string;
  ownerA:     string;
  ownerB:     string;
  strategy:   string;
  resolved:   boolean;
}

export interface RetryPayload {
  sessionId:   string;
  attempt:     number;
  reason:      string;
  phase:       string;
}

export interface RollbackPayload {
  sessionId:    string;
  checkpointId: string;
  reason:       string;
}

export interface CollapsePayload {
  sessionId:        string;
  winnerPathId:     string;
  winnerConfidence: number;
  totalPaths:       number;
  successPaths:     number;
  durationMs:       number;
  deterministic:    boolean;
  replayValidated:  boolean;
}

export interface FailurePayload {
  sessionId: string;
  reason:    string;
  phase:     string;
}

export interface CheckpointPayload {
  checkpointId: string;
  sessionId:    string;
  arrivedPaths: number;
  replayable:   boolean;
}

export interface ReplayPayload {
  sessionId:    string;
  checkpointId: string;
  eventsCount:  number;
}
