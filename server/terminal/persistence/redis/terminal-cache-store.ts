/**
 * server/terminal/persistence/redis/terminal-cache-store.ts
 *
 * Redis-backed cache for recent terminal output and session state.
 * Stub implementation — activate when Redis is provisioned.
 */

import type { TerminalState } from '../../contracts/terminal-state.ts';

export const terminalCacheStore = {
  async setSessionState(_sessionId: string, _state: TerminalState): Promise<void> {
    // TODO: await redis.set(`terminal:state:${_sessionId}`, JSON.stringify(_state), { EX: 3600 });
  },

  async getSessionState(_sessionId: string): Promise<TerminalState | null> {
    // TODO: const raw = await redis.get(`terminal:state:${_sessionId}`);
    // TODO: return raw ? JSON.parse(raw) : null;
    return null;
  },

  async deleteSessionState(_sessionId: string): Promise<void> {
    // TODO: await redis.del(`terminal:state:${_sessionId}`);
  },

  async cacheOutput(_sessionId: string, _lines: string[]): Promise<void> {
    // TODO: await redis.rpush(`terminal:output:${_sessionId}`, ..._lines);
    // TODO: await redis.ltrim(`terminal:output:${_sessionId}`, -500, -1);
  },

  async getOutput(_sessionId: string, _limit = 100): Promise<string[]> {
    // TODO: return redis.lrange(`terminal:output:${_sessionId}`, -_limit, -1);
    return [];
  },
};
