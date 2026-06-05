/**
 * server/repositories/console/runtime-repository.ts
 *
 * In-memory store for per-project runtime state.
 * Runtime state is ephemeral — no DB persistence needed.
 */

import type { RuntimeEntry, RuntimeState } from '../../console/types/index.ts';

export interface IRuntimeRepository {
  setState(projectId: number, state: RuntimeState, message?: string): RuntimeEntry;
  getState(projectId: number): RuntimeEntry | undefined;
  updateHeartbeat(projectId: number): void;
  delete(projectId: number): void;
  all(): RuntimeEntry[];
}

function makeEntry(
  projectId: number,
  state:     RuntimeState,
  prev:      RuntimeState,
  message:   string,
): RuntimeEntry {
  const now = Date.now();
  return { projectId, state, prev, message, updatedAt: now, heartbeatAt: now };
}

class RuntimeRepository implements IRuntimeRepository {
  private readonly store = new Map<number, RuntimeEntry>();

  setState(projectId: number, state: RuntimeState, message = ''): RuntimeEntry {
    const current = this.store.get(projectId);
    const prev    = current?.state ?? 'idle';
    const entry   = makeEntry(projectId, state, prev, message);
    this.store.set(projectId, entry);
    return entry;
  }

  getState(projectId: number): RuntimeEntry | undefined {
    return this.store.get(projectId);
  }

  updateHeartbeat(projectId: number): void {
    const entry = this.store.get(projectId);
    if (entry) entry.heartbeatAt = Date.now();
  }

  delete(projectId: number): void {
    this.store.delete(projectId);
  }

  all(): RuntimeEntry[] {
    return [...this.store.values()];
  }
}

export const runtimeRepository: IRuntimeRepository = new RuntimeRepository();
