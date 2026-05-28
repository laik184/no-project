/**
 * types/workflow.types.ts
 * Workflow-level types for verification orchestration.
 */

import type { VerificationPhase, VerificationStatus, EndpointSpec } from './verifier.types.ts';

export type WorkflowKind =
  | 'build'
  | 'runtime'
  | 'validation'
  | 'diagnostics'
  | 'recovery';

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowInput {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  kind:        WorkflowKind;
  timeoutMs?:  number;
  port?:       number;
  endpoints?:  EndpointSpec[];
  rawOutput?:  string;
  errors?:     string[];
  metadata?:   Record<string, unknown>;
}

export interface WorkflowResult {
  runId:      string;
  kind:       WorkflowKind;
  status:     WorkflowStatus;
  passed:     boolean;
  errors:     string[];
  warnings:   string[];
  durationMs: number;
  output?:    string;
  data?:      Record<string, unknown>;
}

export interface WorkflowStep {
  id:          string;
  toolName:    string;
  input:       Record<string, unknown>;
  required:    boolean;
  timeoutMs?:  number;
}

export interface WorkflowPlan {
  runId:   string;
  kind:    WorkflowKind;
  steps:   WorkflowStep[];
  phases:  VerificationPhase[];
}

export interface WorkflowState {
  runId:      string;
  kind:       WorkflowKind;
  status:     WorkflowStatus;
  phase:      VerificationPhase;
  completedSteps: string[];
  failedSteps:    string[];
  startedAt:  Date;
  updatedAt:  Date;
}
