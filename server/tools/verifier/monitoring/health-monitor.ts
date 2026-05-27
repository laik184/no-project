import { healthMonitor as _healthMonitor } from '../../../agents/verifier/monitoring/health-monitor.ts';

export { type HealthStatus } from '../../../agents/verifier/monitoring/health-monitor.ts';

export const healthMonitor = {
  registerRun(runId: string): void {
    _healthMonitor.registerRun(runId);
  },

  completeRun(runId: string, status: string): void {
    _healthMonitor.completeRun(runId, status as any);
  },

  getRuns(): string[] {
    return _healthMonitor.getRuns?.() ?? [];
  },

  isHealthy(): boolean {
    return _healthMonitor.isHealthy?.() ?? true;
  },
};
