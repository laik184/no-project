/**
 * server/services/chat/run.service.ts
 *
 * Service facade for chat run operations.
 * Controllers must call this service — never the persistence store directly.
 */

import { runStore }   from '../../chat/persistence/run-store.ts';
import { chatStore }  from '../../chat/persistence/chat-store.ts';
import type { ChatRun } from '../../chat/types/run.types.ts';
import type { ChatHistory } from '../../chat/persistence/chat-store.ts';

export const runService = {
  async findById(runId: string): Promise<ChatRun | null> {
    return runStore.findById(runId);
  },

  async findActiveByProject(projectId: number): Promise<ChatRun | null> {
    return runStore.findActiveByProject(projectId);
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatRun[]> {
    return runStore.listByProject(projectId, limit);
  },

  async isActive(runId: string): Promise<boolean> {
    return runStore.isActive(runId);
  },

  async getHistory(projectId: number, page = 1, limit = 20): Promise<ChatHistory> {
    return chatStore.getHistory(projectId, page, limit);
  },
};
