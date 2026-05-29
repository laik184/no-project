/**
 * conversation-store.ts — In-memory conversation state store.
 *
 * Conversations are logical groupings of runs per project.
 * Stored in memory (TTL-backed map) — DB persistence can be added
 * when a conversations table is added to the schema.
 */
import type { Conversation, ConversationSummary, ConversationStatus } from '../types/chat.types.ts';
import { MAX_TITLE_LENGTH } from '../constants/chat.constants.ts';
import crypto from 'crypto';

const _store = new Map<string, Conversation>();

function makeId(): string {
  return crypto.randomUUID();
}

function deriveTitleFromGoal(goal: string): string {
  const trimmed = goal.trim().replace(/\s+/g, ' ');
  return trimmed.length <= MAX_TITLE_LENGTH
    ? trimmed
    : trimmed.slice(0, MAX_TITLE_LENGTH - 1) + '…';
}

export const conversationStore = {
  create(projectId: number, goal: string): Conversation {
    const now = new Date();
    const conv: Conversation = {
      conversationId: makeId(),
      projectId,
      status:         'active',
      title:          deriveTitleFromGoal(goal),
      messageCount:   0,
      createdAt:      now,
      updatedAt:      now,
    };
    _store.set(conv.conversationId, conv);
    return conv;
  },

  get(conversationId: string): Conversation | null {
    return _store.get(conversationId) ?? null;
  },

  listByProject(projectId: number): ConversationSummary[] {
    const result: ConversationSummary[] = [];
    for (const conv of _store.values()) {
      if (conv.projectId === projectId) {
        result.push({
          conversationId: conv.conversationId,
          projectId:      conv.projectId,
          title:          conv.title,
          status:         conv.status,
          messageCount:   conv.messageCount,
          lastMessageAt:  conv.lastMessageAt,
          createdAt:      conv.createdAt,
        });
      }
    }
    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  incrementMessageCount(conversationId: string): void {
    const conv = _store.get(conversationId);
    if (!conv) return;
    conv.messageCount += 1;
    conv.lastMessageAt = new Date();
    conv.updatedAt     = new Date();
  },

  setStatus(conversationId: string, status: ConversationStatus): void {
    const conv = _store.get(conversationId);
    if (!conv) return;
    conv.status    = status;
    conv.updatedAt = new Date();
  },

  delete(conversationId: string): void {
    _store.delete(conversationId);
  },
};
