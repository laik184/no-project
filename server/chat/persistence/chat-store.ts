import { messageStore } from './message-store.ts';
import { runStore }     from './run-store.ts';
import { HISTORY_PAGE_SIZE } from '../constants/chat.constants.ts';
import type { ChatMessageRecord } from '../types/message.types.ts';
import type { ChatRun } from '../types/run.types.ts';

export interface ChatHistory {
  runs:     ChatRun[];
  messages: ChatMessageRecord[];
  total:    number;
  page:     number;
  limit:    number;
}

export const chatStore = {
  async getHistory(
    projectId: number,
    page  = 1,
    limit = HISTORY_PAGE_SIZE,
  ): Promise<ChatHistory> {
    const runs     = await runStore.listByProject(projectId, limit * page);
    const paginated = runs.slice((page - 1) * limit, page * limit);
    const messages  = await messageStore.listByProject(projectId, limit * 10);
    return { runs: paginated, messages, total: runs.length, page, limit };
  },

  async getRunMessages(runId: string): Promise<ChatMessageRecord[]> {
    return messageStore.listByRun(runId);
  },

  async getActiveRun(projectId: number): Promise<ChatRun | null> {
    return runStore.findActiveByProject(projectId);
  },
};
