import { executorBus } from './executor-events.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';
import { executorMetrics } from '../telemetry/executor-metrics.ts';

function onExecutionStarted(payload: { runId: string; tasksTotal: number }): void {
  executorLogger.info(payload.runId, `Execution started — ${payload.tasksTotal} task(s) queued`);
  executorMetrics.recordStarted(payload.runId);
}

function onStepCompleted(payload: {
  runId: string; stepId: string; stepType: string;
  success: boolean; durationMs: number;
}): void {
  if (!payload.success) {
    executorMetrics.recordValidationFailure(payload.runId);
    executorLogger.warn(
      payload.runId,
      `Step ${payload.stepId} (${payload.stepType}) failed in ${payload.durationMs}ms`,
    );
  }
}

function onExecutionCompleted(payload: {
  runId: string; tasksCompleted: number; tasksFailed: number; durationMs: number;
}): void {
  executorLogger.info(
    payload.runId,
    `Execution complete — ${payload.tasksCompleted} succeeded, ${payload.tasksFailed} failed`,
    { durationMs: payload.durationMs },
  );
  executorMetrics.recordCompleted(payload.runId, payload.durationMs);
}

function onExecutionFailed(payload: { runId: string; error: string; taskId?: string }): void {
  executorLogger.error(payload.runId, `Execution failed: ${payload.error}`, {
    taskId: payload.taskId,
  });
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
