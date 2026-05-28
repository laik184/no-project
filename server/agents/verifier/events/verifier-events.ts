/**
 * events/verifier-events.ts
 * Event name constants and payload types for the verifier agent.
 */

import type { VerificationPhase, VerificationStatus } from '../types/verifier.types.ts';
import type { WorkflowKind } from '../types/workflow.types.ts';

export const VERIFIER_EVENT = {
  STARTED:       'verifier.started',
  COMPLETED:     'verifier.completed',
  FAILED:        'verifier.failed',
  CANCELLED:     'verifier.cancelled',
  PHASE_START:   'verifier.phase.start',
  PHASE_END:     'verifier.phase.end',
  PHASE_FAIL:    'verifier.phase.fail',
  PHASE_SKIP:    'verifier.phase.skip',
  STEP_DISPATCH: 'verifier.step.dispatch',
  STEP_COMPLETE: 'verifier.step.complete',
  STEP_FAIL:     'verifier.step.fail',
  RETRY:         'verifier.retry',
  RECOVERY:      'verifier.recovery',
} as const;

export type VerifierEventName = typeof VERIFIER_EVENT[keyof typeof VERIFIER_EVENT];

export interface VerifierStartedPayload {
  runId:     string;
  projectId: string;
  phases:    VerificationPhase[];
  timestamp: Date;
}

export interface VerifierCompletedPayload {
  runId:      string;
  projectId:  string;
  status:     VerificationStatus;
  durationMs: number;
  errorCount: number;
  timestamp:  Date;
}

export interface VerifierFailedPayload {
  runId:     string;
  projectId: string;
  phase?:    VerificationPhase;
  errors:    string[];
  timestamp: Date;
}

export interface PhaseEventPayload {
  runId:      string;
  phase:      VerificationPhase;
  durationMs?: number;
  errors?:    string[];
  timestamp:  Date;
}

export interface StepEventPayload {
  runId:      string;
  toolName:   string;
  phase:      VerificationPhase;
  durationMs?: number;
  error?:     string;
  timestamp:  Date;
}

export interface WorkflowEventPayload {
  runId:     string;
  kind:      WorkflowKind;
  status:    'start' | 'end' | 'fail';
  timestamp: Date;
}
