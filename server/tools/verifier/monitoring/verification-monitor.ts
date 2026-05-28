import { verificationMonitor as _monitor, type PhaseProgressEvent } from '../lib/verification-monitor.ts';
import type { VerificationPhase, VerificationStatus }                from '../shared/verifier-types.ts';

export type { PhaseProgressEvent };

export const verificationMonitor = {
  onRunStart(runId: string): void {
    _monitor.onRunStart(runId);
  },
  onPhaseComplete(event: {
    runId:      string;
    phase:      VerificationPhase;
    status:     VerificationStatus;
    durationMs: number;
    errors:     string[];
  }): void {
    _monitor.onPhaseComplete(event);
  },
  onRunComplete(runId: string, status: VerificationStatus): void {
    _monitor.onRunComplete(runId, status);
  },
};
