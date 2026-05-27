import type { VerificationStatus } from '../types/verifier.types.ts';
import { verificationMetricsStore } from './verification-metrics.ts';
import { verificationAlerts }       from './verification-alerts.ts';

export type SystemHealthState = 'healthy' | 'degraded' | 'unhealthy';

export interface SystemHealthSnapshot {
  state:       SystemHealthState;
  activeRuns:  number;
  successRate: number;
  criticalAlerts: number;
  timestamp:   Date;
}

const activeRuns = new Set<string>();
const runStatuses = new Map<string, VerificationStatus>();

export const healthMonitor = {
  registerRun(runId: string): void {
    activeRuns.add(runId);
    runStatuses.set(runId, 'running');
  },

  completeRun(runId: string, status: VerificationStatus): void {
    activeRuns.delete(runId);
    runStatuses.set(runId, status);
    verificationMetricsStore.setRunStatus(runId, status);
  },

  getSnapshot(): SystemHealthSnapshot {
    const statuses      = Array.from(runStatuses.values());
    const passed        = statuses.filter((s) => s === 'passed').length;
    const successRate   = statuses.length ? passed / statuses.length : 1;
    const criticalCount = Array.from(runStatuses.keys())
      .filter((id) => verificationAlerts.hasCritical(id)).length;

    const state: SystemHealthState =
      criticalCount > 0 ? 'unhealthy'
      : successRate < 0.5 ? 'degraded'
      : 'healthy';

    return {
      state,
      activeRuns:     activeRuns.size,
      successRate,
      criticalAlerts: criticalCount,
      timestamp:      new Date(),
    };
  },

  isHealthy(): boolean {
    return this.getSnapshot().state === 'healthy';
  },

  clearRun(runId: string): void {
    activeRuns.delete(runId);
    runStatuses.delete(runId);
  },
};
