/**
 * message-builder.ts — Builds persisted chat messages.
 * Single responsibility: coordinate messageStore inserts + event emission.
 */
import { messageStore } from '../persistence/message-store.ts';
import { eventPublisher } from '../realtime/event-publisher.ts';
import { makeMessageCreatedEvent } from '../events/chat.events.ts';
import type {
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../types/message.types.ts';

export const messageBuilder = {
  async buildUser(payload: UserMessagePayload): Promise<ChatMessageRecord> {
    const record = await messageStore.insertUser(payload);
    eventPublisher.publish(makeMessageCreatedEvent(
      record.projectId, record.id, 'user', record.runId,
    ));
    return record;
  },

  async buildAssistant(payload: AssistantMessagePayload): Promise<ChatMessageRecord> {
    const record = await messageStore.insertAssistant(payload);
    eventPublisher.publish(makeMessageCreatedEvent(
      record.projectId, record.id, 'assistant', record.runId,
    ));
    return record;
  },

  async buildSystem(payload: SystemMessagePayload): Promise<ChatMessageRecord> {
    const record = await messageStore.insertSystem(payload);
    eventPublisher.publish(makeMessageCreatedEvent(
      record.projectId, record.id, 'system', record.runId,
    ));
    return record;
  },
};
