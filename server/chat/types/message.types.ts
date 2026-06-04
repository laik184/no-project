export type MessageRole   = 'user' | 'assistant' | 'system' | 'tool';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

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

export interface ToolCallRecord {
  tool:        string;
  args:        Record<string, unknown>;
  result?:     unknown;
  status:      'running' | 'done' | 'error';
  durationMs?: number;
}

export interface StreamChunk {
  runId:     string;
  projectId: number;
  token:     string;
  seqIndex:  number;
  ts:        number;
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
