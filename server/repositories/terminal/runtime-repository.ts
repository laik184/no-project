/**
 * server/repositories/terminal/runtime-repository.ts
 *
 * Thin facade over the Redis-backed terminal cache store.
 * Tracks live runtime/session state (session ↔ TerminalState snapshots).
 */

import { terminalCacheStore }   from '../../terminal/persistence/redis/terminal-cache-store.ts';
import type { TerminalState }   from '../../terminal/contracts/terminal-state.ts';

export interface IRuntimeRepository {
  setState(sessionId: string, state: TerminalState): Promise<void>;
  getState(sessionId: string): Promise<TerminalState | null>;
  deleteState(sessionId: string): Promise<void>;
  cacheOutput(sessionId: string, lines: string[]): Promise<void>;
  getOutput(sessionId: string, limit?: number): Promise<string[]>;
}

class RuntimeRepository implements IRuntimeRepository {
  setState(sessionId: string, state: TerminalState): Promise<void> {
    return terminalCacheStore.setSessionState(sessionId, state);
  }

  getState(sessionId: string): Promise<TerminalState | null> {
    return terminalCacheStore.getSessionState(sessionId);
  }

  deleteState(sessionId: string): Promise<void> {
    return terminalCacheStore.deleteSessionState(sessionId);
  }

  cacheOutput(sessionId: string, lines: string[]): Promise<void> {
    return terminalCacheStore.cacheOutput(sessionId, lines);
  }

  getOutput(sessionId: string, limit = 100): Promise<string[]> {
    return terminalCacheStore.getOutput(sessionId, limit);
  }
}

export const runtimeRepository: IRuntimeRepository = new RuntimeRepository();
