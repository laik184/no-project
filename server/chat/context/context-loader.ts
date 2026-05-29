/**
 * context-loader.ts — Loads raw data needed to build context.
 * Single responsibility: fetch messages + run metadata from persistence.
 */
import { messageStore }    from '../persistence/message-store.ts';
import { runStore }        from '../persistence/run-store.ts';
import { contextCache }    from './context-cache.ts';
import type { ChatMessageRecord } from '../types/message.types.ts';
import type { ChatRun }    from '../types/run.types.ts';

export interface LoadedContext {
  messages: ChatMessageRecord[];
  run:      ChatRun | null;
}

export const contextLoader = {
  /**
   * Load messages for a run, with cache.
   * Cache is keyed by runId — invalidated when a new message is stored.
   */
  async loadForRun(runId: string): Promise<LoadedContext> {
    const cached = contextCache.get(runId);
    if (cached) return cached;

    const [messages, run] = await Promise.all([
      messageStore.listByRun(runId),
      runStore.findById(runId),
    ]);

    const loaded: LoadedContext = { messages, run };
    contextCache.set(runId, loaded);
    return loaded;
  },

  /**
   * Load recent project messages — used when no runId is active.
   */
  async loadForProject(projectId: number, limit = 40): Promise<ChatMessageRecord[]> {
    return messageStore.listByProject(projectId, limit);
  },

  /**
   * Invalidate cached context for a run (call after new message is stored).
   */
  invalidate(runId: string): void {
    contextCache.delete(runId);
  },
};
