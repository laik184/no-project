/**
 * server/repositories/console/runtime-repository.ts
 *
 * Thin facade over the shared runtime-state store.
 * In-memory — no DB persistence needed.
 * Imports types from server/shared/console (not from console domain).
 */

import { runtimeStateStore }                   from '../../shared/console/runtime-state.ts';
import type { RuntimeEntry, RuntimeState }      from '../../shared/console/types.ts';

export interface IRuntimeRepository {
  setState(projectId: number, state: RuntimeState, message?: string): RuntimeEntry;
  getState(projectId: number): RuntimeEntry | undefined;
  updateHeartbeat(projectId: number): void;
  delete(projectId: number): void;
  all(): RuntimeEntry[];
}

class RuntimeRepository implements IRuntimeRepository {
  setState(projectId: number, state: RuntimeState, message = ''): RuntimeEntry {
    return runtimeStateStore.setState(projectId, state, message);
  }

  getState(projectId: number): RuntimeEntry | undefined {
    return runtimeStateStore.getState(projectId);
  }

  updateHeartbeat(projectId: number): void {
    runtimeStateStore.updateHeartbeat(projectId);
  }

  delete(projectId: number): void {
    runtimeStateStore.delete(projectId);
  }

  all(): RuntimeEntry[] {
    return runtimeStateStore.all();
  }
}

export const runtimeRepository: IRuntimeRepository = new RuntimeRepository();
