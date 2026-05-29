/**
 * server/infrastructure/process/process-registry.ts
 *
 * Read-only view of running processes for metrics/observability.
 * Delegates to runtimeManager for process state.
 */
import { runtimeManager } from '../runtime/runtime-manager.ts';
import type { RuntimeEntry } from '../runtime/runtime-types.ts';

export const processRegistry = {
  get(projectId: number): RuntimeEntry | undefined {
    return runtimeManager.get(projectId);
  },

  getLogs(projectId: number, count = 50): string[] {
    const entry = runtimeManager.get(projectId);
    if (!entry) return [];
    return entry.logs.slice(-count);
  },

  all(): RuntimeEntry[] {
    return runtimeManager.all();
  },
};
