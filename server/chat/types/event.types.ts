export type ChatEventType =
  | 'chat.message.created'
  | 'chat.message.updated'
  | 'chat.stream.started'
  | 'chat.stream.token'
  | 'chat.stream.ended'
  | 'chat.run.started'
  | 'chat.run.completed'
  | 'chat.run.failed'
  | 'chat.run.cancelled'
  | 'chat.question.asked'
  | 'chat.question.answered'
  | 'chat.attachment.uploaded'
  | 'chat.timeline.event'
  | 'chat.turn.started'
  | 'chat.turn.completed';

export interface ChatEvent {
  type:      ChatEventType;
  projectId: number;
  runId?:    string;
  ts:        number;
  payload:   Record<string, unknown>;
}

export interface StreamStartedEvent {
  type:      string;
  runId:     string;
  projectId: number;
  ts:        number;
}

export interface StreamTokenEvent {
  type:      string;
  runId:     string;
  projectId: number;
  token:     string;
  seqIndex:  number;
  ts:        number;
}

export interface StreamEndedEvent {
  type:         string;
  runId:        string;
  projectId:    number;
  totalTokens:  number;
  durationMs:   number;
  ts:           number;
}

export interface RunStartedEvent {
  type:      string;
  runId:     string;
  projectId: number;
  goal:      string;
  mode:      string;
  ts:        number;
}

export interface RunCompletedEvent {
  type:       string;
  runId:      string;
  projectId:  number;
  durationMs: number;
  ts:         number;
}

export interface RunFailedEvent {
  type:      string;
  runId:     string;
  projectId: number;
  error:     string;
  ts:        number;
}
