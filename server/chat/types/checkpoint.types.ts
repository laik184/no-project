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
}

export interface RollbackResult {
  ok:           boolean;
  checkpointId: string;
  filesRestored: number;
  error?:        string;
}

export interface CheckpointListItem {
  id:           string;
  runId:        string;
  projectId:    number;
  title:        string;
  description:  string;
  trigger:      CheckpointTrigger;
  filesChanged: number;
  createdFiles: string[];
  modifiedFiles:string[];
  deletedFiles: string[];
  createdAt:    string;
}

/** Emitted on the 'checkpoint' SSE topic when a checkpoint is deleted. */
export interface CheckpointDeleteEvent {
  eventType:    'checkpoint.deleted';
  checkpointId: string;
  projectId:    number;
  timestamp:    string;
}
