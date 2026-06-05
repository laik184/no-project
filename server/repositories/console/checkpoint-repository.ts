/**
 * server/repositories/console/checkpoint-repository.ts
 *
 * Delegates to the existing checkpoints table.
 * Console module uses checkpoints for crash-recovery snapshots.
 */

import { desc, eq } from 'drizzle-orm';
import { db }          from '../../infrastructure/db/index.ts';
import { checkpoints } from '../../../shared/schema.ts';
import type { Checkpoint } from '../../../shared/schema.ts';

export interface CheckpointSummary {
  checkpointId: string;
  projectId:    number;
  trigger:      string;
  status:       string;
  label:        string | null;
  createdAt:    Date;
}

export interface ICheckpointRepository {
  create(projectId: number, data: { trigger: string; label?: string; description?: string }): Promise<CheckpointSummary>;
  restore(checkpointId: string): Promise<Checkpoint | undefined>;
  list(projectId: number, limit?: number): Promise<CheckpointSummary[]>;
  delete(checkpointId: string): Promise<void>;
}

import { randomUUID } from 'crypto';

class CheckpointRepository implements ICheckpointRepository {
  async create(
    projectId: number,
    data: { trigger: string; label?: string; description?: string },
  ): Promise<CheckpointSummary> {
    const checkpointId = randomUUID();

    const [row] = await db
      .insert(checkpoints)
      .values({
        checkpointId,
        projectId,
        trigger:     data.trigger,
        label:       data.label ?? null,
        description: data.description ?? null,
        status:      'stable',
        fileCount:   0,
      })
      .returning();

    return {
      checkpointId: row.checkpointId,
      projectId:    row.projectId,
      trigger:      row.trigger,
      status:       row.status,
      label:        row.label,
      createdAt:    row.createdAt,
    };
  }

  async restore(checkpointId: string): Promise<Checkpoint | undefined> {
    const [row] = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId))
      .limit(1);

    return row;
  }

  async list(projectId: number, limit = 20): Promise<CheckpointSummary[]> {
    const rows = await db
      .select({
        checkpointId: checkpoints.checkpointId,
        projectId:    checkpoints.projectId,
        trigger:      checkpoints.trigger,
        status:       checkpoints.status,
        label:        checkpoints.label,
        createdAt:    checkpoints.createdAt,
      })
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId))
      .orderBy(desc(checkpoints.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, createdAt: r.createdAt! }));
  }

  async delete(checkpointId: string): Promise<void> {
    await db
      .delete(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId));
  }
}

export const checkpointRepository: ICheckpointRepository = new CheckpointRepository();
