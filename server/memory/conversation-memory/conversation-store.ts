/**
 * server/memory/conversation-memory/conversation-store.ts
 *
 * Purpose: Persistent store for conversation turns and project dialogue history.
 * Responsibility: CRUD + project/role-based retrieval + turn ordering.
 * Exports: ConversationStore, conversationStore (singleton)
 */

import { BaseMemoryStore }       from '../core/memory-store.ts';
import type { ConversationEntry } from '../types/entry.types.ts';
import type { CreateEntryInput }  from '../types/memory.types.ts';

export interface CreateConversationInput extends Omit<CreateEntryInput, 'category'> {
  projectId:  string;
  role:       ConversationEntry['role'];
  turnIndex:  number;
  summary?:   string;
}

export class ConversationStore extends BaseMemoryStore<ConversationEntry> {
  constructor() { super('conversation'); }

  async record(input: CreateConversationInput): Promise<ConversationEntry> {
    const entry = this.buildEntry(
      { ...input, category: 'conversation' },
      {
        projectId:  input.projectId,
        role:       input.role,
        turnIndex:  input.turnIndex,
        summary:    input.summary,
      },
    );
    this.store.set(entry.id, entry);
    this.persist();
    return entry;
  }

  async byProject(projectId: string): Promise<ConversationEntry[]> {
    return [...this.store.values()]
      .filter(e => e.projectId === projectId)
      .sort((a, b) => a.turnIndex - b.turnIndex);
  }

  async byRole(
    projectId: string,
    role:      ConversationEntry['role'],
  ): Promise<ConversationEntry[]> {
    return (await this.byProject(projectId)).filter(e => e.role === role);
  }

  async latestTurns(projectId: string, count = 10): Promise<ConversationEntry[]> {
    const all = await this.byProject(projectId);
    return all.slice(-count);
  }

  async nextTurnIndex(projectId: string): Promise<number> {
    const turns = await this.byProject(projectId);
    return turns.length === 0 ? 0 : turns[turns.length - 1].turnIndex + 1;
  }
}

export const conversationStore = new ConversationStore();
