import { EventEmitter }              from 'events';
import { executorLogger }            from './telemetry.ts';
import { executorMetrics }           from './telemetry.ts';

// ── Event types ────────────────────────────────────────────────────────────

export type ExecutorEventName =
  | 'execution.started'
  | 'execution.step.started'
  | 'execution.step.completed'
  | 'execution.failed'
  | 'execution.completed';

export interface ExecutionStartedPayload   { runId: string; sessionId: string; tasksTotal: number; timestamp: Date; }
export interface ExecutionStepStartedPayload { runId: string; taskId: string; stepId: string; stepType: string; label: string; timestamp: Date; }
export interface ExecutionStepCompletedPayload { runId: string; taskId: string; stepId: string; stepType: string; success: boolean; durationMs: number; filePath?: string; timestamp: Date; }
export interface ExecutionFailedPayload    { runId: string; taskId?: string; error: string; timestamp: Date; }
export interface ExecutionCompletedPayload { runId: string; tasksCompleted: number; tasksFailed: number; durationMs: number; timestamp: Date; }

export interface ExecutorEventMap {
  'execution.started':        ExecutionStartedPayload;
  'execution.step.started':   ExecutionStepStartedPayload;
  'execution.step.completed': ExecutionStepCompletedPayload;
  'execution.failed':         ExecutionFailedPayload;
  'execution.completed':      ExecutionCompletedPayload;
}

// ── Typed event bus ────────────────────────────────────────────────────────

class TypedExecutorEmitter extends EventEmitter {
  emit<K extends ExecutorEventName>(event: K, payload: ExecutorEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends ExecutorEventName>(event: K, listener: (payload: ExecutorEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  once<K extends ExecutorEventName>(event: K, listener: (payload: ExecutorEventMap[K]) => void): this {
    return super.once(event, listener);
  }
  off<K extends ExecutorEventName>(event: K, listener: (payload: ExecutorEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const executorBus = new TypedExecutorEmitter();
executorBus.setMaxListeners(20);

// ── Emit helpers ───────────────────────────────────────────────────────────

export function emitExecutionStarted(runId: string, sessionId: string, tasksTotal: number): void {
  executorBus.emit('execution.started', { runId, sessionId, tasksTotal, timestamp: new Date() });
}

export function emitStepStarted(runId: string, taskId: string, stepId: string, stepType: string, label: string): void {
  executorBus.emit('execution.step.started', { runId, taskId, stepId, stepType, label, timestamp: new Date() });
}

export function emitStepCompleted(runId: string, taskId: string, stepId: string, stepType: string, success: boolean, durationMs: number, filePath?: string): void {
  executorBus.emit('execution.step.completed', { runId, taskId, stepId, stepType, success, durationMs, filePath, timestamp: new Date() });
}

export function emitExecutionFailed(runId: string, error: string, taskId?: string): void {
  executorBus.emit('execution.failed', { runId, taskId, error, timestamp: new Date() });
}

export function emitExecutionCompleted(runId: string, tasksCompleted: number, tasksFailed: number, durationMs: number): void {
  executorBus.emit('execution.completed', { runId, tasksCompleted, tasksFailed, durationMs, timestamp: new Date() });
}

// ── Event handlers ─────────────────────────────────────────────────────────

function onExecutionStarted(payload: ExecutionStartedPayload): void {
  executorLogger.info(payload.runId, `Execution started — ${payload.tasksTotal} task(s) queued`);
  executorMetrics.recordStarted(payload.runId);
}

function onStepCompleted(payload: ExecutionStepCompletedPayload): void {
  if (!payload.success) {
    executorMetrics.recordValidationFailure(payload.runId);
    executorLogger.warn(payload.runId, `Step ${payload.stepId} (${payload.stepType}) failed in ${payload.durationMs}ms`);
  }
}

function onExecutionCompleted(payload: ExecutionCompletedPayload): void {
  executorLogger.info(payload.runId, `Execution complete — ${payload.tasksCompleted} succeeded, ${payload.tasksFailed} failed`, { durationMs: payload.durationMs });
  executorMetrics.recordCompleted(payload.runId, payload.durationMs);
}

function onExecutionFailed(payload: ExecutionFailedPayload): void {
  executorLogger.error(payload.runId, `Execution failed: ${payload.error}`, { taskId: payload.taskId });
  executorMetrics.recordFailed(payload.runId, 0);
}

let _registered = false;

export function registerExecutorEventHandlers(): void {
  if (_registered) return;
  executorBus.on('execution.started',        onExecutionStarted);
  executorBus.on('execution.step.completed', onStepCompleted);
  executorBus.on('execution.completed',      onExecutionCompleted);
  executorBus.on('execution.failed',         onExecutionFailed);
  _registered = true;
}

export function unregisterExecutorEventHandlers(): void {
  executorBus.off('execution.started',        onExecutionStarted);
  executorBus.off('execution.step.completed', onStepCompleted);
  executorBus.off('execution.completed',      onExecutionCompleted);
  executorBus.off('execution.failed',         onExecutionFailed);
  _registered = false;
}
