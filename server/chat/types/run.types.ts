export type RunMode   = 'planned' | 'tool-loop';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ChatRun {
  runId:           string;
  projectId:       number;
  conversationId?: string;
  goal:            string;
  mode:            RunMode;
  status:          RunStatus;
  startedAt:       Date;
  completedAt?:    Date;
  durationMs?:     number;
  result?:         unknown;
  error?:          string;
}

export interface RunStartPayload {
  projectId:       number;
  goal:            string;
  mode?:           RunMode;
  conversationId?: string;
  context?:        Record<string, unknown>;
}

export interface RunCancelResult {
  runId:     string;
  cancelled: boolean;
  reason?:   string;
}

export interface RunStatusResult {
  runId:        string;
  status:       RunStatus;
  startedAt:    Date;
  completedAt?: Date;
  durationMs?:  number;
}
