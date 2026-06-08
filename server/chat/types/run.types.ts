import type { RunMode, RunStatus, ChatRun } from '../../shared/types/chat.types.ts';
export type { RunMode, RunStatus, ChatRun };

export interface RunStartPayload {
  projectId:       number;
  goal:            string;
  mode?:           RunMode;
  conversationId?: string;
  context?:        Record<string, unknown>;
}

export interface RunCancelResult {
  runId:      string;
  cancelled:  boolean;
  reason?:    string;
}

export interface RunStatusResult {
  runId:        string;
  status:       RunStatus;
  startedAt:    Date;
  completedAt?: Date;
  durationMs?:  number;
}
