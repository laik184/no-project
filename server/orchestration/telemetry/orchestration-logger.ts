/**
 * server/orchestration/telemetry/orchestration-logger.ts
 *
 * Structured logging for orchestration lifecycle events.
 * Logs: started, completed, failed, retries, escalations.
 * No side effects beyond console output — no tool execution.
 */

import type { OrchestrationStatus, AgentType } from '../types/orchestration.types.ts';

const PREFIX = '[orchestration]';

function ts(): string {
  return new Date().toISOString();
}

// ── Orchestration lifecycle ───────────────────────────────────────────────────

export function logOrchestrationStarted(
  orchestrationId: string,
  runId:           string,
  projectId:       string,
): void {
  console.log(`${PREFIX} [${ts()}] STARTED orchestrationId=${orchestrationId} runId=${runId} projectId=${projectId}`);
}

export function logOrchestrationCompleted(
  orchestrationId: string,
  runId:           string,
  durationMs:      number,
  workflowsDone:   number,
): void {
  console.log(`${PREFIX} [${ts()}] COMPLETED orchestrationId=${orchestrationId} runId=${runId} durationMs=${durationMs} workflowsDone=${workflowsDone}`);
}

export function logOrchestrationFailed(
  orchestrationId: string,
  runId:           string,
  error:           string,
): void {
  console.error(`${PREFIX} [${ts()}] FAILED orchestrationId=${orchestrationId} runId=${runId} error="${error}"`);
}

export function logOrchestrationStatus(
  orchestrationId: string,
  runId:           string,
  status:          OrchestrationStatus,
): void {
  console.log(`${PREFIX} [${ts()}] STATUS orchestrationId=${orchestrationId} runId=${runId} status=${status}`);
}

// ── Workflow lifecycle ────────────────────────────────────────────────────────

export function logWorkflowStarted(
  orchestrationId: string,
  workflowId:      string,
  workflowName:    string,
): void {
  console.log(`${PREFIX} [${ts()}] WORKFLOW_STARTED orchestrationId=${orchestrationId} workflowId=${workflowId} name="${workflowName}"`);
}

export function logWorkflowCompleted(
  orchestrationId: string,
  workflowId:      string,
  durationMs:      number,
): void {
  console.log(`${PREFIX} [${ts()}] WORKFLOW_COMPLETED orchestrationId=${orchestrationId} workflowId=${workflowId} durationMs=${durationMs}`);
}

export function logWorkflowFailed(
  orchestrationId: string,
  workflowId:      string,
  error:           string,
): void {
  console.error(`${PREFIX} [${ts()}] WORKFLOW_FAILED orchestrationId=${orchestrationId} workflowId=${workflowId} error="${error}"`);
}

// ── Phase lifecycle ───────────────────────────────────────────────────────────

export function logPhaseStarted(
  orchestrationId: string,
  phaseId:         string,
  phaseName:       string,
  agentType:       AgentType,
  attempt:         number,
): void {
  console.log(`${PREFIX} [${ts()}] PHASE_STARTED orchestrationId=${orchestrationId} phaseId=${phaseId} name="${phaseName}" agent=${agentType} attempt=${attempt}`);
}

export function logPhaseCompleted(
  orchestrationId: string,
  phaseId:         string,
  durationMs:      number,
): void {
  console.log(`${PREFIX} [${ts()}] PHASE_COMPLETED orchestrationId=${orchestrationId} phaseId=${phaseId} durationMs=${durationMs}`);
}

export function logPhaseFailed(
  orchestrationId: string,
  phaseId:         string,
  error:           string,
  attempt:         number,
): void {
  console.error(`${PREFIX} [${ts()}] PHASE_FAILED orchestrationId=${orchestrationId} phaseId=${phaseId} attempt=${attempt} error="${error}"`);
}

export function logPhaseRetrying(
  orchestrationId: string,
  phaseId:         string,
  attempt:         number,
  delayMs:         number,
): void {
  console.warn(`${PREFIX} [${ts()}] PHASE_RETRYING orchestrationId=${orchestrationId} phaseId=${phaseId} attempt=${attempt} delayMs=${delayMs}`);
}

export function logPhaseSkipped(
  orchestrationId: string,
  phaseId:         string,
  reason:          string,
): void {
  console.warn(`${PREFIX} [${ts()}] PHASE_SKIPPED orchestrationId=${orchestrationId} phaseId=${phaseId} reason="${reason}"`);
}

// ── Escalation / Recovery ─────────────────────────────────────────────────────

export function logEscalationTriggered(
  orchestrationId: string,
  runId:           string,
  reason:          string,
  failureCount:    number,
): void {
  console.error(`${PREFIX} [${ts()}] ESCALATION orchestrationId=${orchestrationId} runId=${runId} reason="${reason}" failures=${failureCount}`);
}

export function logRecoveryStarted(
  orchestrationId: string,
  runId:           string,
  reason:          string,
): void {
  console.warn(`${PREFIX} [${ts()}] RECOVERY_STARTED orchestrationId=${orchestrationId} runId=${runId} reason="${reason}"`);
}

export function logRecoveryCompleted(
  orchestrationId: string,
  runId:           string,
): void {
  console.log(`${PREFIX} [${ts()}] RECOVERY_COMPLETED orchestrationId=${orchestrationId} runId=${runId}`);
}
