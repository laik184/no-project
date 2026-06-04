import { conversationStore } from '../persistence/conversation-store.ts';
import type { Conversation, ConversationSummary, ConversationStatus } from '../types/chat.types.ts';

export class ConversationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ConversationError';
  }
}

export const conversationManager = {
  create(projectId: number, goal: string): Conversation {
    return conversationStore.create(projectId, goal);
  },

  get(conversationId: string): Conversation | null {
    return conversationStore.get(conversationId);
  },

  getOrThrow(conversationId: string): Conversation {
    const conv = conversationStore.get(conversationId);
    if (!conv) throw new ConversationError(`Conversation ${conversationId} not found`, 'NOT_FOUND');
    return conv;
  },

  listByProject(projectId: number): ConversationSummary[] {
    return conversationStore.listByProject(projectId);
  },

  onMessageAdded(conversationId: string): void {
    conversationStore.incrementMessageCount(conversationId);
  },

  setStatus(conversationId: string, status: ConversationStatus): void {
    conversationStore.setStatus(conversationId, status);
  },
};
