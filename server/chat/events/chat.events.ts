import type { ChatEventType, ChatEvent } from '../types/event.types.ts';

export type AnyChatEvent = ChatEvent;

export function makeMessageCreatedEvent(
  projectId: number,
  messageId: number,
  role:      string,
  runId?:    string,
): AnyChatEvent {
  return {
    type:      'chat.message.created' as ChatEventType,
    projectId,
    runId,
    ts:        Date.now(),
    payload:   { messageId, role },
  };
}

export function makeMessageUpdatedEvent(
  projectId: number,
  messageId: number,
  runId?:    string,
): AnyChatEvent {
  return {
    type:    'chat.message.updated' as ChatEventType,
    projectId,
    runId,
    ts:      Date.now(),
    payload: { messageId },
  };
}
