/**
 * server/agents/terminal/core/terminal-state.ts
 *
 * In-process state store for terminal agent sessions.
 * Tracks status, step progress, and lifecycle for each run.
 */

import type { SessionStatus, TerminalSessionMeta } from '../types/terminal.types.ts';

const store = new Map<string, TerminalSessionMeta>();

export const terminalState = {
  init(runId: string, projectId: string, sessionId: string, taskCount: number): TerminalSessionMeta {
    const meta: TerminalSessionMeta = {
      sessionId,
      runId,
      projectId,
      startedAt:      Date.now(),
      taskCount,
      completedCount: 0,
      failedCount:    0,
      status:         'idle',
    };
    store.set(runId, meta);
    return meta;
  },

  get(runId: string): TerminalSessionMeta | undefined {
    return store.get(runId);
  },

  setStatus(runId: string, status: SessionStatus): void {
    const m = store.get(runId);
    if (m) m.status = status;
  },

  recordCompleted(runId: string): void {
    const m = store.get(runId);
    if (m) m.completedCount++;
  },

  recordFailed(runId: string): void {
    const m = store.get(runId);
    if (m) m.failedCount++;
  },

  isActive(runId: string): boolean {
    const m = store.get(runId);
    return m?.status === 'running' || m?.status === 'paused';
  },

  clear(runId: string): void {
    store.delete(runId);
  },

  allRunIds(): readonly string[] {
    return Object.freeze([...store.keys()]);
  },
};
