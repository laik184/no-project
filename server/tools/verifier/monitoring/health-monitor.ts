import { healthMonitor as _healthMonitor, type HealthStatus } from '../lib/health-monitor.ts';
import type { VerificationStatus }                            from '../shared/verifier-types.ts';

export type { HealthStatus };

export const healthMonitor = {
  registerRun(runId: string): void {
    _healthMonitor.registerRun(runId);
  },
  completeRun(runId: string, status: VerificationStatus): void {
    _healthMonitor.completeRun(runId, status);
  },
  getRuns(): string[] {
    return _healthMonitor.getRuns();
  },
  isHealthy(): boolean {
    return _healthMonitor.isHealthy();
  },
};
