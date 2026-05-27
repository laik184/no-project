import {
  metricsCollector,
  incrementCounter,
  recordDuration,
} from '../../../orchestration/telemetry/metrics.ts';

const M = {
  STARTED:            'executions.started',
  COMPLETED:          'executions.completed',
  FAILED:             'executions.failed',
  DURATION:           'execution.duration',
  RETRY_COUNT:        'retry.count',
  VALIDATION_FAILURES:'validation.failures',
} as const;

export const executorMetrics = {
  recordStarted(runId: string): void {
    metricsCollector.increment(runId, M.STARTED);
    incrementCounter(M.STARTED);
  },

  recordCompleted(runId: string, durationMs: number): void {
    metricsCollector.increment(runId, M.COMPLETED);
    metricsCollector.timing(runId, M.DURATION, durationMs);
    incrementCounter(M.COMPLETED);
    recordDuration(M.DURATION, durationMs);
  },

  recordFailed(runId: string, durationMs: number): void {
    metricsCollector.increment(runId, M.FAILED);
    metricsCollector.timing(runId, M.DURATION, durationMs);
    incrementCounter(M.FAILED);
    recordDuration(M.DURATION, durationMs);
  },

  recordRetry(runId: string): void {
    metricsCollector.increment(runId, M.RETRY_COUNT);
    incrementCounter(M.RETRY_COUNT);
  },

  recordValidationFailure(runId: string): void {
    metricsCollector.increment(runId, M.VALIDATION_FAILURES);
    incrementCounter(M.VALIDATION_FAILURES);
  },

  getSnapshot(runId: string) {
    return metricsCollector.getSnapshot(runId);
  },
};
