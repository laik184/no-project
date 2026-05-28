import type { VerificationResult, PhaseResult, VerificationPhase } from './types.ts';
import type { CrashReport, RuntimeCheckResult } from './types.ts';
import { verifierLogger } from './telemetry.ts';

export const VERIFIER_EVENTS = {
  STARTED:   'verification.started',
  COMPLETED: 'verification.completed',
  FAILED:    'verification.failed',
} as const;

export const BUILD_EVENTS = {
  STARTED: 'build.started',
  PASSED:  'build.passed',
  FAILED:  'build.failed',
} as const;

export const RUNTIME_EVENTS = {
  STARTED:  'runtime.check.started',
  HEALTHY:  'runtime.healthy',
  CRASHED:  'runtime.crashed',
} as const;

export const TEST_EVENTS = {
  STARTED: 'tests.started',
  PASSED:  'tests.passed',
  FAILED:  'tests.failed',
} as const;

export type VerifierEventName =
  | typeof VERIFIER_EVENTS[keyof typeof VERIFIER_EVENTS]
  | typeof BUILD_EVENTS[keyof typeof BUILD_EVENTS]
  | typeof RUNTIME_EVENTS[keyof typeof RUNTIME_EVENTS]
  | typeof TEST_EVENTS[keyof typeof TEST_EVENTS];

export const eventPublisher = {
  verificationStarted(runId: string, projectId: string, phases: VerificationPhase[]): void {
    verifierLogger.info(runId, 'Verification started', { phases, projectId });
  },
  verificationCompleted(runId: string, result: VerificationResult): void {
    verifierLogger.info(runId, 'Verification completed', {
      status:     result.overallStatus,
      durationMs: result.durationMs,
      errors:     result.errorCount,
    });
  },
  verificationFailed(runId: string, errors: string[], phase?: VerificationPhase, phaseResult?: PhaseResult): void {
    verifierLogger.error(runId, 'Verification failed', { phase, errors });
  },
  runtimeCrashed(runId: string, projectId: string, report: CrashReport): void {
    verifierLogger.error(runId, 'Runtime crash detected', {
      reason:   report.reason,
      exitCode: report.exitCode,
      lastLine: report.lastLines.at(-1),
    });
  },
  runtimeHealthy(runId: string, projectId: string, check: RuntimeCheckResult): void {
    verifierLogger.info(runId, 'Runtime healthy', { responseTimeMs: check.responseTimeMs });
  },
  runtimeCheckStarted(runId: string, projectId: string): void {
    verifierLogger.info(runId, 'Runtime check started', { projectId });
  },
};
