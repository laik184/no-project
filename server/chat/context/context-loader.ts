import { messageStore }  from '../persistence/message-store.ts';
import { runStore }      from '../persistence/run-store.ts';
import { contextCache }  from './context-cache.ts';
import type { ChatMessageRecord } from '../types/message.types.ts';
import type { LoadedContext } from './context-cache.ts';

export type { LoadedContext };

export const contextLoader = {
  async loadForRun(runId: string): Promise<LoadedContext> {
    const cached = contextCache.get(runId);
    if (cached) return cached;

    const [messages, run] = await Promise.all([
      messageStore.listByRun(runId),
      runStore.findById(runId),
    ]);

    const result: LoadedContext = { messages, run };
    contextCache.set(runId, result);
    return result;
  },

  async loadForProject(projectId: number, limit = 40): Promise<ChatMessageRecord[]> {
    return messageStore.listByProject(projectId, limit);
  },

  invalidate(runId: string): void {
    contextCache.delete(runId);
  },
};
