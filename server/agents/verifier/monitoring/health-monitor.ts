/**
 * monitoring/health-monitor.ts
 * System-level health tracking for the verifier agent.
 */

import type { VerificationStatus } from '../types/verifier.types.ts';
import { verificationStore } from '../state/verification-store.ts';
import { failureMonitor }    from './failure-monitor.ts';

export type SystemHealth = 'healthy' | 'degraded' | 'unhealthy';
export type HealthStatus = SystemHealth;

export interface HealthSnapshot {
  state:        SystemHealth;
  activeRuns:   number;
  successRate:  number;
  criticalRuns: number;
  timestamp:    Date;
}

const runStatuses = new Map<string, VerificationStatus>();

export const healthMonitor = {
  trackRun(runId: string, status: VerificationStatus): void {
    runStatuses.set(runId, status);
    if (runStatuses.size > 100) {
      const oldest = runStatuses.keys().next().value;
      if (oldest) runStatuses.delete(oldest);
    }
  },

  snapshot(): HealthSnapshot {
    const active    = verificationStore.listActive();
    const statuses  = Array.from(runStatuses.values());
    const passed    = statuses.filter((s) => s === 'passed').length;
    const successRate = statuses.length > 0 ? passed / statuses.length : 1;

    const criticalRuns = Array.from(runStatuses.keys())
      .filter((id) => failureMonitor.hasCritical(id)).length;

    const state: SystemHealth =
      criticalRuns > 2 ? 'unhealthy'
      : successRate < 0.5 ? 'degraded'
      : 'healthy';

    return { state, activeRuns: active.length, successRate, criticalRuns, timestamp: new Date() };
  },

  isHealthy(): boolean {
    return this.snapshot().state === 'healthy';
  },

  clearRun(runId: string): void {
    runStatuses.delete(runId);
  },

  registerRun(runId: string): void {
    runStatuses.set(runId, 'running');
  },

  completeRun(runId: string, status: VerificationStatus): void {
    runStatuses.set(runId, status);
  },

  getRuns(): string[] {
    return Array.from(runStatuses.keys());
  },
};
