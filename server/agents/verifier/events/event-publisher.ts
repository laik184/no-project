/**
 * events/event-publisher.ts
 * Publishes verifier orchestration events onto the global infrastructure bus.
 */

import { bus } from '../../../infrastructure/events/bus.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import type { VerificationPhase, VerificationStatus } from '../types/verifier.types.ts';
import type { WorkflowKind } from '../types/workflow.types.ts';

function emit(runId: string, eventType: string, payload?: unknown): void {
  bus.emit('agent.event', {
    runId,
    agentName: 'verifier',
    eventType,
    payload,
    ts: Date.now(),
  });
}

export const eventPublisher = {
  verificationStarted(runId: string, projectId: string, phases: VerificationPhase[]): void {
    verifierLogger.info(runId, 'Verification started', { phases, projectId });
    emit(runId, 'verifier.started', { projectId, phases });
  },

  verificationCompleted(
    runId: string, projectId: string, status: VerificationStatus,
    durationMs: number, errorCount: number,
  ): void {
    verifierLogger.info(runId, 'Verification completed', { status, durationMs, errorCount });
    emit(runId, 'verifier.completed', { projectId, status, durationMs, errorCount });
  },

  verificationFailed(runId: string, projectId: string, errors: string[], phase?: VerificationPhase): void {
    verifierLogger.error(runId, 'Verification failed', { phase, errors: errors.slice(0, 3) });
    emit(runId, 'verifier.failed', { projectId, phase, errors });
  },

  phaseStarted(runId: string, phase: VerificationPhase): void {
    verifierLogger.phase(runId, phase, 'start');
    emit(runId, 'verifier.phase.start', { phase });
  },

  phaseCompleted(runId: string, phase: VerificationPhase, durationMs: number): void {
    verifierLogger.phase(runId, phase, 'end', { durationMs });
    emit(runId, 'verifier.phase.end', { phase, durationMs });
  },

  phaseFailed(runId: string, phase: VerificationPhase, errors: string[], durationMs: number): void {
    verifierLogger.phase(runId, phase, 'fail', { errors: errors.slice(0, 3) });
    emit(runId, 'verifier.phase.fail', { phase, errors, durationMs });
  },

  phaseSkipped(runId: string, phase: VerificationPhase): void {
    verifierLogger.phase(runId, phase, 'skip');
    emit(runId, 'verifier.phase.skip', { phase });
  },

  stepDispatched(runId: string, toolName: string, phase: VerificationPhase): void {
    verifierLogger.step(runId, toolName, 'dispatch', { phase });
    emit(runId, 'verifier.step.dispatch', { toolName, phase });
  },

  stepCompleted(runId: string, toolName: string, phase: VerificationPhase, durationMs: number): void {
    verifierLogger.step(runId, toolName, 'complete', { durationMs });
    emit(runId, 'verifier.step.complete', { toolName, phase, durationMs });
  },

  stepFailed(runId: string, toolName: string, phase: VerificationPhase, error: string): void {
    verifierLogger.step(runId, toolName, 'fail', { error });
    emit(runId, 'verifier.step.fail', { toolName, phase, error });
  },

  retryScheduled(runId: string, toolName: string, attempt: number, delayMs: number): void {
    verifierLogger.step(runId, toolName, 'retry', { attempt, delayMs });
    emit(runId, 'verifier.retry', { toolName, attempt, delayMs });
  },

  workflowLifecycle(runId: string, projectId: string, kind: WorkflowKind, event: 'start' | 'end' | 'fail'): void {
    verifierLogger.workflow(runId, kind, event);
    emit(runId, `workflow.${kind}.${event}`, { projectId, kind });
  },
};
