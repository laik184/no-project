import { metricsCollector } from '../../../orchestration/telemetry/metrics.ts';

export interface VerifierMetricsSnapshot {
  builds:        { passed: number; failed: number; totalMs: number };
  tests:         { passed: number; failed: number };
  typechecks:    { passed: number; failed: number; totalMs: number };
  crashes:       number;
  recoveries:    number;
}

const counts = {
  buildsPassed:  0, buildsFailed:  0, buildsMs:    0,
  testsPassed:   0, testsFailed:   0,
  tcPassed:      0, tcFailed:      0, tcMs:        0,
  crashes:       0, recoveries:    0,
};

export const verifierMetrics = {
  recordBuild(runId: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, 'verifier.build', durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.build.passed' : 'verifier.build.failed');
    if (passed) { counts.buildsPassed++; } else { counts.buildsFailed++; }
    counts.buildsMs += durationMs;
  },

  recordTests(runId: string, passed: number, failed: number): void {
    metricsCollector.increment(runId, 'verifier.tests.passed', passed);
    metricsCollector.increment(runId, 'verifier.tests.failed', failed);
    counts.testsPassed += passed;
    counts.testsFailed += failed;
  },

  recordTypecheck(runId: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, 'verifier.typecheck', durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.typecheck.passed' : 'verifier.typecheck.failed');
    if (passed) { counts.tcPassed++; } else { counts.tcFailed++; }
    counts.tcMs += durationMs;
  },

  recordCrash(runId: string): void {
    metricsCollector.increment(runId, 'verifier.runtime.crashes');
    counts.crashes++;
  },

  recordRecovery(runId: string): void {
    metricsCollector.increment(runId, 'verifier.recovery.attempts');
    counts.recoveries++;
  },

  recordPhase(runId: string, phase: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, `verifier.phase.${phase}`, durationMs);
    metricsCollector.increment(runId, passed ? `verifier.${phase}.passed` : `verifier.${phase}.failed`);
  },

  recordVerification(runId: string, durationMs: number, passed: boolean): void {
    metricsCollector.timing(runId, 'verifier.total', durationMs);
    metricsCollector.increment(runId, passed ? 'verifier.runs.passed' : 'verifier.runs.failed');
  },

  snapshot(): VerifierMetricsSnapshot {
    return {
      builds:     { passed: counts.buildsPassed, failed: counts.buildsFailed, totalMs: counts.buildsMs },
      tests:      { passed: counts.testsPassed,  failed: counts.testsFailed },
      typechecks: { passed: counts.tcPassed,     failed: counts.tcFailed,    totalMs: counts.tcMs },
      crashes:    counts.crashes,
      recoveries: counts.recoveries,
    };
  },
};
