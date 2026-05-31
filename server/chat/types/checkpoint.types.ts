/**
 * server/chat/types/checkpoint.types.ts
 * Typed contracts for the chat-module checkpoint system.
 */

export interface ChatCheckpoint {
  id:            string;
  runId:         string;
  projectId:     number;
  title:         string;
  description:   string;
  trigger:       CheckpointTrigger;
  filesChanged:  number;
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
  createdAt:     Date;
  gitCommitSha?: string;
}

export type CheckpointTrigger =
  | 'run_complete'
  | 'files_threshold'
  | 'phase_complete'
  | 'loop_end'
  | 'manual';

export interface CheckpointSSEPayload {
  eventType:     'checkpoint.created' | 'checkpoint.updated' | 'checkpoint.rollback';
  checkpointId:  string;
  runId:         string;
  projectId:     number;
  title:         string;
  description:   string;
  timestamp:     string;
  filesChanged:  number;
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
  gitCommitSha?: string;
}

export interface RollbackResult {
  ok:            boolean;
  checkpointId:  string;
  filesRestored: number;
  rollbackId?:   string;
  error?:        string;
}

export interface CheckpointListItem {
  id:            string;
  runId:         string;
  projectId:     number;
  /** Human-readable label (≡ title in DB). */
  label:         string;
  title:         string;
  description:   string;
  trigger:       CheckpointTrigger;
  status:        'stable' | 'rolled_back' | 'failed' | 'creating';
  filesChanged:  number;
  fileCount:     number;
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
  createdAt:     string;
  gitCommitSha?: string;
  /** Alias for gitCommitSha, short form. */
  gitSha?:       string;
}

export interface SnapshotDiff {
  added:        string[];
  removed:      string[];
  modified:     string[];
  totalChanges: number;
}

/** Emitted on the 'checkpoint' SSE topic when a checkpoint is deleted. */
export interface CheckpointDeleteEvent {
  eventType:    'checkpoint.deleted';
  checkpointId: string;
  projectId:    number;
  timestamp:    string;
}
