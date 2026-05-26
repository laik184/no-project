import { orchestrationBus } from './orchestration-events.ts';
import type { OrchestrationEventName } from './event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { metricsCollector } from '../telemetry/metrics.ts';

type CleanupFn = () => void;
const cleanupRegistry: CleanupFn[] = [];

function register<K extends OrchestrationEventName>(
  event: K,
  handler: (payload: import('./event-types.ts').OrchestrationEventMap[K]) => void
): void {
  orchestrationBus.on(event, handler);
  cleanupRegistry.push(() => orchestrationBus.off(event, handler));
}

function onRunStarted(payload: import('./event-types.ts').LifecyclePayload): void {
  runLogger.log(payload.runId, 'info', `Run started`, { status: payload.status });
  metricsCollector.increment(payload.runId, 'run.started');
}

function onRunCompleted(payload: import('./event-types.ts').LifecyclePayload): void {
  runLogger.log(payload.runId, 'info', `Run completed in ${payload.durationMs ?? 0}ms`);
  metricsCollector.increment(payload.runId, 'run.completed');
  if (payload.durationMs !== undefined) {
    metricsCollector.timing(payload.runId, 'run.duration', payload.durationMs);
  }
}

function onRunFailed(payload: import('./event-types.ts').FailurePayload): void {
  runLogger.log(payload.runId, 'error', `Run failed at phase [${payload.phase}]: ${payload.error}`, {
    recoverable: payload.recoverable,
  });
  metricsCollector.increment(payload.runId, 'run.failed');
}

function onPhaseStarted(payload: { runId: string; phase: import('./event-types.ts').OrchestrationPhase; timestamp: Date }): void {
  runLogger.log(payload.runId, 'info', `Phase started: ${payload.phase}`);
  metricsCollector.increment(payload.runId, `phase.${payload.phase}.started`);
}

function onPhaseCompleted(payload: import('./event-types.ts').PhaseResult): void {
  runLogger.log((payload as any).runId ?? 'unknown', 'info', `Phase completed: ${payload.phase} (${payload.durationMs}ms)`, {
    success: payload.success,
  });
  metricsCollector.timing((payload as any).runId ?? 'unknown', `phase.${payload.phase}.duration`, payload.durationMs);
}

function onTaskFailed(payload: import('./event-types.ts').TaskPayload & { error: string }): void {
  runLogger.log(payload.runId, 'warn', `Task failed [${payload.taskId}]: ${payload.error}`, {
    type: payload.type,
    retryCount: payload.retryCount,
  });
  metricsCollector.increment(payload.runId, 'task.failed');
}

function onMetricRecorded(payload: import('./event-types.ts').MetricPayload): void {
  metricsCollector.record(payload.runId, payload.metric, payload.value, payload.unit);
}

export function registerEventHandlers(): void {
  register('run.started', onRunStarted);
  register('run.completed', onRunCompleted);
  register('run.failed', onRunFailed);
  register('phase.started', onPhaseStarted);
  register('phase.completed', onPhaseCompleted);
  register('task.failed', onTaskFailed);
  register('metric.recorded', onMetricRecorded);
  console.log('[event-handlers] Orchestration event handlers registered');
}

export function unregisterEventHandlers(): void {
  cleanupRegistry.forEach((fn) => fn());
  cleanupRegistry.length = 0;
  console.log('[event-handlers] Orchestration event handlers removed');
}
