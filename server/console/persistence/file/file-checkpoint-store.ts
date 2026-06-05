/**
 * server/console/persistence/file/file-checkpoint-store.ts
 *
 * File-backed checkpoint store for offline / no-DB environments.
 * Stub implementation — activate when file persistence is needed.
 */

import type { CheckpointSummary } from '../postgres/postgres-checkpoint-store.ts';

export const fileCheckpointStore = {
  /** Write a checkpoint manifest to disk. */
  async write(_projectId: number, _summary: CheckpointSummary): Promise<void> {
    // TODO: write JSON to .sandbox/.checkpoints/<checkpointId>.json
  },

  /** List checkpoint manifests for a project. */
  async list(_projectId: number): Promise<CheckpointSummary[]> {
    // TODO: glob + parse JSON files
    return [];
  },

  /** Delete a checkpoint manifest from disk. */
  async delete(_checkpointId: string): Promise<void> {
    // TODO: unlink file
  },
};
