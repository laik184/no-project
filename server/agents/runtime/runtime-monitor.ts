import { executorLogger } from '../executor/telemetry/executor-logger.ts';
import { executorMetrics } from '../executor/telemetry/executor-metrics.ts';

export interface RuntimeHealth {
  runId:       string;
  stepsTotal:  number;
  stepsPassed: number;
  stepsFailed: number;
  healthy:     boolean;
  failureRate: number;
}

const healthStore = new Map<string, RuntimeHealth>();

export const runtimeMonitor = {
  init(runId: string, stepsTotal: number): void {
    healthStore.set(runId, {
      runId,
      stepsTotal,
      stepsPassed: 0,
      stepsFailed: 0,
      healthy:     true,
      failureRate: 0,
    });
  },

  recordStep(runId: string, success: boolean): void {
    const h = healthStore.get(runId);
    if (!h) return;

    if (success) {
      h.stepsPassed++;
    } else {
      h.stepsFailed++;
      executorMetrics.recordValidationFailure(runId);
    }

    const total      = h.stepsPassed + h.stepsFailed;
    h.failureRate    = total > 0 ? h.stepsFailed / total : 0;
    h.healthy        = h.failureRate < 0.5;

    if (!h.healthy) {
      executorLogger.warn(runId, `High failure rate detected: ${(h.failureRate * 100).toFixed(0)}%`);
    }
  },

  getHealth(runId: string): RuntimeHealth | null {
    return healthStore.get(runId) ?? null;
  },

  isHealthy(runId: string): boolean {
    return healthStore.get(runId)?.healthy ?? true;
  },

  clear(runId: string): void {
    healthStore.delete(runId);
  },
};
