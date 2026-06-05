/**
 * server/repositories/terminal/runtime-repository.ts
 *
 * Redis-backed store for live terminal runtime state and output cache.
 * Uses the redis client from infrastructure directly — the persistence-layer
 * stub (terminal-cache-store.ts) is all TODO stubs and bypassed here.
 *
 * Gracefully no-ops when redis is not connected (NullRedisClient).
 */

import { redis }                from '../../infrastructure/index.ts';
import type { TerminalState }   from '../../terminal/contracts/terminal-state.ts';

const STATE_TTL_SECONDS = 3600;

function stateKey(sessionId: string): string {
  return `terminal:state:${sessionId}`;
}

function outputKey(sessionId: string): string {
  return `terminal:output:${sessionId}`;
}

export interface IRuntimeRepository {
  setState(sessionId: string, state: TerminalState): Promise<void>;
  getState(sessionId: string): Promise<TerminalState | null>;
  deleteState(sessionId: string): Promise<void>;
  cacheOutput(sessionId: string, lines: string[]): Promise<void>;
  getOutput(sessionId: string, limit?: number): Promise<string[]>;
}

class RuntimeRepository implements IRuntimeRepository {
  async setState(sessionId: string, state: TerminalState): Promise<void> {
    await redis.set(stateKey(sessionId), JSON.stringify(state), { EX: STATE_TTL_SECONDS });
  }

  async getState(sessionId: string): Promise<TerminalState | null> {
    const raw = await redis.get(stateKey(sessionId));
    return raw ? (JSON.parse(raw) as TerminalState) : null;
  }

  async deleteState(sessionId: string): Promise<void> {
    await redis.del(stateKey(sessionId));
  }

  async cacheOutput(sessionId: string, lines: string[]): Promise<void> {
    for (const line of lines) {
      await redis.lPush(outputKey(sessionId), line);
    }
  }

  async getOutput(sessionId: string, limit = 100): Promise<string[]> {
    const items = await redis.lRange(outputKey(sessionId), 0, limit - 1);
    return items.reverse();  // lPush stores newest-first; reverse for chronological order
  }
}

export const runtimeRepository: IRuntimeRepository = new RuntimeRepository();
