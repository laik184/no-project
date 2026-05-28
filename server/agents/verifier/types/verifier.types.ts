/**
 * server/agents/verifier/types/verifier.types.ts
 *
 * All shared types for the verifier agent orchestration layer.
 * Zero tool-layer imports — types only.
 */

import type { VerificationPhase, VerificationStatus } from '../../../tools/verifier/lib/verifier-types.ts';

export type { VerificationPhase, VerificationStatus };

// ── Verification phases (steps the loop drives) ───────────────────────────────

export type VerificationStepType =
  | 'run_build'
  | 'run_typecheck'
  | 'run_tests'
  | 'check_server_health'
  | 'validate_endpoints'
  | 'validate_runtime'
  | 'validate_dependencies'
  | 'validate_execution'
  | 'validate_output'
  | 'analyze_errors'
  | 'detect_root_causes'
  | 'build_diagnostics_report'
  | 'verifier_failure_recovery'
  | 'checkpoint';

export interface VerificationStep {
  id:          string;
  type:        VerificationStepType;
  phase:       VerificationPhase;
  label:       string;
  input:       Record<string, unknown>;
  timeoutMs:   number;
  retryLimit:  number;
  critical:    boolean;
}

export interface VerificationStepResult {
  stepId:     string;
  phase:      VerificationPhase;
  success:    boolean;
  durationMs: number;
  output?:    unknown;
  error?:     string;
  attempt:    number;
}

// ── Session lifecycle ──────────────────────────────────────────────────────────

export type VerifierLifecycleState =
  | 'idle' | 'validating' | 'executing' | 'retrying'
  | 'recovering' | 'completing' | 'failed' | 'aborted';

// ── Retry / recovery ──────────────────────────────────────────────────────────

export type RecoveryAction = 'retry' | 'skip' | 'abort';

export interface RetryPolicy {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Agent input / output ──────────────────────────────────────────────────────

export interface VerifierInput {
  runId:       string;
  projectId:   string;
  phases?:     VerificationPhase[];
  sandboxRoot?: string;
  port?:       number;
  timeoutMs?:  number;
}

export interface VerifierOutput {
  ok:         boolean;
  runId:      string;
  phases:     VerificationPhase[];
  steps:      VerificationStepResult[];
  durationMs: number;
  errors:     string[];
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface VerifierValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}
