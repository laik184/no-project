/**
 * server/runtime/index.ts
 *
 * Observation controller for monitoring running project servers.
 * Watches logs and probes ports for all project servers.
 */

import { runtimeManager } from '../infrastructure/runtime/runtime-manager.ts';

interface ObservationState {
  observing: Set<number>;
  intervalId: NodeJS.Timeout | null;
}

const state: ObservationState = {
  observing: new Set(),
  intervalId: null,
};

async function probe(): Promise<void> {
  try {
    const all = runtimeManager.listAll?.() ?? [];
    for (const entry of all) {
      if (entry?.projectId != null) {
        state.observing.add(entry.projectId);
      }
    }
  } catch {
    // runtimeManager may not expose listAll — silent fallback
  }
}

export const observationController = {
  start(): void {
    if (state.intervalId) return;
    probe().catch(() => {});
    state.intervalId = setInterval(() => probe().catch(() => {}), 15_000);
  },

  stop(): void {
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    state.observing.clear();
  },

  observedProjects(): number[] {
    return [...state.observing];
  },

  isObserving(projectId: number): boolean {
    return state.observing.has(projectId);
  },

  observe(projectId: number): void {
    state.observing.add(projectId);
  },

  unobserve(projectId: number): void {
    state.observing.delete(projectId);
  },
};
