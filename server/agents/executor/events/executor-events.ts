import { EventEmitter } from 'events';
import type { ExecutorEventMap, ExecutorEventName } from './event-types.ts';

class TypedExecutorEmitter extends EventEmitter {
  emit<K extends ExecutorEventName>(event: K, payload: ExecutorEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends ExecutorEventName>(
    event: K,
    listener: (payload: ExecutorEventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }
  once<K extends ExecutorEventName>(
    event: K,
    listener: (payload: ExecutorEventMap[K]) => void,
  ): this {
    return super.once(event, listener);
  }
  off<K extends ExecutorEventName>(
    event: K,
    listener: (payload: ExecutorEventMap[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

export const executorBus = new TypedExecutorEmitter();
executorBus.setMaxListeners(20);

export function emitExecutionStarted(
  runId: string,
  sessionId: string,
  tasksTotal: number,
): void {
  executorBus.emit('execution.started', { runId, sessionId, tasksTotal, timestamp: new Date() });
}

export function emitStepStarted(
  runId: string,
  taskId: string,
  stepId: string,
  stepType: string,
  label: string,
): void {
  executorBus.emit('execution.step.started', {
    runId, taskId, stepId, stepType, label, timestamp: new Date(),
  });
}

export function emitStepCompleted(
  runId: string,
  taskId: string,
  stepId: string,
  stepType: string,
  success: boolean,
  durationMs: number,
  filePath?: string,
): void {
  executorBus.emit('execution.step.completed', {
    runId, taskId, stepId, stepType, success, durationMs, filePath, timestamp: new Date(),
  });
}

export function emitExecutionFailed(runId: string, error: string, taskId?: string): void {
  executorBus.emit('execution.failed', { runId, taskId, error, timestamp: new Date() });
}

export function emitExecutionCompleted(
  runId: string,
  tasksCompleted: number,
  tasksFailed: number,
  durationMs: number,
): void {
  executorBus.emit('execution.completed', {
    runId, tasksCompleted, tasksFailed, durationMs, timestamp: new Date(),
  });
}
