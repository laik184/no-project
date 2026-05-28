/**
 * server/orchestration/types/orchestration.types.ts
 *
 * All shared type contracts for the orchestration layer.
 * No runtime logic — types and interfaces only.
 * No imports from within orchestration/ to prevent circular deps.
 */

// ── Orchestration status ───────────────────────────────────────────────────────

export type OrchestrationStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'escalated'
  | 'cancelled';

export type PhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retrying';

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Retry config ───────────────────────────────────────────────────────────────

export interface OrchestrationRetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Orchestration request ──────────────────────────────────────────────────────

export interface OrchestrationRequest {
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly projectId:       string;
  readonly sandboxRoot:     string;
  readonly goal:            string;
  readonly context?:        Record<string, unknown>;
  readonly options?:        OrchestrationOptions;
}

export interface OrchestrationOptions {
  stopOnFailure?: boolean;
  maxRetries?:    number;
  timeoutMs?:     number;
  retry?:         OrchestrationRetryConfig;
}

// ── Context ────────────────────────────────────────────────────────────────────

export interface OrchestrationContext {
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly projectId:       string;
  readonly sandboxRoot:     string;
  readonly sessionId:       string;
  readonly startedAt:       Date;
  readonly signal?:         AbortSignal;
}

// ── Session ────────────────────────────────────────────────────────────────────

export interface OrchestrationSession {
  readonly sessionId:       string;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly projectId:       string;
  status:                   OrchestrationStatus;
  readonly startedAt:       Date;
  endedAt?:                 Date;
  workflowsTotal:           number;
  workflowsDone:            number;
}

// ── Workflow ───────────────────────────────────────────────────────────────────

export interface Workflow {
  readonly workflowId:  string;
  readonly name:        string;
  readonly phases:      Phase[];
  readonly dependsOn?:  string[];
  readonly parallel?:   boolean;
}

export interface Phase {
  readonly phaseId:    string;
  readonly name:       string;
  readonly agentType:  AgentType;
  readonly input:      Record<string, unknown>;
  readonly optional?:  boolean;
  readonly dependsOn?: string[];
}

// ── Execution plan ─────────────────────────────────────────────────────────────

export interface ExecutionPlan {
  readonly planId:     string;
  readonly requestId:  string;
  readonly workflows:  Workflow[];
  readonly createdAt:  Date;
}

// ── Agent types ────────────────────────────────────────────────────────────────

export type AgentType =
  | 'planner'
  | 'executor'
  | 'verifier'
  | 'browser'
  | 'filesystem'
  | 'terminal'
  | 'supervisor';

// ── Phase result ───────────────────────────────────────────────────────────────

export interface PhaseResult {
  readonly phaseId:    string;
  readonly agentType:  AgentType;
  ok:                  boolean;
  output?:             unknown;
  error?:              string;
  durationMs:          number;
  attempts:            number;
}

// ── Workflow result ────────────────────────────────────────────────────────────

export interface WorkflowResult {
  readonly workflowId:  string;
  ok:                   boolean;
  phaseResults:         PhaseResult[];
  durationMs:           number;
  error?:               string;
}

// ── Orchestration result ───────────────────────────────────────────────────────

export interface OrchestrationResult {
  ok:                   boolean;
  orchestrationId:      string;
  runId:                string;
  sessionId:            string;
  workflowsTotal:       number;
  workflowsCompleted:   number;
  workflowsFailed:      number;
  durationMs:           number;
  results:              WorkflowResult[];
  error?:               string;
}

// ── Failure record ─────────────────────────────────────────────────────────────

export interface OrchestrationFailure {
  orchestrationId: string;
  runId:           string;
  phaseId?:        string;
  workflowId?:     string;
  agentType?:      AgentType;
  error:           string;
  retryCount:      number;
  timestamp:       Date;
}

// ── Decision ───────────────────────────────────────────────────────────────────

export type DecisionOutcome = 'continue' | 'retry' | 'skip' | 'escalate' | 'abort';

export interface DecisionResult {
  outcome:      DecisionOutcome;
  reason:       string;
  nextPhaseId?: string;
}

// ── Monitor snapshot ───────────────────────────────────────────────────────────

export interface OrchestrationSnapshot {
  orchestrationId:  string;
  sessionId:        string;
  status:           OrchestrationStatus;
  workflowsTotal:   number;
  workflowsDone:    number;
  activeWorkflowId?: string;
  activePhaseId?:    string;
  progressPct:      number;
  stuckSince?:      Date;
}

// ── Lifecycle transition ───────────────────────────────────────────────────────

export type LifecycleTransition =
  | { from: 'idle';      to: 'planning'  }
  | { from: 'planning';  to: 'running'   }
  | { from: 'running';   to: 'completed' }
  | { from: 'running';   to: 'failed'    }
  | { from: 'running';   to: 'paused'    }
  | { from: 'paused';    to: 'running'   }
  | { from: 'running';   to: 'escalated' }
  | { from: 'running';   to: 'cancelled' }
  | { from: 'failed';    to: 'running'   };

// ── Escalation ────────────────────────────────────────────────────────────────

export interface EscalationRecord {
  orchestrationId: string;
  runId:           string;
  reason:          string;
  failureCount:    number;
  escalatedAt:     Date;
}

// ── Validation result ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
}
