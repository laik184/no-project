/**
 * server/agents/planner/types/planner.types.ts
 *
 * All shared type contracts for the planner agent orchestration layer.
 * Zero imports from the tool layer — types only.
 */

// ── Planning phases ───────────────────────────────────────────────────────────

export type PlanningPhase =
  | 'idle'
  | 'validating'
  | 'analyzing'
  | 'task-planning'
  | 'phase-planning'
  | 'dependency-resolution'
  | 'plan-building'
  | 'routing'
  | 'retrying'
  | 'completing'
  | 'failed';

export type PlanningStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted';

// ── Task priority ─────────────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

// ── Execution strategy ────────────────────────────────────────────────────────

export type ExecutionStrategy = 'sequential' | 'parallel' | 'wave' | 'pipeline';

// ── Planned task ──────────────────────────────────────────────────────────────

export interface PlannedTask {
  id:           string;
  label:        string;
  description:  string;
  phase:        number;
  priority:     TaskPriority;
  dependencies: string[];             // task IDs that must complete first
  toolName:     string;               // dispatcher tool to invoke
  input:        Record<string, unknown>;
  timeoutMs:    number;
  retryLimit:   number;
  estimatedMs?: number;
}

/**
 * PlanTask — the executor-facing view of a planned task.
 * Maps PlannedTask fields to the names the executor and queue expect.
 */
export interface PlanTask {
  id:           string;
  title:        string;
  description:  string;
  category:     string;
  priority:     TaskPriority;
  dependencies: string[];
  toolName:     string;
  input:        Record<string, unknown>;
  timeoutMs:    number;
  retryLimit:   number;
  estimatedMs?: number;
  phaseIndex:   number;
}

// ── Execution phase ───────────────────────────────────────────────────────────

export interface ExecutionPhase {
  index:       number;
  label:       string;
  tasks:       PlannedTask[];
  strategy:    ExecutionStrategy;
  canParallel: boolean;
}

// ── Validation results (attached to plan) ────────────────────────────────────

export interface PlanValidationResults {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Execution plan ────────────────────────────────────────────────────────────

export interface ExecutionPlan {
  planId:            string;
  runId:             string;
  projectId:         string;
  goal:              string;
  phases:            ExecutionPhase[];
  /** Flat ordered list of all tasks — used by the executor queue. */
  tasks:             PlanTask[];
  totalTasks:        number;
  estimatedMs:       number;
  createdAt:         number;
  meta:              Record<string, unknown>;
  /** Derived application type (e.g. "web", "api", "fullstack"). */
  appType:           string;
  /** Derived complexity label (e.g. "simple", "moderate", "complex"). */
  complexity:        string;
  /** Validation results from the plan integrity check. */
  validationResults: PlanValidationResults;
}

// ── Planning request ──────────────────────────────────────────────────────────

export interface PlanningRequest {
  runId?:      string;
  projectId:   string;
  sandboxRoot: string;
  goal:        string;
  signal?:     AbortSignal;
  meta?:       Record<string, unknown>;
}

// ── Planning result ───────────────────────────────────────────────────────────

export interface PlanningResult {
  runId:       string;
  success:     boolean;
  plan?:       ExecutionPlan;
  durationMs:  number;
  errors:      string[];
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Retry ─────────────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export type RecoveryAction = 'retry' | 'skip' | 'abort' | 'escalate';

// ── Session meta ──────────────────────────────────────────────────────────────

export interface PlanningSessionMeta {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  goal:        string;
  startedAt:   Date;
  status:      PlanningStatus;
  phase:       PlanningPhase;
}

// ── Task outcome ──────────────────────────────────────────────────────────────

export interface PlanningTaskOutcome {
  taskId:     string;
  phase:      string;
  success:    boolean;
  durationMs: number;
  output?:    string;
  error?:     string;
  attempt:    number;
}

// ── Coordinator task ──────────────────────────────────────────────────────────

export interface CoordinatorTask {
  id:        string;
  label:     string;
  toolName:  string;
  input:     Record<string, unknown>;
  timeoutMs: number;
  priority:  TaskPriority;
}
