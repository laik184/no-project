/**
 * server/agents/terminal/recovery/checkpoint-manager.ts
 *
 * Agent-layer checkpoint manager.
 * Records lightweight execution checkpoints per run for recovery purposes.
 *
 * Consumed by: server/agents/executor/engine.ts, step-runner.ts
 *   checkpointManager.create(runId, projectId, taskId)
 *   checkpointManager.pruneOlderThan(runId, maxToKeep)
 */

import { randomUUID }  from 'crypto';
import type { CheckpointEntry } from '../types/terminal.types.ts';
import { terminalLogger }       from '../telemetry/terminal-logger.ts';

const store = new Map<string, CheckpointEntry[]>();

export const checkpointManager = {
  /**
   * Record a checkpoint for a run/task.
   * Async to match the interface expected by the executor.
   */
  async create(runId: string, projectId: string, taskId: string): Promise<void> {
    if (!store.has(runId)) store.set(runId, []);
    const entry: CheckpointEntry = {
      id:        randomUUID().replace(/-/g, '').slice(0, 12),
      runId,
      projectId,
      taskId,
      createdAt: Date.now(),
    };
    store.get(runId)!.push(entry);
    terminalLogger.debug(runId, `Checkpoint created`, { id: entry.id, taskId });
  },

  /**
   * Keep only the N most recent checkpoints for a run.
   * Older ones are discarded to bound memory usage.
   */
  pruneOlderThan(runId: string, maxToKeep: number): void {
    const list = store.get(runId);
    if (!list || list.length <= maxToKeep) return;
    const pruned = list.splice(0, list.length - maxToKeep);
    terminalLogger.debug(runId, `Pruned ${pruned.length} old checkpoint(s)`, { maxToKeep });
  },

  listForRun(runId: string): readonly CheckpointEntry[] {
    return Object.freeze(store.get(runId) ?? []);
  },

  latestForRun(runId: string): CheckpointEntry | undefined {
    const list = store.get(runId);
    return list?.[list.length - 1];
  },

  clearRun(runId: string): void {
    store.delete(runId);
  },
};
