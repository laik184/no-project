/**
 * server/shared/console/runtime-state.ts
 *
 * In-memory runtime state store shared between:
 *   - server/console/runtime/** (writes state during lifecycle events)
 *   - server/repositories/console/runtime-repository.ts (reads for service layer)
 *
 * Zero application imports — this is a pure data store.
 */

import type { RuntimeEntry, RuntimeState } from './types.ts';

function makeEntry(
  projectId: number,
  state:     RuntimeState,
  prev:      RuntimeState,
  message:   string,
): RuntimeEntry {
  const now = Date.now();
  return { projectId, state, prev, message, updatedAt: now, heartbeatAt: now };
}

const store = new Map<number, RuntimeEntry>();

export const runtimeStateStore = {
  setState(projectId: number, state: RuntimeState, message = ''): RuntimeEntry {
    const current = store.get(projectId);
    const prev    = current?.state ?? 'idle';
    const entry   = makeEntry(projectId, state, prev, message);
    store.set(projectId, entry);
    return entry;
  },

  getState(projectId: number): RuntimeEntry | undefined {
    return store.get(projectId);
  },

  updateHeartbeat(projectId: number): void {
    const entry = store.get(projectId);
    if (entry) entry.heartbeatAt = Date.now();
  },

  delete(projectId: number): void {
    store.delete(projectId);
  },

  all(): RuntimeEntry[] {
    return [...store.values()];
  },
};
