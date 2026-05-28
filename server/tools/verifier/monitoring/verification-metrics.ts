/**
 * server/tools/verifier/monitoring/verification-metrics.ts
 *
 * Self-contained in-process metrics for the verifier tool layer.
 * Local counters only — no imports from orchestration or agents.
 *
 * GOVERNANCE: Tools must not import from orchestration/ or agents/.
 * Telemetry aggregation is the responsibility of the orchestration layer.
 */

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
  recordBuild(_runId: string, durationMs: number, passed: boolean): void {
    if (passed) { counts.buildsPassed++; } else { counts.buildsFailed++; }
    counts.buildsMs += durationMs;
  },

  recordTests(_runId: string, passed: number, failed: number): void {
    counts.testsPassed += passed;
    counts.testsFailed += failed;
  },

  recordTypecheck(_runId: string, durationMs: number, passed: boolean): void {
    if (passed) { counts.tcPassed++; } else { counts.tcFailed++; }
    counts.tcMs += durationMs;
  },

  recordCrash(_runId: string): void {
    counts.crashes++;
  },

  recordRecovery(_runId: string): void {
    counts.recoveries++;
  },

  recordPhase(_runId: string, _phase: string, _durationMs: number, _passed: boolean): void {
    // Phase-level telemetry aggregated by orchestration layer.
  },

  recordVerification(_runId: string, _durationMs: number, _passed: boolean): void {
    // Run-level telemetry aggregated by orchestration layer.
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
