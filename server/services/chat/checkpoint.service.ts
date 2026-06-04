/**
 * server/services/chat/checkpoint.service.ts
 *
 * Checkpoint operations service — business facade over checkpoint-store.
 *
 * Owns: create checkpoint, manual checkpoint, rollback, diff, delete.
 * Delegates persistence to server/chat/persistence/checkpoint-store.ts.
 */

import { chatCheckpointStore } from '../../chat/persistence/checkpoint-store.ts';
import type {
  ChatCheckpoint,
  CheckpointTrigger,
  RollbackResult,
  SnapshotDiff,
} from '../../chat/types/checkpoint.types.ts';

export type { ChatCheckpoint, CheckpointTrigger, RollbackResult, SnapshotDiff };

export const checkpointService = {
  /**
   * Create a checkpoint automatically at end of a run.
   * Captures changed files from diffQueue + toolExecutions for this run.
   */
  createForRun(
    runId:     string,
    projectId: number,
    goal:      string,
    trigger:   CheckpointTrigger = 'run_complete',
  ): Promise<ChatCheckpoint> {
    return chatCheckpointStore.createForRun(runId, projectId, goal, trigger);
  },

  /**
   * Create a manual checkpoint — full workspace snapshot.
   * Used by the "Save" button in CheckpointPanel.
   */
  createManual(projectId: number, label: string): Promise<ChatCheckpoint> {
    return chatCheckpointStore.createManual(projectId, label);
  },

  /**
   * List all checkpoints for a project, newest-first.
   */
  listByProject(projectId: number, limit = 20): Promise<ChatCheckpoint[]> {
    return chatCheckpointStore.listByProject(projectId, limit);
  },

  /**
   * Find a specific checkpoint by ID.
   */
  findById(checkpointId: string): Promise<ChatCheckpoint | null> {
    return chatCheckpointStore.findById(checkpointId);
  },

  /**
   * Roll back to a checkpoint — restores all tracked file snapshots.
   */
  rollback(checkpointId: string): Promise<RollbackResult> {
    return chatCheckpointStore.rollback(checkpointId);
  },

  /**
   * File-level diff between two checkpoint snapshots.
   */
  diff(checkpointId: string, compareId: string): Promise<SnapshotDiff> {
    return chatCheckpointStore.diffCheckpoints(checkpointId, compareId);
  },

  /**
   * Permanently delete a checkpoint record.
   */
  delete(checkpointId: string): Promise<boolean> {
    return chatCheckpointStore.deleteCheckpoint(checkpointId);
  },
};
