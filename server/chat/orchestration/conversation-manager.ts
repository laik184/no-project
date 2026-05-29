/**
 * conversation-manager.ts — Conversation state lifecycle only.
 * Owns: create, get, list, archive conversations.
 * Delegates persistence to conversationStore.
 */
import { conversationStore } from '../persistence/conversation-store.ts';
import type {
  Conversation,
  ConversationSummary,
  ConversationStatus,
} from '../types/chat.types.ts';

export class ConversationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ConversationError';
  }
}

export const conversationManager = {
  /**
   * Create a new conversation for a project, seeding the title from the first goal.
   */
  create(projectId: number, goal: string): Conversation {
    return conversationStore.create(projectId, goal);
  },

  /**
   * Get a conversation by ID. Throws if not found.
   */
  getOrThrow(conversationId: string): Conversation {
    const conv = conversationStore.get(conversationId);
    if (!conv) {
      throw new ConversationError(
        `Conversation ${conversationId} not found`,
        'NOT_FOUND',
      );
    }
    return conv;
  },

  /**
   * Get a conversation by ID, or null.
   */
  get(conversationId: string): Conversation | null {
    return conversationStore.get(conversationId);
  },

  /**
   * List all conversations for a project (sorted newest-first).
   */
  listByProject(projectId: number): ConversationSummary[] {
    return conversationStore.listByProject(projectId);
  },

  /**
   * Record that a new message was added to the conversation.
   */
  onMessageAdded(conversationId: string): void {
    conversationStore.incrementMessageCount(conversationId);
  },

  /**
   * Archive or delete a conversation.
   */
  setStatus(conversationId: string, status: ConversationStatus): void {
    const conv = conversationStore.get(conversationId);
    if (!conv) {
      throw new ConversationError(
        `Conversation ${conversationId} not found`,
        'NOT_FOUND',
      );
    }
    conversationStore.setStatus(conversationId, status);
  },
};
