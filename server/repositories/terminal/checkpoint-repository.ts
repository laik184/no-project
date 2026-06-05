/**
 * server/repositories/terminal/checkpoint-repository.ts
 *
 * Thin facade over the chat checkpoint repository.
 * Delegates to the DB-backed chat layer for persistence.
 * Uses static imports from infrastructure — dynamic imports are an anti-pattern.
 */

import { randomUUID }                                        from 'crypto';
import { checkpointRepository as chatCheckpointRepo }        from '../chat/checkpoint.repository.ts';
import type { ChatCheckpoint }                               from '../../shared/types/chat.types.ts';
import { db, bus }                                           from '../../infrastructure/index.ts';
import { checkpoints }                                       from '../../../shared/schema.ts';

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
    const checkpointId = randomUUID();

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

    bus.emit('checkpoint', { checkpointId, projectId, trigger: data.trigger });

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
