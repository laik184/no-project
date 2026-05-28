/**
 * types/verifier.types.ts
 * Core types for the Verifier orchestration agent.
 * No imports from execution layers — foundation only.
 */

export type VerificationStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type VerificationPhase =
  | 'dependencies'
  | 'typecheck'
  | 'build'
  | 'runtime'
  | 'endpoints'
  | 'tests'
  | 'validation';

export interface EndpointSpec {
  path:           string;
  method:         'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  expectedStatus: number;
  body?:          unknown;
  headers?:       Record<string, string>;
}

export interface VerificationInput {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  phases:      VerificationPhase[];
  timeoutMs?:  number;
  endpoints?:  EndpointSpec[];
  port?:       number;
  abortSignal?: AbortSignal;
}

export interface PhaseResult {
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
  warnings:   string[];
  output?:    string;
  metadata?:  Record<string, unknown>;
}

export interface VerificationResult {
  runId:         string;
  projectId:     string;
  overallStatus: VerificationStatus;
  phases:        PhaseResult[];
  startedAt:     Date;
  completedAt:   Date;
  durationMs:    number;
  errorCount:    number;
  warningCount:  number;
}

export interface VerificationConfig {
  maxRetries:     number;
  retryDelayMs:   number;
  phaseTimeoutMs: number;
  stopOnFailure:  boolean;
  parallelPhases: boolean;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  maxRetries:     2,
  retryDelayMs:   1000,
  phaseTimeoutMs: 120_000,
  stopOnFailure:  true,
  parallelPhases: false,
};

export interface VerificationSession {
  sessionId:  string;
  runId:      string;
  projectId:  string;
  phases:     VerificationPhase[];
  startedAt:  Date;
  status:     VerificationStatus;
  config:     VerificationConfig;
}
