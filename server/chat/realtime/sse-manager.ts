import { sseManager as infraSseManager } from '../../infrastructure/index.ts';

export const sseChatManager = {
  getConnectionCount(): number {
    return infraSseManager.connectionCount;
  },

  getTopicStats(): ReturnType<typeof infraSseManager.stats> {
    return infraSseManager.stats();
  },
};
