import { EventEmitter } from 'events';
import type { OrchestrationEventMap, OrchestrationEventName } from './event-types.ts';

class TypedOrchestrationEmitter extends EventEmitter {
  emit<K extends OrchestrationEventName>(event: K, payload: OrchestrationEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends OrchestrationEventName>(event: K, listener: (payload: OrchestrationEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends OrchestrationEventName>(event: K, listener: (payload: OrchestrationEventMap[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends OrchestrationEventName>(event: K, listener: (payload: OrchestrationEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const orchestrationBus = new TypedOrchestrationEmitter();
orchestrationBus.setMaxListeners(50);

export function emitRunStarted(runId: string): void {
  orchestrationBus.emit('run.started', { runId, status: 'running', timestamp: new Date() });
}

export function emitRunCompleted(runId: string, durationMs: number): void {
  orchestrationBus.emit('run.completed', { runId, status: 'completed', durationMs, timestamp: new Date() });
}

export function emitRunFailed(runId: string, phase: import('./event-types.ts').OrchestrationPhase, error: string, recoverable = false): void {
  orchestrationBus.emit('run.failed', { runId, phase, error, recoverable, timestamp: new Date() });
}

export function emitPhaseStarted(runId: string, phase: import('./event-types.ts').OrchestrationPhase): void {
  orchestrationBus.emit('phase.started', { runId, phase, timestamp: new Date() });
}

export function emitPhaseCompleted(result: import('./event-types.ts').PhaseResult & { runId?: string }): void {
  orchestrationBus.emit('phase.completed', result as import('./event-types.ts').PhaseResult);
}

export function emitTaskQueued(task: import('./event-types.ts').TaskPayload): void {
  orchestrationBus.emit('task.queued', task);
}

export function emitTaskStarted(task: import('./event-types.ts').TaskPayload): void {
  orchestrationBus.emit('task.started', task);
}

export function emitTaskCompleted(task: import('./event-types.ts').TaskPayload, result: unknown): void {
  orchestrationBus.emit('task.completed', { ...task, result });
}

export function emitTaskFailed(task: import('./event-types.ts').TaskPayload, error: string): void {
  orchestrationBus.emit('task.failed', { ...task, error });
}

export function emitMetric(runId: string, metric: string, value: number, unit = 'ms'): void {
  orchestrationBus.emit('metric.recorded', { runId, metric, value, unit, timestamp: new Date() });
}
