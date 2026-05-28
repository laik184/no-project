/**
 * server/agents/executor/checkpoint-store.ts
 *
 * Lightweight in-process checkpoint store for the executor.
 * Records task-level checkpoints per run for recovery purposes.
 */

import { randomUUID } from 'crypto';

interface CheckpointEntry {
  id:        string;
  runId:     string;
  projectId: string;
  taskId:    string;
  createdAt: number;
}

const store = new Map<string, CheckpointEntry[]>();

export const checkpointManager = {
  async create(runId: string, projectId: string, taskId: string): Promise<void> {
    if (!store.has(runId)) store.set(runId, []);
    store.get(runId)!.push({
      id:        randomUUID().replace(/-/g, '').slice(0, 12),
      runId, projectId, taskId,
      createdAt: Date.now(),
    });
  },

  pruneOlderThan(runId: string, maxToKeep: number): void {
    const list = store.get(runId);
    if (!list || list.length <= maxToKeep) return;
    list.splice(0, list.length - maxToKeep);
  },

  listForRun(runId: string): readonly CheckpointEntry[] {
    return Object.freeze(store.get(runId) ?? []);
  },

  latestForRun(runId: string): CheckpointEntry | undefined {
    const list = store.get(runId);
    return list?.[list.length - 1];
  },

  clearRun(runId: string): void { store.delete(runId); },
};
