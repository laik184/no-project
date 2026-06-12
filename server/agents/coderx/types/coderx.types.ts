/**
 * server/agents/coderx/types/coderx.types.ts
 *
 * All shared type contracts for the CoderX agent layer.
 * No runtime logic — types and interfaces only.
 */

// ── Coding task kinds ─────────────────────────────────────────────────────────

export type CodingTaskKind =
  | 'generate_component'
  | 'generate_route'
  | 'generate_schema'
  | 'generate_api_client'
  | 'generate_auth'
  | 'generate_middleware'
  | 'generate_error_handler'
  | 'generate_controller'
  | 'generate_rest_api'
  | 'refactor'
  | 'analyze'
  | 'validate';

// ── Step status ───────────────────────────────────────────────────────────────

export type CodingStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'skipped'
  | 'cancelled';

export type CodingSessionStatus =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed';

// ── Coding request ────────────────────────────────────────────────────────────

export interface CodingRequest {
  readonly requestId:   string;
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly userPrompt:  string;
  readonly context?:    Record<string, unknown>;
  readonly options?:    CoderXLoopOptions;
}

// ── Coding task (unit in the plan) ────────────────────────────────────────────

export interface CodingTask {
  readonly taskId:      string;
  readonly kind:        CodingTaskKind;
  readonly description: string;
  readonly input:       Record<string, unknown>;
  readonly dependsOn?:  string[];
  readonly optional?:   boolean;
}

// ── Coding plan ───────────────────────────────────────────────────────────────

export interface CodingPlan {
  readonly planId:      string;
  readonly requestId:   string;
  readonly tasks:       CodingTask[];
  readonly createdAt:   Date;
}

// ── Coding step (runtime dispatch unit) ──────────────────────────────────────

export interface CodingStep {
  readonly stepId:    string;
  readonly taskId:    string;
  readonly toolName:  string;
  readonly toolInput: Record<string, unknown>;
  readonly optional?: boolean;
}

// ── Runtime step wrapper ──────────────────────────────────────────────────────

export interface RuntimeCodingStep {
  readonly step:  CodingStep;
  status:         CodingStepStatus;
  retryCount:     number;
  startedAt?:     Date;
  completedAt?:   Date;
  output?:        unknown;
  error?:         string;
}

// ── Execution context ─────────────────────────────────────────────────────────

export interface CoderXExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly sessionId:   string;
  readonly requestId:   string;
  readonly memoryContext?: string;
  readonly signal?:     AbortSignal;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface CoderXSession {
  readonly sessionId:  string;
  readonly runId:      string;
  readonly projectId:  string;
  readonly requestId:  string;
  status:              CodingSessionStatus;
  readonly startedAt:  Date;
  endedAt?:            Date;
  tasksTotal:          number;
  tasksDone:           number;
}

// ── Agent input / result ──────────────────────────────────────────────────────

export interface CoderXAgentInput {
  readonly request: CodingRequest;
}

export interface CoderXAgentResult {
  ok:             boolean;
  runId:          string;
  sessionId:      string;
  requestId:      string;
  tasksTotal:     number;
  tasksCompleted: number;
  tasksFailed:    number;
  durationMs:     number;
  outputs:        CodingTaskOutput[];
  error?:         string;
}

// ── Task output ───────────────────────────────────────────────────────────────

export interface CodingTaskOutput {
  taskId:   string;
  kind:     CodingTaskKind;
  ok:       boolean;
  output?:  unknown;
  error?:   string;
  attempts: number;
}

// ── Loop options ──────────────────────────────────────────────────────────────

export interface CoderXLoopOptions {
  stopOnFailure?: boolean;
  retry?:         CoderXRetryConfig;
}

// ── Retry config ──────────────────────────────────────────────────────────────

export interface CoderXRetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Routed step ───────────────────────────────────────────────────────────────

export interface RoutedCodingStep {
  toolName:  string;
  toolInput: Record<string, unknown>;
}

// ── Failure record ────────────────────────────────────────────────────────────

export interface CodingFailureRecord {
  stepId:     string;
  taskId:     string;
  runId:      string;
  kind:       CodingTaskKind;
  toolName:   string;
  error:      string;
  retryCount: number;
  timestamp:  Date;
}

// ── Monitor snapshot ──────────────────────────────────────────────────────────

export interface CoderXMonitorSnapshot {
  runId:         string;
  sessionId:     string;
  status:        CodingSessionStatus;
  tasksTotal:    number;
  tasksDone:     number;
  activeStepId?: string;
  stuckStepId?:  string;
  progressPct:   number;
}

// ── Analysis result ───────────────────────────────────────────────────────────

export interface CodingTaskAnalysis {
  intent:       string;
  primaryKind:  CodingTaskKind;
  complexity:   'low' | 'medium' | 'high';
  dependencies: string[];
  constraints:  string[];
}

// ── Decision ──────────────────────────────────────────────────────────────────

export type DecisionOutcome = 'continue' | 'retry' | 'skip' | 'abort';

export interface DecisionResult {
  outcome:   DecisionOutcome;
  reason:    string;
  nextStepId?: string;
}

// ── Implementation plan ───────────────────────────────────────────────────────

export interface ImplementationPlan {
  readonly planId:    string;
  readonly strategy:  string;
  readonly phases:    ImplementationPhase[];
}

export interface ImplementationPhase {
  readonly phaseId:   string;
  readonly name:      string;
  readonly tasks:     CodingTask[];
  readonly parallel:  boolean;
}
