/**
 * orchestration-types.ts
 *
 * Single source of truth for all orchestration layer type definitions.
 * No local imports — zero circular dependency risk.
 */

// ── Orchestration Run Identity ─────────────────────────────────────────────

export type OrchestrationMode =
  | "tool-loop"
  | "planned"
  | "pipeline"
  | "dag"
  | "recovery";

export type OrchestrationPhase =
  | "observe"
  | "analyze"
  | "plan"
  | "decompose"
  | "route"
  | "execute"
  | "verify"
  | "reflect"
  | "score"
  | "learn"
  | "heal"
  | "complete"
  | "failed"
  | "cancelled";

export type OrchestrationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovering"
  | "replaying";

// ── Orchestration Context ─────────────────────────────────────────────────

export interface OrchestrationContext {
  runId:         string;
  projectId:     number;
  goal:          string;
  mode:          OrchestrationMode;
  sessionId?:    string;
  traceId:       string;
  parentRunId?:  string;
  maxSteps?:     number;
  maxRetries?:   number;
  replaySafe:    boolean;
  metadata:      Record<string, unknown>;
  startedAt:     number;
}

// ── Orchestration State ────────────────────────────────────────────────────

export interface OrchestrationState {
  runId:           string;
  projectId:       number;
  phase:           OrchestrationPhase;
  status:          OrchestrationStatus;
  mode:            OrchestrationMode;
  startedAt:       number;
  updatedAt:       number;
  completedAt?:    number;
  checkpointId?:   string;
  retryCount:      number;
  phaseHistory:    PhaseRecord[];
  errorLog:        ErrorRecord[];
  score?:          number;
}

export interface PhaseRecord {
  phase:      OrchestrationPhase;
  enteredAt:  number;
  exitedAt?:  number;
  durationMs?: number;
  outcome:    "success" | "failure" | "skipped" | "pending";
  notes?:     string;
}

export interface ErrorRecord {
  ts:        number;
  phase:     OrchestrationPhase;
  message:   string;
  code?:     string;
  retryable: boolean;
}

// ── Orchestration Checkpoint ───────────────────────────────────────────────

export interface OrchestrationCheckpoint {
  checkpointId:  string;
  runId:         string;
  projectId:     number;
  phase:         OrchestrationPhase;
  capturedAt:    number;
  contextSnapshot: Partial<OrchestrationContext>;
  stateSnapshot:   Partial<OrchestrationState>;
  replayable:    boolean;
}

// ── Orchestration Event Payloads ──────────────────────────────────────────

export interface OrchestrationLifecyclePayload {
  runId:       string;
  projectId:   number;
  phase:       OrchestrationPhase;
  status:      OrchestrationStatus;
  mode:        OrchestrationMode;
  traceId:     string;
  durationMs?: number;
  score?:      number;
  error?:      string;
  ts:          number;
}

export interface OrchestrationPhasePayload {
  runId:      string;
  projectId:  number;
  phase:      OrchestrationPhase;
  prevPhase?: OrchestrationPhase;
  outcome:    "success" | "failure" | "skipped";
  durationMs: number;
  notes?:     string;
  ts:         number;
}

export interface OrchestrationMetric {
  runId:        string;
  projectId:    number;
  metricName:   string;
  value:        number;
  unit:         string;
  tags:         Record<string, string>;
  ts:           number;
}

// ── Bridge Result Types ───────────────────────────────────────────────────

export interface BridgeResult<T = unknown> {
  success:    boolean;
  data?:      T;
  error?:     string;
  durationMs: number;
  retryable:  boolean;
}

export interface AgentCoordinationResult {
  agentName:  string;
  role:       string;
  outcome:    "success" | "failure" | "consensus_required" | "skipped";
  output?:    unknown;
  confidence: number;
  durationMs: number;
}

// ── Recovery Coordination ─────────────────────────────────────────────────

export type RecoveryStrategy =
  | "retry"
  | "rollback"
  | "checkpoint_restore"
  | "agent_handoff"
  | "circuit_break";

export interface RecoveryDecision {
  strategy:     RecoveryStrategy;
  maxAttempts:  number;
  backoffMs:    number;
  reason:       string;
  confidence:   number;
}

// ── Telemetry ─────────────────────────────────────────────────────────────

export interface TraceSpan {
  spanId:      string;
  traceId:     string;
  parentId?:   string;
  name:        string;
  startedAt:   number;
  endedAt?:    number;
  durationMs?: number;
  status:      "ok" | "error" | "timeout";
  tags:        Record<string, string | number | boolean>;
  events:      SpanEvent[];
}

export interface SpanEvent {
  name:    string;
  ts:      number;
  payload: Record<string, unknown>;
}
