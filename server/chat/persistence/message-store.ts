import { messageRepository } from '../../repositories/chat/message.repository.ts';
import type {
  ChatMessageRecord,
  AssistantMessagePayload,
  UserMessagePayload,
  SystemMessagePayload,
} from '../types/message.types.ts';

export const messageStore = {
  async insertUser(payload: UserMessagePayload): Promise<ChatMessageRecord> {
    return messageRepository.insertUser(payload);
  },

  async insertAssistant(payload: AssistantMessagePayload): Promise<ChatMessageRecord> {
    return messageRepository.insertAssistant(payload);
  },

  async insertSystem(payload: SystemMessagePayload): Promise<ChatMessageRecord> {
    return messageRepository.insertSystem(payload);
  },

  async listByProject(projectId: number, limit = 50): Promise<ChatMessageRecord[]> {
    return messageRepository.listByProject(projectId, limit);
  },

  async listByRun(runId: string): Promise<ChatMessageRecord[]> {
    return messageRepository.listByRun(runId);
  },

  async setFeedback(messageId: number, feedback: 'up' | 'down'): Promise<void> {
    return messageRepository.setFeedback(messageId, feedback);
  },

  async findById(messageId: number): Promise<ChatMessageRecord | null> {
    return messageRepository.findById(messageId);
  },
};
