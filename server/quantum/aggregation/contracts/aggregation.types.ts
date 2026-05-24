/**
 * contracts/aggregation.types.ts
 *
 * Core domain types for the streaming aggregation layer.
 * Zero external imports — safe to import from any module without circular risk.
 */

// ── Identity ──────────────────────────────────────────────────────────────────

export type StreamingSessionId = string;

export type AggregationPhase =
  | "collecting"   // paths arriving
  | "reducing"     // incremental reducer running
  | "reconciling"  // conflict resolution active
  | "publishing"   // partial results streaming to consumers
  | "collapsing"   // final collapse in progress
  | "collapsed"    // terminal success
  | "failed"       // terminal failure
  | "replaying";   // recovering from checkpoint

export type ConflictResolutionStrategy = "union" | "precedence" | "confidence" | "ast_safe";

// ── Core streaming event (per arriving path) ──────────────────────────────────

export interface StreamingPathEvent {
  sessionId:          StreamingSessionId;
  runId:              string;
  projectId:          number;
  pathId:             string;
  success:            boolean;
  confidence:         number;
  filesWritten:       string[];
  durationMs:         number;
  retries:            number;
  verificationPassed: boolean;
  arrivedAt:          number;
  error?:             string;
}

// ── Partial aggregation state (rebuilt incrementally) ─────────────────────────

export interface PartialAggregationState {
  sessionId:         StreamingSessionId;
  runId:             string;
  projectId:         number;
  totalPaths:        number;
  arrivedPaths:      number;
  successPaths:      number;
  failedPaths:       number;
  topConfidence:     number;
  topPathId?:        string;
  conflicts:         number;
  resolvedConflicts: number;
  phase:             AggregationPhase;
  updatedAt:         number;
  mergedFiles:       string[];
  eventLog:          StreamingPathEvent[];
}

// ── Checkpoint (replay-safe snapshot) ────────────────────────────────────────

export interface AggregationCheckpoint {
  id:         string;
  sessionId:  StreamingSessionId;
  runId:      string;
  state:      PartialAggregationState;
  createdAt:  number;
  replayable: boolean;
}

// ── Final collapse result ─────────────────────────────────────────────────────

export interface CollapseResult {
  sessionId:         StreamingSessionId;
  runId:             string;
  projectId:         number;
  winnerPathId:      string;
  winnerConfidence:  number;
  totalPaths:        number;
  successPaths:      number;
  failedPaths:       number;
  conflicts:         number;
  resolvedConflicts: number;
  mergedFiles:       string[];
  collapsedAt:       number;
  durationMs:        number;
  deterministic:     boolean;
  replayValidated:   boolean;
}

// ── Conflict record ───────────────────────────────────────────────────────────

export interface StreamingConflict {
  id:          string;
  sessionId:   StreamingSessionId;
  filePath:    string;
  ownerA:      string;
  ownerB:      string;
  strategy:    ConflictResolutionStrategy;
  resolved:    boolean;
  resolvedAt?: number;
  detectedAt:  number;
}

// ── Session configuration ─────────────────────────────────────────────────────

export interface StreamingSessionConfig {
  sessionId:              StreamingSessionId;
  runId:                  string;
  projectId:              number;
  totalPaths:             number;
  earlyCollapseThreshold: number;
  timeoutMs:              number;
  checkpointIntervalMs:   number;
  replayEnabled:          boolean;
}

// ── Reducer window ────────────────────────────────────────────────────────────

export interface ReducerWindow {
  windowId:  string;
  sessionId: StreamingSessionId;
  maxEvents: number;
  events:    StreamingPathEvent[];
  openedAt:  number;
  closedAt?: number;
}
