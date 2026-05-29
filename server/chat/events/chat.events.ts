/**
 * chat.events.ts — Chat domain event definitions.
 * Pure type + factory — no side effects, no I/O.
 */
import type { ChatEventType } from '../types/event.types.ts';
import { CHAT_EVENT } from '../constants/event.constants.ts';

export interface ChatMessageCreatedEvent {
  type:      typeof CHAT_EVENT.MESSAGE_CREATED;
  projectId: number;
  runId?:    string;
  messageId: number;
  role:      string;
  ts:        number;
}

export interface ChatMessageUpdatedEvent {
  type:      typeof CHAT_EVENT.MESSAGE_UPDATED;
  projectId: number;
  messageId: number;
  field:     'feedback' | 'content';
  ts:        number;
}

export function makeMessageCreatedEvent(
  projectId: number,
  messageId: number,
  role:      string,
  runId?:    string,
): ChatMessageCreatedEvent {
  return { type: CHAT_EVENT.MESSAGE_CREATED, projectId, messageId, role, runId, ts: Date.now() };
}

export function makeMessageUpdatedEvent(
  projectId: number,
  messageId: number,
  field:     'feedback' | 'content',
): ChatMessageUpdatedEvent {
  return { type: CHAT_EVENT.MESSAGE_UPDATED, projectId, messageId, field, ts: Date.now() };
}

export type AnyChatEvent = ChatMessageCreatedEvent | ChatMessageUpdatedEvent;

/** Type guard — narrows to a chat domain event. */
export function isChatEvent(v: unknown): v is AnyChatEvent {
  return typeof v === 'object' && v !== null &&
    typeof (v as Record<string, unknown>).type === 'string' &&
    (v as Record<string, unknown>).type.toString().startsWith('chat.');
}
