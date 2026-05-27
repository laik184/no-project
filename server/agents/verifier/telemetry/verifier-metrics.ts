import { metricsCollector } from '../../../orchestration/telemetry/metrics.ts';

export const verifierMetrics = {
  recordPhase(runId: string, phase: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, `verifier.phase.${phase}`, durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.phases.passed' : 'verifier.phases.failed');
  },

  recordVerification(runId: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, 'verifier.total', durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.runs.passed' : 'verifier.runs.failed');
  },

  recordBuildSuccess(runId: string): void {
    metricsCollector.increment(runId, 'verifier.build.success');
  },

  recordBuildFailure(runId: string): void {
    metricsCollector.increment(runId, 'verifier.build.failure');
  },

  recordTestRun(runId: string, passed: number, failed: number): void {
    metricsCollector.increment(runId, 'verifier.tests.passed', passed);
    metricsCollector.increment(runId, 'verifier.tests.failed', failed);
  },

  recordCrash(runId: string): void {
    metricsCollector.increment(runId, 'verifier.runtime.crashes');
  },

  getSnapshot(runId: string) {
    return metricsCollector.getSnapshot(runId);
  },

  clear(runId: string): void {
    metricsCollector.clearRun(runId);
  },
};
