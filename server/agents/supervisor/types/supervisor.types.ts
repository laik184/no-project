/**
 * server/agents/supervisor/types/supervisor.types.ts
 *
 * All shared types for the supervisor agent orchestration layer.
 * Zero imports from the tool layer — types only.
 */

// ── Supervision phases ────────────────────────────────────────────────────────

export type SupervisionPhase =
  | 'idle'
  | 'validating'
  | 'routing'
  | 'supervising'
  | 'retrying'
  | 'escalating'
  | 'completing'
  | 'failed';

export type SupervisionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

// ── Agent domain routing ──────────────────────────────────────────────────────

export type AgentDomain =
  | 'planner'
  | 'executor'
  | 'verifier'
  | 'browser'
  | 'filesystem'
  | 'terminal';

// ── Supervision task ──────────────────────────────────────────────────────────

export interface SupervisionTask {
  id:          string;
  domain:      AgentDomain;
  label:       string;
  toolName:    string;
  input:       Record<string, unknown>;
  timeoutMs:   number;
  retryLimit:  number;
  priority:    'critical' | 'high' | 'normal' | 'low';
}

// ── Task outcome ──────────────────────────────────────────────────────────────

export interface TaskOutcome {
  taskId:     string;
  domain:     AgentDomain;
  success:    boolean;
  durationMs: number;
  output?:    string;
  error?:     string;
  attempt:    number;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Session & context ─────────────────────────────────────────────────────────

export interface SupervisionSessionMeta {
  runId:          string;
  projectId:      string;
  sandboxRoot:    string;
  goal:           string;
  startedAt:      Date;
  status:         SupervisionStatus;
  phase:          SupervisionPhase;
  totalTasks:     number;
  completedTasks: number;
  failedTasks:    number;
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export type RecoveryAction = 'retry' | 'skip' | 'abort' | 'escalate';

// ── Escalation ────────────────────────────────────────────────────────────────

export interface EscalationRecord {
  taskId:    string;
  domain:    AgentDomain;
  reason:    string;
  attempts:  number;
  timestamp: number;
}

// ── Supervision request ───────────────────────────────────────────────────────

export interface SupervisionRequest {
  runId?:      string;
  projectId:   string;
  sandboxRoot: string;
  goal:        string;
  tasks:       SupervisionTask[];
  signal?:     AbortSignal;
  meta?:       Record<string, unknown>;
}

// ── Supervision result ────────────────────────────────────────────────────────

export interface SupervisionResult {
  runId:      string;
  success:    boolean;
  durationMs: number;
  tasksRun:   number;
  errors:     string[];
}
