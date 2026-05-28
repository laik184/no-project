/**
 * monitoring/verification-monitor.ts
 * Tracks lifecycle events for active verification runs.
 */

import type { VerificationStatus, VerificationPhase, PhaseResult } from '../types/verifier.types.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';
import { verificationStore } from '../state/verification-store.ts';

export interface PhaseProgressEvent {
  runId:      string;
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
}

export interface RunProgressSnapshot {
  runId:           string;
  status:          VerificationStatus;
  completedPhases: VerificationPhase[];
  failedPhases:    VerificationPhase[];
  currentPhase?:   VerificationPhase;
  errorCount:      number;
  elapsedMs:       number;
}

export const verificationMonitor = {
  /** Start a run. Accepts (runId) or (runId, projectId, phases) */
  onRunStart(runId: string, projectId?: string, phases?: VerificationPhase[]): void {
    verifierLogger.info(runId, 'Run started', { projectId, phaseCount: phases?.length ?? 0 });
    verifierMetrics.increment(runId, 'runs.started');
    verificationStore.setStatus(runId, 'running');
  },

  onPhaseStart(runId: string, phase: VerificationPhase): void {
    verifierLogger.phase(runId, phase, 'start');
    verifierMetrics.increment(runId, `phase.${phase}.started`);
  },

  /** Accept both (runId, phase, PhaseResult) and (PhaseProgressEvent) forms */
  onPhaseComplete(
    runIdOrEvent: string | PhaseProgressEvent,
    phase?:       VerificationPhase,
    result?:      PhaseResult,
  ): void {
    if (typeof runIdOrEvent === 'object') {
      const ev     = runIdOrEvent;
      const passed = ev.status === 'passed';
      verifierLogger.phase(ev.runId, ev.phase, passed ? 'end' : 'fail', {
        durationMs: ev.durationMs,
        errors:     ev.errors.length,
      });
      verifierMetrics.recordPhase(ev.runId, ev.phase, ev.durationMs, passed);
      return;
    }

    const runId  = runIdOrEvent;
    if (!phase || !result) return;
    const passed = result.status === 'passed';
    verifierLogger.phase(runId, phase, passed ? 'end' : 'fail', {
      durationMs: result.durationMs,
      errors:     result.errors.length,
    });
    verifierMetrics.recordPhase(runId, phase, result.durationMs, passed);
    verificationStore.addPhaseResult(runId, result);
  },

  /** Accept (runId, status) or (runId, status, durationMs) */
  onRunComplete(runId: string, status: VerificationStatus, durationMs = 0): void {
    verifierLogger.info(runId, 'Run completed', { status, durationMs });
    verifierMetrics.recordVerification(runId, durationMs, status === 'passed');
    verificationStore.setStatus(runId, status);
  },

  getSnapshot(runId: string): RunProgressSnapshot | undefined {
    const record = verificationStore.get(runId);
    if (!record) return undefined;
    const completed = record.phases.filter((p) => p.status === 'passed' || p.status === 'skipped').map((p) => p.phase);
    const failed    = record.phases.filter((p) => p.status === 'failed').map((p) => p.phase);
    return {
      runId,
      status:          record.status,
      completedPhases: completed,
      failedPhases:    failed,
      errorCount:      record.errorCount,
      elapsedMs:       Date.now() - record.startedAt.getTime(),
    };
  },
};
