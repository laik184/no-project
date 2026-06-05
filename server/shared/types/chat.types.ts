/**
 * server/shared/types/chat.types.ts
 *
 * Shared chat domain types used by the repository layer.
 * Repositories MUST import from here — never from server/chat/types/*.
 * The chat layer re-exports these so existing consumers are unaffected.
 */

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageRole   = 'user' | 'assistant' | 'system' | 'tool';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

export interface ToolCallRecord {
  tool:        string;
  args:        Record<string, unknown>;
  result?:     unknown;
  status:      'running' | 'done' | 'error';
  durationMs?: number;
}

export interface ChatMessageRecord {
  id:          number;
  projectId:   number;
  runId?:      string;
  role:        MessageRole;
  content:     string;
  tokensUsed:  number;
  toolCalls?:  ToolCallRecord[];
  feedback?:   'up' | 'down';
  createdAt:   Date;
}

export interface AssistantMessagePayload {
  projectId:   number;
  runId?:      string;
  content:     string;
  toolCalls?:  ToolCallRecord[];
  tokensUsed?: number;
}

export interface UserMessagePayload {
  projectId: number;
  runId?:    string;
  content:   string;
}

export interface SystemMessagePayload {
  projectId: number;
  content:   string;
  runId?:    string;
}

// ── Run types ─────────────────────────────────────────────────────────────────

export type RunMode   = 'planned' | 'direct' | 'auto';
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

// ── Checkpoint types ──────────────────────────────────────────────────────────

export type CheckpointTrigger =
  | 'run_complete'
  | 'files_threshold'
  | 'phase_complete'
  | 'loop_end'
  | 'manual';

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
