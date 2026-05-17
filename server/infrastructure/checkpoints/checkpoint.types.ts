/**
 * checkpoint.types.ts
 * Shared types for the checkpoint / rollback system.
 */

export type CheckpointTrigger =
  | "run_start"
  | "run_complete"
  | "run_failed"
  | "manual"
  | "pre_destructive";

export type CheckpointStatus =
  | "creating"
  | "stable"
  | "rolled_back"
  | "failed";

export type RollbackStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export type RestoreScope =
  | "full_run"
  | "single_file"
  | "emergency";

/** A single file captured in a snapshot */
export interface SnapshotFile {
  relativePath: string;
  content:      string;
  sizeBytes:    number;
}

/** Lightweight metadata stored alongside git commit */
export interface CheckpointMeta {
  checkpointId: string;
  projectId:    number;
  runId?:       string;
  trigger:      CheckpointTrigger;
  status:       CheckpointStatus;
  gitCommitSha: string | null;
  fileCount:    number;
  createdAt:    number;
  label?:       string;
}

/** Result of a rollback operation */
export interface RollbackResult {
  success:         boolean;
  checkpointId:    string;
  restoredFiles:   string[];
  skippedFiles:    string[];
  error?:          string;
  gitResetSha?:    string;
}

/** Options for creating a checkpoint */
export interface CreateCheckpointOptions {
  projectId:    number;
  sandboxRoot:  string;
  trigger:      CheckpointTrigger;
  runId?:       string;
  label?:       string;
}

/** Options for rolling back to a checkpoint */
export interface RollbackOptions {
  checkpointId: string;
  projectId:    number;
  sandboxRoot:  string;
  scope:        RestoreScope;
  filePath?:    string;
}
