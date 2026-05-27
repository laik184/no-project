import fs from 'fs/promises';
import { fileReader } from '../filesystem/file-reader.ts';
import { fileSearch } from '../filesystem/file-search.ts';
import { generateCheckpointId } from '../utils/execution-helpers.ts';
import { executorLogger } from '../telemetry/executor-logger.ts';
import type { CheckpointData } from '../types/execution.types.ts';

const checkpoints = new Map<string, CheckpointData>();

export const checkpointManager = {
  async create(
    runId:     string,
    taskId:    string,
    projectId: string,
  ): Promise<CheckpointData> {
    const checkpointId = generateCheckpointId();
    const files = await fileSearch.listDir(projectId, '.', true).catch(() => [] as string[]);

    const snapshots: CheckpointData['filesSnapshot'] = [];
    for (const filePath of files.slice(0, 50)) {
      try {
        const content = await fileReader.read(projectId, filePath);
        snapshots.push({ path: filePath, content });
      } catch { /* skip unreadable */ }
    }

    const ckpt: CheckpointData = {
      checkpointId,
      taskId,
      runId,
      filesSnapshot: snapshots,
      createdAt:     new Date(),
    };

    checkpoints.set(checkpointId, ckpt);
    executorLogger.info(runId, `Checkpoint created: ${checkpointId}`, {
      taskId,
      filesSnapshotted: snapshots.length,
    });

    return ckpt;
  },

  get(checkpointId: string): CheckpointData | undefined {
    return checkpoints.get(checkpointId);
  },

  listByTask(taskId: string): CheckpointData[] {
    return Array.from(checkpoints.values()).filter((c) => c.taskId === taskId);
  },

  listByRun(runId: string): CheckpointData[] {
    return Array.from(checkpoints.values()).filter((c) => c.runId === runId);
  },

  remove(checkpointId: string): void {
    checkpoints.delete(checkpointId);
  },

  pruneOlderThan(runId: string, keepLatest: number): void {
    const byRun = checkpointManager.listByRun(runId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    byRun.slice(keepLatest).forEach((c) => checkpoints.delete(c.checkpointId));
  },
};
