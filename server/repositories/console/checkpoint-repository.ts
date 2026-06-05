/**
 * server/repositories/console/checkpoint-repository.ts
 *
 * Delegates to the persistence layer for checkpoint storage.
 * Never imports infrastructure directly.
 */

import { postgresCheckpointStore } from '../../console/persistence/index.ts';
import type { CheckpointSummary }  from '../../console/persistence/index.ts';
import type { Checkpoint }         from '../../../shared/schema.ts';

export type { CheckpointSummary };

export interface ICheckpointRepository {
  create(projectId: number, data: { trigger: string; label?: string; description?: string }): Promise<CheckpointSummary>;
  restore(checkpointId: string): Promise<Checkpoint | undefined>;
  list(projectId: number, limit?: number): Promise<CheckpointSummary[]>;
  delete(checkpointId: string): Promise<void>;
}

class CheckpointRepository implements ICheckpointRepository {
  create(
    projectId: number,
    data: { trigger: string; label?: string; description?: string },
  ): Promise<CheckpointSummary> {
    return postgresCheckpointStore.create(projectId, data);
  }

  restore(checkpointId: string): Promise<Checkpoint | undefined> {
    return postgresCheckpointStore.restore(checkpointId);
  }

  list(projectId: number, limit = 20): Promise<CheckpointSummary[]> {
    return postgresCheckpointStore.list(projectId, limit);
  }

  delete(checkpointId: string): Promise<void> {
    return postgresCheckpointStore.delete(checkpointId);
  }
}

export const checkpointRepository: ICheckpointRepository = new CheckpointRepository();
