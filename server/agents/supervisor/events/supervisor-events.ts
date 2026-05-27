import { EventEmitter } from 'events';
import type { SupervisorEventMap, SupervisorEventName } from './event-types.ts';
import type {
  SupervisorStartedPayload,
  SupervisorCyclePayload,
  SupervisorDecisionPayload,
  LoopDetectedPayload,
  EscalationPayload,
  SupervisorShutdownPayload,
} from './event-types.ts';
import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, GoalCategory, LoopRiskLevel, EscalationReason, SupervisorStatus } from '../types/supervisor.types.ts';

class TypedSupervisorEmitter extends EventEmitter {
  emit<K extends SupervisorEventName>(event: K, payload: SupervisorEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends SupervisorEventName>(event: K, listener: (p: SupervisorEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  once<K extends SupervisorEventName>(event: K, listener: (p: SupervisorEventMap[K]) => void): this {
    return super.once(event, listener);
  }
  off<K extends SupervisorEventName>(event: K, listener: (p: SupervisorEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const supervisorBus = new TypedSupervisorEmitter();
supervisorBus.setMaxListeners(30);

export function emitSupervisorStarted(
  sessionId: string, runId: string, projectId: string,
  mode: ExecutionMode, category: GoalCategory,
): void {
  supervisorBus.emit('supervisor.started', { sessionId, runId, projectId, mode, category, timestamp: new Date() });
}

export function emitCycleStarted(
  sessionId: string, runId: string, phase: OrchestrationPhase,
  durationMs = 0, retries = 0,
): void {
  supervisorBus.emit('supervisor.cycle.started', { sessionId, runId, phase, success: true, durationMs, retries, timestamp: new Date() });
}

export function emitCycleCompleted(
  sessionId: string, runId: string, phase: OrchestrationPhase,
  durationMs: number, retries: number,
): void {
  supervisorBus.emit('supervisor.cycle.completed', { sessionId, runId, phase, success: true, durationMs, retries, timestamp: new Date() });
}

export function emitCycleFailed(
  sessionId: string, runId: string, phase: OrchestrationPhase,
  durationMs: number, retries: number,
): void {
  supervisorBus.emit('supervisor.cycle.failed', { sessionId, runId, phase, success: false, durationMs, retries, timestamp: new Date() });
}

export function emitDecisionMade(
  sessionId: string, runId: string, action: string,
  reason: string, phase: OrchestrationPhase,
): void {
  supervisorBus.emit('supervisor.decision.made', { sessionId, runId, action, reason, phase, timestamp: new Date() });
}

export function emitLoopDetected(
  sessionId: string, runId: string, risk: LoopRiskLevel,
  pattern: string, occurrences: number,
): void {
  supervisorBus.emit('supervisor.loop.detected', { sessionId, runId, risk, pattern, occurrences, timestamp: new Date() });
}

export function emitEscalated(
  sessionId: string, runId: string, reason: EscalationReason,
  phase: OrchestrationPhase, retryCount: number,
): void {
  supervisorBus.emit('supervisor.escalated', { sessionId, runId, reason, phase, retryCount, timestamp: new Date() });
}

export function emitSupervisorShutdown(
  sessionId: string, status: SupervisorStatus, activeSessions: number,
): void {
  supervisorBus.emit('supervisor.shutdown', { sessionId, status, activeSessions, timestamp: new Date() });
}
