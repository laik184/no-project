/**
 * types/execution.types.ts
 * Execution and step-level types for orchestration.
 */

import type { VerificationPhase } from './verifier.types.ts';

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'retrying';

export interface ExecutionStep {
  id:          string;
  phase:       VerificationPhase;
  toolName:    string;
  input:       Record<string, unknown>;
  required:    boolean;
  timeoutMs:   number;
  retryPolicy: RetryConfig;
}

export interface RetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

export interface StepResult {
  stepId:     string;
  toolName:   string;
  status:     StepStatus;
  passed:     boolean;
  durationMs: number;
  attempts:   number;
  errors:     string[];
  warnings:   string[];
  data?:      unknown;
}

export interface ExecutionContext {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  phase:       VerificationPhase;
  attempt:     number;
  signal?:     AbortSignal;
  meta:        Record<string, unknown>;
}

export interface ExecutionPlan {
  runId:   string;
  steps:   ExecutionStep[];
  ordered: boolean;
}

export interface ExecutionSummary {
  runId:      string;
  total:      number;
  passed:     number;
  failed:     number;
  skipped:    number;
  durationMs: number;
  steps:      StepResult[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  delayMs:     500,
  backoff:     'linear',
};

export const DEFAULT_STEP_TIMEOUT_MS = 60_000;
