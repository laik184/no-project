/**
 * server/orchestration/events/orchestration-events.ts
 *
 * Canonical event name constants and payload interfaces for the
 * orchestration layer. No runtime logic — definitions only.
 */

import type {
  OrchestrationStatus,
  PhaseStatus,
  WorkflowStatus,
  AgentType,
  EscalationRecord,
} from '../types/orchestration.types.ts';

// ── Event name constants ───────────────────────────────────────────────────────

export const ORCH_EVENTS = {
  WORKFLOW_STARTED:    'orchestration.workflow.started',
  WORKFLOW_COMPLETED:  'orchestration.workflow.completed',
  WORKFLOW_FAILED:     'orchestration.workflow.failed',

  PHASE_STARTED:       'orchestration.phase.started',
  PHASE_COMPLETED:     'orchestration.phase.completed',
  PHASE_FAILED:        'orchestration.phase.failed',
  PHASE_RETRYING:      'orchestration.phase.retrying',
  PHASE_SKIPPED:       'orchestration.phase.skipped',

  ORCHESTRATION_STARTED:   'orchestration.started',
  ORCHESTRATION_COMPLETED: 'orchestration.completed',
  ORCHESTRATION_FAILED:    'orchestration.failed',
  ORCHESTRATION_ESCALATED: 'orchestration.escalated',
  ORCHESTRATION_CANCELLED: 'orchestration.cancelled',

  ESCALATION_TRIGGERED: 'orchestration.escalation.triggered',
  RECOVERY_STARTED:     'orchestration.recovery.started',
  RECOVERY_COMPLETED:   'orchestration.recovery.completed',
} as const;

export type OrchestrationEventName =
  typeof ORCH_EVENTS[keyof typeof ORCH_EVENTS];

// ── Event payload interfaces ───────────────────────────────────────────────────

export interface OrchestrationStartedEvent {
  readonly type:            typeof ORCH_EVENTS.ORCHESTRATION_STARTED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly projectId:       string;
  readonly sessionId:       string;
  readonly timestamp:       Date;
}

export interface OrchestrationCompletedEvent {
  readonly type:            typeof ORCH_EVENTS.ORCHESTRATION_COMPLETED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly sessionId:       string;
  readonly durationMs:      number;
  readonly workflowsDone:   number;
  readonly timestamp:       Date;
}

export interface OrchestrationFailedEvent {
  readonly type:            typeof ORCH_EVENTS.ORCHESTRATION_FAILED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly sessionId:       string;
  readonly error:           string;
  readonly timestamp:       Date;
}

export interface WorkflowStartedEvent {
  readonly type:            typeof ORCH_EVENTS.WORKFLOW_STARTED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly workflowName:    string;
  readonly status:          WorkflowStatus;
  readonly timestamp:       Date;
}

export interface WorkflowCompletedEvent {
  readonly type:            typeof ORCH_EVENTS.WORKFLOW_COMPLETED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly durationMs:      number;
  readonly timestamp:       Date;
}

export interface WorkflowFailedEvent {
  readonly type:            typeof ORCH_EVENTS.WORKFLOW_FAILED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly error:           string;
  readonly timestamp:       Date;
}

export interface PhaseStartedEvent {
  readonly type:            typeof ORCH_EVENTS.PHASE_STARTED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly phaseId:         string;
  readonly phaseName:       string;
  readonly agentType:       AgentType;
  readonly status:          PhaseStatus;
  readonly attempt:         number;
  readonly timestamp:       Date;
}

export interface PhaseCompletedEvent {
  readonly type:            typeof ORCH_EVENTS.PHASE_COMPLETED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly phaseId:         string;
  readonly durationMs:      number;
  readonly timestamp:       Date;
}

export interface PhaseFailedEvent {
  readonly type:            typeof ORCH_EVENTS.PHASE_FAILED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly workflowId:      string;
  readonly phaseId:         string;
  readonly error:           string;
  readonly attempt:         number;
  readonly timestamp:       Date;
}

export interface EscalationTriggeredEvent {
  readonly type:       typeof ORCH_EVENTS.ESCALATION_TRIGGERED;
  readonly record:     EscalationRecord;
  readonly timestamp:  Date;
}

export interface RecoveryStartedEvent {
  readonly type:            typeof ORCH_EVENTS.RECOVERY_STARTED;
  readonly orchestrationId: string;
  readonly runId:           string;
  readonly reason:          string;
  readonly timestamp:       Date;
}

// ── Union type ────────────────────────────────────────────────────────────────

export type OrchestrationEvent =
  | OrchestrationStartedEvent
  | OrchestrationCompletedEvent
  | OrchestrationFailedEvent
  | WorkflowStartedEvent
  | WorkflowCompletedEvent
  | WorkflowFailedEvent
  | PhaseStartedEvent
  | PhaseCompletedEvent
  | PhaseFailedEvent
  | EscalationTriggeredEvent
  | RecoveryStartedEvent;
