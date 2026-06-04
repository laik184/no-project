/**
 * server/services/chat/turn.service.ts
 *
 * Manages the lifecycle of a chat "turn" (user → agent cycle).
 * Tracks status and duration in-memory. Not persisted.
 *
 * Owns: start, complete, fail, cancel, duration tracking.
 */

import crypto from 'crypto';
import type { ChatTurn, TurnStatus } from '../../chat/types/chat.types.ts';

const _turns = new Map<string, ChatTurn>();

export class TurnError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TurnError';
  }
}

export const turnManager = {
  start(
    runId:          string,
    conversationId: string,
    projectId:      number,
    goal:           string,
  ): ChatTurn {
    const turn: ChatTurn = {
      turnId:         crypto.randomUUID(),
      runId,
      conversationId,
      projectId,
      goal,
      status:         'running',
      startedAt:      new Date(),
    };
    _turns.set(turn.turnId, turn);
    return turn;
  },

  complete(turnId: string): ChatTurn | null {
    const t = _turns.get(turnId);
    if (!t) return null;
    t.status      = 'completed';
    t.completedAt = new Date();
    t.durationMs  = t.completedAt.getTime() - t.startedAt.getTime();
    _turns.set(turnId, t);
    return t;
  },

  fail(turnId: string): ChatTurn | null {
    const t = _turns.get(turnId);
    if (!t) return null;
    t.status      = 'failed';
    t.completedAt = new Date();
    t.durationMs  = t.completedAt.getTime() - t.startedAt.getTime();
    _turns.set(turnId, t);
    return t;
  },

  cancel(turnId: string): ChatTurn | null {
    const t = _turns.get(turnId);
    if (!t) return null;
    t.status      = 'cancelled';
    t.completedAt = new Date();
    _turns.set(turnId, t);
    return t;
  },

  getByRun(runId: string): ChatTurn | null {
    for (const t of _turns.values()) {
      if (t.runId === runId && t.status === 'running') return t;
    }
    return null;
  },

  get(turnId: string): ChatTurn | null {
    return _turns.get(turnId) ?? null;
  },

  cancelByRun(runId: string): void {
    for (const t of _turns.values()) {
      if (t.runId === runId && t.status === 'running') {
        t.status      = 'cancelled';
        t.completedAt = new Date();
      }
    }
  },

  clearCompleted(): void {
    for (const [id, t] of _turns) {
      if (t.status !== 'running') _turns.delete(id);
    }
  },

  size(): number { return _turns.size; },
};

export const turnService = turnManager;
