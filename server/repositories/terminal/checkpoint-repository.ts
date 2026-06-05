/**
 * server/repositories/terminal/checkpoint-repository.ts
 *
 * Thin facade over the chat checkpoint repository.
 * Delegates to the DB-backed chat layer — never imports infrastructure directly.
 */

import { checkpointRepository as chatCheckpointRepo } from '../chat/checkpoint.repository.ts';
import type { ChatCheckpoint } from '../../shared/types/chat.types.ts';

export type CheckpointSummary = Pick<
  ChatCheckpoint,
  'id' | 'projectId' | 'runId' | 'title' | 'description' | 'trigger' | 'filesChanged' | 'createdAt'
>;

export interface ICheckpointRepository {
  create(projectId: number, data: { trigger: string; label?: string; description?: string; runId?: string }): Promise<CheckpointSummary>;
  findById(checkpointId: string): Promise<ChatCheckpoint | null>;
  list(projectId: number, limit?: number): Promise<CheckpointSummary[]>;
  delete(checkpointId: string): Promise<boolean>;
  markRolledBack(checkpointId: string): Promise<void>;
}

function toSummary(cp: ChatCheckpoint): CheckpointSummary {
  return {
    id:           cp.id,
    projectId:    cp.projectId,
    runId:        cp.runId,
    title:        cp.title,
    description:  cp.description,
    trigger:      cp.trigger,
    filesChanged: cp.filesChanged,
    createdAt:    cp.createdAt,
  };
}

class CheckpointRepository implements ICheckpointRepository {
  async create(
    projectId: number,
    data: { trigger: string; label?: string; description?: string; runId?: string },
  ): Promise<CheckpointSummary> {
    const { db }         = await import('../../infrastructure/index.ts');
    const { checkpoints } = await import('../../../shared/schema.ts');
    const crypto         = await import('crypto');

    const checkpointId = crypto.randomUUID();
    await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId:         data.runId ?? null,
      label:         (data.label ?? 'Terminal checkpoint').slice(0, 80),
      description:   data.description ?? '',
      trigger:       data.trigger,
      status:        'active',
      fileCount:     0,
      createdFiles:  [] as unknown as string[],
      modifiedFiles: [] as unknown as string[],
      deletedFiles:  [] as unknown as string[],
      gitCommitSha:  null,
    });

    const cp = await chatCheckpointRepo.findById(checkpointId);
    return toSummary(cp!);
  }

  findById(checkpointId: string): Promise<ChatCheckpoint | null> {
    return chatCheckpointRepo.findById(checkpointId);
  }

  async list(projectId: number, _limit = 20): Promise<CheckpointSummary[]> {
    const rows = await chatCheckpointRepo.list(projectId);
    return rows.map(toSummary);
  }

  delete(checkpointId: string): Promise<boolean> {
    return chatCheckpointRepo.delete(checkpointId);
  }

  markRolledBack(checkpointId: string): Promise<void> {
    return chatCheckpointRepo.markRolledBack(checkpointId);
  }
}

export const checkpointRepository: ICheckpointRepository = new CheckpointRepository();
