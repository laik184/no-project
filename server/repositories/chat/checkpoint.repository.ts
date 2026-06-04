/**
 * server/repositories/chat/checkpoint.repository.ts
 *
 * Repository for DB-only checkpoint operations.
 * Complex business logic (filesystem snapshot/restore) remains in checkpoint-store.ts.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure/index.ts';
import { checkpoints, rollbackHistory } from '../../../shared/schema.ts';
import type { ChatCheckpoint, CheckpointTrigger } from '../../chat/types/checkpoint.types.ts';

function rowToCheckpoint(row: typeof checkpoints.$inferSelect): ChatCheckpoint {
  return {
    id:            row.checkpointId,
    runId:         row.runId ?? '',
    projectId:     row.projectId,
    title:         row.label ?? 'Checkpoint',
    description:   row.description ?? '',
    trigger:       (row.trigger as CheckpointTrigger) ?? 'run_complete',
    filesChanged:  row.fileCount,
    createdFiles:  (row.createdFiles as string[]) ?? [],
    modifiedFiles: (row.modifiedFiles as string[]) ?? [],
    deletedFiles:  (row.deletedFiles as string[]) ?? [],
    createdAt:     row.createdAt,
    gitCommitSha:  row.gitCommitSha ?? undefined,
  };
}

export const checkpointRepository = {
  async findById(checkpointId: string): Promise<ChatCheckpoint | null> {
    const rows = await db.select().from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId)).limit(1);
    return rows[0] ? rowToCheckpoint(rows[0]) : null;
  },

  async findRowById(checkpointId: string): Promise<typeof checkpoints.$inferSelect | null> {
    const rows = await db.select().from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId)).limit(1);
    return rows[0] ?? null;
  },

  async list(projectId: number): Promise<ChatCheckpoint[]> {
    const rows = await db.select().from(checkpoints)
      .where(eq(checkpoints.projectId, projectId));
    return rows.map(rowToCheckpoint);
  },

  async delete(checkpointId: string): Promise<boolean> {
    const rows = await db.select({ id: checkpoints.id }).from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId)).limit(1);
    if (rows.length === 0) return false;
    await db.delete(checkpoints).where(eq(checkpoints.checkpointId, checkpointId));
    return true;
  },

  async markRolledBack(checkpointId: string): Promise<void> {
    await db.update(checkpoints).set({ status: 'rolled_back' })
      .where(eq(checkpoints.checkpointId, checkpointId));
  },

  async insertRollbackHistory(
    checkpointId: string,
    rollbackId:   string,
    projectId:    number,
    runId:        string | null,
    restoredFiles: string[],
  ): Promise<void> {
    await db.insert(rollbackHistory).values({
      checkpointId,
      projectId,
      runId,
      scope:         'full',
      status:        'completed',
      restoredFiles: restoredFiles as unknown as string[],
      triggeredAt:   new Date(),
    });
  },
};
