/**
 * supervisor-events.ts — Typed event emitter for supervisor bus.
 *
 * Emits: run.started, phase.started, phase.completed,
 *        phase.failed, loop.detected, run.completed
 */

import { EventEmitter } from 'events';
import type { SupervisorEventMap, SupervisorEventName } from './event-types.ts';
import type {
  SupervisorStartedPayload,
  SupervisorCyclePayload,
  LoopDetectedPayload,
  SupervisorShutdownPayload,
} from './event-types.ts';
import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type {
  ExecutionMode,
  GoalCategory,
  LoopRiskLevel,
  SupervisorStatus,
} from '../types/supervisor.types.ts';

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

export function emitLoopDetected(
  sessionId: string, runId: string, risk: LoopRiskLevel,
  pattern: string, occurrences: number,
): void {
  supervisorBus.emit('supervisor.loop.detected', { sessionId, runId, risk, pattern, occurrences, timestamp: new Date() });
}

export function emitSupervisorShutdown(
  sessionId: string, status: SupervisorStatus, activeSessions: number,
): void {
  supervisorBus.emit('supervisor.shutdown', { sessionId, status, activeSessions, timestamp: new Date() });
}
