import type { VerificationPhase, VerificationStatus } from '../types/verifier.types.ts';

interface PhaseMetric {
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  recordedAt: Date;
}

const phaseHistory = new Map<string, PhaseMetric[]>();
const runStatus    = new Map<string, VerificationStatus>();

function getHistory(runId: string): PhaseMetric[] {
  if (!phaseHistory.has(runId)) phaseHistory.set(runId, []);
  return phaseHistory.get(runId)!;
}

export const verificationMetricsStore = {
  recordPhase(
    runId:      string,
    phase:      VerificationPhase,
    status:     VerificationStatus,
    durationMs: number,
  ): void {
    getHistory(runId).push({ phase, status, durationMs, recordedAt: new Date() });
  },

  setRunStatus(runId: string, status: VerificationStatus): void {
    runStatus.set(runId, status);
  },

  getRunStatus(runId: string): VerificationStatus {
    return runStatus.get(runId) ?? 'pending';
  },

  getPhaseHistory(runId: string): PhaseMetric[] {
    return [...getHistory(runId)];
  },

  getSuccessRate(runId: string): number {
    const hist = getHistory(runId);
    if (!hist.length) return 0;
    const passed = hist.filter((m) => m.status === 'passed').length;
    return passed / hist.length;
  },

  getTotalDuration(runId: string): number {
    return getHistory(runId).reduce((sum, m) => sum + m.durationMs, 0);
  },

  clear(runId: string): void {
    phaseHistory.delete(runId);
    runStatus.delete(runId);
  },
};
