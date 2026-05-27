import fs   from 'fs/promises';
import path  from 'path';
import { getWorkspaceRoot } from '../workspace/runtime-workspace.ts';
import { runtimeLogger }    from '../telemetry/runtime-logger.ts';

export interface Checkpoint {
  id:          string;
  runId:       string;
  projectId:   string;
  description: string;
  createdAt:   Date;
  snapshotDir: string;
}

const CHECKPOINT_BASE = '.data/checkpoints';
const checkpoints     = new Map<string, Checkpoint>();

export const checkpointManager = {
  async create(
    runId:       string,
    projectId:   string,
    description: string,
  ): Promise<Checkpoint> {
    const id          = `ckpt_${Date.now()}`;
    const snapshotDir = path.resolve(CHECKPOINT_BASE, projectId, id);
    const srcDir      = getWorkspaceRoot(projectId);

    await fs.mkdir(snapshotDir, { recursive: true });
    await fs.cp(srcDir, snapshotDir, { recursive: true }).catch(() => {});

    const ckpt: Checkpoint = {
      id, runId, projectId, description, createdAt: new Date(), snapshotDir,
    };
    checkpoints.set(id, ckpt);
    runtimeLogger.info(runId, `[checkpoint-manager] Created ${id}`, { description });
    return ckpt;
  },

  async restore(checkpointId: string, runId: string): Promise<void> {
    const ckpt = checkpoints.get(checkpointId);
    if (!ckpt) throw new Error(`[checkpoint-manager] Checkpoint not found: ${checkpointId}`);
    const destDir = getWorkspaceRoot(ckpt.projectId);
    await fs.cp(ckpt.snapshotDir, destDir, { recursive: true });
    runtimeLogger.info(runId, `[checkpoint-manager] Restored ${checkpointId}`);
  },

  getForRun: (runId: string): Checkpoint[] =>
    Array.from(checkpoints.values()).filter((c) => c.runId === runId),

  get: (id: string): Checkpoint | undefined => checkpoints.get(id),

  pruneOlderThan(runId: string, keepLatestN: number): void {
    const runCkpts = Array.from(checkpoints.entries())
      .filter(([, c]) => c.runId === runId)
      .sort(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime());

    const toDelete = runCkpts.slice(keepLatestN);
    for (const [id] of toDelete) {
      checkpoints.delete(id);
    }
  },
};
