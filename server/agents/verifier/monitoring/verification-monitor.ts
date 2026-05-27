import type { VerificationPhase, VerificationStatus } from '../types/verifier.types.ts';
import { verificationMetricsStore } from './verification-metrics.ts';
import { verificationAlerts }       from './verification-alerts.ts';
import { healthMonitor }            from './health-monitor.ts';

export interface PhaseProgressEvent {
  runId:      string;
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
}

export const verificationMonitor = {
  onRunStart(runId: string): void {
    healthMonitor.registerRun(runId);
    verificationMetricsStore.setRunStatus(runId, 'running');
  },

  onPhaseComplete(event: PhaseProgressEvent): void {
    verificationMetricsStore.recordPhase(
      event.runId,
      event.phase,
      event.status,
      event.durationMs,
    );

    if (event.status === 'failed') {
      verificationAlerts.raise(
        event.runId,
        event.errors.length > 3 ? 'critical' : 'warning',
        `Phase "${event.phase}" failed: ${event.errors.slice(0, 2).join('; ')}`,
        event.phase,
      );
    }
  },

  onRunComplete(runId: string, status: VerificationStatus): void {
    healthMonitor.completeRun(runId, status);
    if (status === 'failed') {
      verificationAlerts.raise(runId, 'critical', 'Verification run failed');
    }
  },

  getSuccessRate(runId: string): number {
    return verificationMetricsStore.getSuccessRate(runId);
  },

  clear(runId: string): void {
    verificationMetricsStore.clear(runId);
    verificationAlerts.clear(runId);
    healthMonitor.clearRun(runId);
  },
};
