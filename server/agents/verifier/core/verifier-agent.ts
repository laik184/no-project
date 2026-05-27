import type { VerificationInput, VerificationResult } from '../types/verifier.types.ts';
import { createSession, updateSessionStatus, removeSession } from './verification-session.ts';
import { verificationState } from './verification-state.ts';
import { runAllPhases } from './verification-engine.ts';
import { buildVerificationReport } from '../reports/verification-report.ts';
import { verificationMonitor } from '../monitoring/verification-monitor.ts';
import { eventPublisher } from '../events/event-publisher.ts';
import { clearRecoveryState } from '../recovery/failure-recovery.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { executionTrace } from '../telemetry/execution-trace.ts';

let _initialized = false;

export function initializeVerifier(): void {
  if (_initialized) return;
  _initialized = true;
  verifierLogger.info('system', 'Verifier Agent initialized');
}

export async function runVerification(
  input: VerificationInput,
): Promise<VerificationResult> {
  const { runId, projectId } = input;

  const session   = createSession(input);
  const state     = verificationState.init(runId, projectId, input.phases);
  const startedAt = state.startedAt;

  verificationMonitor.onRunStart(runId);
  eventPublisher.verificationStarted(runId, projectId, input.phases);
  executionTrace.record(runId, 'overall', 'started', { phases: input.phases });

  updateSessionStatus(runId, 'running');

  let phases = state.results;

  try {
    const phaseResults = await runAllPhases(input);

    for (const result of phaseResults) {
      verificationState.recordPhase(runId, result);
      verificationMonitor.onPhaseComplete({
        runId,
        phase:      result.phase,
        status:     result.status,
        durationMs: result.durationMs,
        errors:     result.errors,
      });
    }

    phases = phaseResults;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    verifierLogger.error(runId, `Verification engine threw: ${message}`);
    eventPublisher.verificationFailed(runId, [message]);
    updateSessionStatus(runId, 'failed');
    verificationState.setStatus(runId, 'failed');
    verificationMonitor.onRunComplete(runId, 'failed');
    throw err;
  }

  const report = buildVerificationReport(runId, projectId, phases, startedAt);

  verificationState.setStatus(runId, report.overallStatus);
  updateSessionStatus(runId, report.overallStatus);
  verificationMonitor.onRunComplete(runId, report.overallStatus);

  verifierMetrics.recordVerification(
    runId,
    report.durationMs,
    report.overallStatus === 'passed',
  );

  executionTrace.record(runId, 'overall', 'completed', {
    status:     report.overallStatus,
    durationMs: report.durationMs,
    errors:     report.errorCount,
  });

  if (report.overallStatus === 'passed') {
    eventPublisher.verificationCompleted(runId, report);
  } else {
    const allErrors = phases.flatMap((p) => p.errors);
    eventPublisher.verificationFailed(runId, allErrors);
  }

  return report;
}

export async function shutdownVerifier(): Promise<void> {
  _initialized = false;
  verifierLogger.info('system', 'Verifier Agent shut down');
}
