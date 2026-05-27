import type { FilesystemAgentState } from '../types/filesystem.types.ts';

const states = new Map<string, FilesystemAgentState>();

export const filesystemState = {
  init(runId: string, projectId: string, sandboxRoot: string): FilesystemAgentState {
    const state: FilesystemAgentState = {
      runId,
      projectId,
      sandboxRoot,
      opsCompleted: 0,
      opsFailed:    0,
      startedAt:    new Date(),
    };
    states.set(runId, state);
    return state;
  },

  get(runId: string): FilesystemAgentState | undefined {
    return states.get(runId);
  },

  increment(runId: string, field: 'opsCompleted' | 'opsFailed'): void {
    const s = states.get(runId);
    if (s) s[field]++;
  },

  clear(runId: string): void {
    states.delete(runId);
  },
};
