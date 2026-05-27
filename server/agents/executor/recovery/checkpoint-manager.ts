/**
 * checkpoint-manager.ts
 * Creates and restores file-system checkpoints.
 * Uses both in-memory cache (fast access) and disk persistence (crash safety).
 */

import fs   from 'fs/promises';
import path from 'path';
import { fileReader }          from '../filesystem/file-reader.ts';
import { fileSearch }          from '../filesystem/file-search.ts';
import { generateCheckpointId } from '../utils/execution-helpers.ts';
import { executorLogger }       from '../telemetry/executor-logger.ts';
import type { CheckpointData }  from '../types/execution.types.ts';

const CHECKPOINT_DIR = path.join(process.env.AGENT_PROJECT_ROOT ?? '.sandbox', '.checkpoints');
const MAX_SNAPSHOT_FILES = 200;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', '.checkpoints']);

const memCache = new Map<string, CheckpointData>();

async function ensureCheckpointDir(): Promise<void> {
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
}

export const checkpointManager = {
  async create(
    runId:     string,
    taskId:    string,
    projectId: string,
  ): Promise<CheckpointData> {
    const checkpointId = generateCheckpointId();
    const files = await fileSearch.listDir(projectId, '.', true).catch(() => [] as string[]);

    const safeFiles = files.filter((f) => {
      const parts = f.split('/');
      return !parts.some((seg) => SKIP_DIRS.has(seg));
    });

    const snapshots: CheckpointData['filesSnapshot'] = [];
    for (const filePath of safeFiles.slice(0, MAX_SNAPSHOT_FILES)) {
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

    // In-memory cache
    memCache.set(checkpointId, ckpt);

    // Disk persistence
    let diskPath: string | undefined;
    try {
      await ensureCheckpointDir();
      diskPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
      await fs.writeFile(diskPath, JSON.stringify({ ...ckpt, createdAt: ckpt.createdAt.toISOString() }), 'utf8');
      ckpt.diskPath = diskPath;
    } catch (e) {
      executorLogger.warn(runId, `Checkpoint disk write failed: ${(e as Error).message}`);
    }

    executorLogger.info(runId, `Checkpoint created: ${checkpointId}`, {
      taskId,
      filesSnapshotted: snapshots.length,
      diskPath,
    });

    return ckpt;
  },

  get(checkpointId: string): CheckpointData | undefined {
    return memCache.get(checkpointId);
  },

  /** Load a checkpoint from disk if not in memory cache. */
  async load(checkpointId: string): Promise<CheckpointData | undefined> {
    if (memCache.has(checkpointId)) return memCache.get(checkpointId);

    const diskPath = path.join(CHECKPOINT_DIR, `${checkpointId}.json`);
    try {
      const raw  = await fs.readFile(diskPath, 'utf8');
      const data = JSON.parse(raw) as CheckpointData & { createdAt: string };
      const ckpt = { ...data, createdAt: new Date(data.createdAt) };
      memCache.set(checkpointId, ckpt);
      return ckpt;
    } catch {
      return undefined;
    }
  },

  listByTask(taskId: string): CheckpointData[] {
    return Array.from(memCache.values()).filter((c) => c.taskId === taskId);
  },

  listByRun(runId: string): CheckpointData[] {
    return Array.from(memCache.values()).filter((c) => c.runId === runId);
  },

  remove(checkpointId: string): void {
    const ckpt = memCache.get(checkpointId);
    memCache.delete(checkpointId);

    if (ckpt?.diskPath) {
      fs.unlink(ckpt.diskPath).catch(() => { /* best-effort */ });
    }
  },

  pruneOlderThan(runId: string, keepLatest: number): void {
    const byRun = checkpointManager.listByRun(runId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    byRun.slice(keepLatest).forEach((c) => checkpointManager.remove(c.checkpointId));
  },
};
