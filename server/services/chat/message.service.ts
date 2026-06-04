/**
 * server/services/chat/message.service.ts
 *
 * Service facade for chat message operations.
 * Controllers must call this service — never the persistence store directly.
 */

import { messageStore } from '../../chat/persistence/message-store.ts';
import type {
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../../chat/types/message.types.ts';

export const messageService = {
  async insertUser(payload: UserMessagePayload): Promise<ChatMessageRecord> {
    return messageStore.insertUser(payload);
  },

  async insertAssistant(payload: AssistantMessagePayload): Promise<ChatMessageRecord> {
    return messageStore.insertAssistant(payload);
  },

  async insertSystem(payload: SystemMessagePayload): Promise<ChatMessageRecord> {
    return messageStore.insertSystem(payload);
  },

  async listByProject(projectId: number, limit = 50): Promise<ChatMessageRecord[]> {
    return messageStore.listByProject(projectId, limit);
  },

  async listByRun(runId: string): Promise<ChatMessageRecord[]> {
    return messageStore.listByRun(runId);
  },

  async setFeedback(messageId: number, feedback: 'up' | 'down'): Promise<void> {
    return messageStore.setFeedback(messageId, feedback);
  },

  async findById(messageId: number): Promise<ChatMessageRecord | null> {
    return messageStore.findById(messageId);
  },
};
