/**
 * server/orchestration/events/event-publisher.ts
 *
 * Coordinates runtime event publishing for the orchestration layer.
 * Routes orchestration lifecycle events into the infrastructure bus
 * and emits telemetry propagation signals.
 *
 * Orchestration-only — no tool execution, no filesystem access.
 */

import { bus } from '../../infrastructure/index.ts';
import { now } from '../utils/orchestration-utils.ts';
import { ORCH_EVENTS } from './orchestration-events.ts';
import type {
  OrchestrationContext,
  PhaseResult,
  WorkflowResult,
  EscalationRecord,
  AgentType,
} from '../types/orchestration.types.ts';

// ── Orchestration lifecycle ───────────────────────────────────────────────────

export function publishOrchestrationStarted(ctx: OrchestrationContext): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.ORCHESTRATION_STARTED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    projectId:       ctx.projectId,
    sessionId:       ctx.sessionId,
    timestamp:       now().toISOString(),
    phase:           'orchestration',
    message:         `Orchestration started — session ${ctx.sessionId}`,
  } as never);
}

export function publishOrchestrationCompleted(
  ctx:        OrchestrationContext,
  durationMs: number,
  done:       number,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.ORCHESTRATION_COMPLETED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    sessionId:       ctx.sessionId,
    durationMs,
    workflowsDone:   done,
    timestamp:       now().toISOString(),
    phase:           'orchestration',
    message:         `Orchestration completed — ${done} workflow(s) in ${durationMs}ms`,
  } as never);
}

export function publishOrchestrationFailed(
  ctx:   OrchestrationContext,
  error: string,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.ORCHESTRATION_FAILED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    sessionId:       ctx.sessionId,
    error,
    timestamp:       now().toISOString(),
    phase:           'orchestration',
    message:         `Orchestration failed — ${error}`,
  } as never);
}

// ── Workflow lifecycle ────────────────────────────────────────────────────────

export function publishWorkflowStarted(
  ctx:          OrchestrationContext,
  workflowId:   string,
  workflowName: string,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.WORKFLOW_STARTED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId,
    workflowName,
    timestamp:       now().toISOString(),
    phase:           'workflow',
    message:         `Workflow started — ${workflowName}`,
  } as never);
}

export function publishWorkflowCompleted(
  ctx:        OrchestrationContext,
  result:     WorkflowResult,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.WORKFLOW_COMPLETED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId:      result.workflowId,
    durationMs:      result.durationMs,
    timestamp:       now().toISOString(),
    phase:           'workflow',
    message:         `Workflow completed in ${result.durationMs}ms`,
  } as never);
}

export function publishWorkflowFailed(
  ctx:        OrchestrationContext,
  workflowId: string,
  error:      string,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.WORKFLOW_FAILED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId,
    error,
    timestamp:       now().toISOString(),
    phase:           'workflow',
    message:         `Workflow failed — ${error}`,
  } as never);
}

// ── Phase lifecycle ───────────────────────────────────────────────────────────

export function publishPhaseStarted(
  ctx:        OrchestrationContext,
  workflowId: string,
  phaseId:    string,
  phaseName:  string,
  agentType:  AgentType,
  attempt:    number,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.PHASE_STARTED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId,
    phaseId,
    phaseName,
    agentType,
    attempt,
    timestamp:       now().toISOString(),
    phase:           'phase',
    message:         `Phase [${phaseName}] started via agent:${agentType} (attempt ${attempt})`,
  } as never);
}

export function publishPhaseCompleted(
  ctx:        OrchestrationContext,
  workflowId: string,
  result:     PhaseResult,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.PHASE_COMPLETED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId,
    phaseId:         result.phaseId,
    durationMs:      result.durationMs,
    timestamp:       now().toISOString(),
    phase:           'phase',
    message:         `Phase [${result.phaseId}] completed in ${result.durationMs}ms`,
  } as never);
}

export function publishPhaseFailed(
  ctx:        OrchestrationContext,
  workflowId: string,
  phaseId:    string,
  error:      string,
  attempt:    number,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.PHASE_FAILED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    workflowId,
    phaseId,
    error,
    attempt,
    timestamp:       now().toISOString(),
    phase:           'phase',
    message:         `Phase [${phaseId}] failed (attempt ${attempt}) — ${error}`,
  } as never);
}

// ── Escalation ────────────────────────────────────────────────────────────────

export function publishEscalationTriggered(record: EscalationRecord): void {
  bus.emit('agent.event', {
    type:      ORCH_EVENTS.ESCALATION_TRIGGERED,
    record,
    timestamp: now().toISOString(),
    phase:     'escalation',
    message:   `Escalation triggered — ${record.reason} (${record.failureCount} failures)`,
    runId:     record.runId,
  } as never);
}

// ── Recovery ──────────────────────────────────────────────────────────────────

export function publishRecoveryStarted(
  ctx:    OrchestrationContext,
  reason: string,
): void {
  bus.emit('agent.event', {
    type:            ORCH_EVENTS.RECOVERY_STARTED,
    orchestrationId: ctx.orchestrationId,
    runId:           ctx.runId,
    reason,
    timestamp:       now().toISOString(),
    phase:           'recovery',
    message:         `Recovery started — ${reason}`,
  } as never);
}
