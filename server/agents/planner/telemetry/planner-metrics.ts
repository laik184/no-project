import {
  incrementCounter,
  recordDuration,
  metricsCollector,
} from '../../../orchestration/telemetry/metrics.ts';

const METRIC = {
  PLANS_CREATED:   'plans.created',
  PLANS_FAILED:    'plans.failed',
  PLANNING_DURATION: 'planning.duration',
  DEPENDENCY_ERRORS: 'dependency.errors',
} as const;

export const plannerMetrics = {
  recordPlanStarted(runId: string): void {
    metricsCollector.increment(runId, METRIC.PLANS_CREATED);
    incrementCounter(METRIC.PLANS_CREATED);
  },

  recordPlanCompleted(runId: string, durationMs: number): void {
    metricsCollector.timing(runId, METRIC.PLANNING_DURATION, durationMs);
    recordDuration(METRIC.PLANNING_DURATION, durationMs);
  },

  recordPlanFailed(runId: string, durationMs: number): void {
    metricsCollector.increment(runId, METRIC.PLANS_FAILED);
    metricsCollector.timing(runId, METRIC.PLANNING_DURATION, durationMs);
    incrementCounter(METRIC.PLANS_FAILED);
    recordDuration(METRIC.PLANNING_DURATION, durationMs);
  },

  recordDependencyError(runId: string): void {
    metricsCollector.increment(runId, METRIC.DEPENDENCY_ERRORS);
    incrementCounter(METRIC.DEPENDENCY_ERRORS);
  },

  getSnapshot(runId: string) {
    return metricsCollector.getSnapshot(runId);
  },
};
