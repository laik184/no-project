export type {
  CheckpointTrigger,
  ChatCheckpoint,
} from '../../shared/types/chat.types.ts';

export interface CheckpointListItem {
  id:            string;
  runId:         string;
  projectId:     number;
  label:         string;
  title:         string;
  description:   string;
  trigger:       CheckpointTrigger;
  status:        string;
  filesChanged:  number;
  createdFiles:  string[];
  modifiedFiles: string[];
  deletedFiles:  string[];
  createdAt:     Date;
  gitCommitSha?: string;
  gitSha?:       string;
}

export interface RollbackResult {
  ok:             boolean;
  checkpointId:   string;
  filesRestored:  number;
  rollbackId?:    string;
  error?:         string;
}

export interface SnapshotDiff {
  added:        string[];
  removed:      string[];
  modified:     string[];
  totalChanges: number;
}
