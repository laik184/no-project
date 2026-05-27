import type { RuntimeHealth } from '../types/runtime.types.ts';
import { runtimeLogger }      from '../telemetry/runtime-logger.ts';

const store = new Map<string, RuntimeHealth>();

export const runtimeMonitor = {
  init(runId: string, stepsTotal: number): void {
    store.set(runId, {
      runId,
      stepsTotal,
      stepsPassed: 0,
      stepsFailed: 0,
      failureRate:  0,
      healthy:      true,
      lastChecked:  new Date(),
    });
  },

  recordStep(runId: string, success: boolean): void {
    const h = store.get(runId);
    if (!h) return;

    success ? h.stepsPassed++ : h.stepsFailed++;
    const total   = h.stepsPassed + h.stepsFailed;
    h.failureRate = total > 0 ? h.stepsFailed / total : 0;
    h.healthy     = h.failureRate < 0.5;
    h.lastChecked = new Date();

    if (!h.healthy) {
      runtimeLogger.warn(runId, `[runtime-monitor] Failure rate: ${(h.failureRate * 100).toFixed(0)}%`);
    }
  },

  getHealth(runId: string): RuntimeHealth | null {
    return store.get(runId) ?? null;
  },

  isHealthy(runId: string): boolean {
    return store.get(runId)?.healthy ?? true;
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  listUnhealthy(): RuntimeHealth[] {
    return Array.from(store.values()).filter((h) => !h.healthy);
  },
};
