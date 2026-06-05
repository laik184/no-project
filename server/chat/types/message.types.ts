export type {
  MessageRole,
  MessageStatus,
  ToolCallRecord,
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../../shared/types/chat.types.ts';

export interface StreamChunk {
  runId:     string;
  projectId: number;
  token:     string;
  seqIndex:  number;
  ts:        number;
}
