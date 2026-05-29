/**
 * turn-manager.ts — Chat turn lifecycle only.
 * A turn = one user-message → agent-response cycle.
 */
import crypto from 'crypto';
import type { ChatTurn, TurnStatus } from '../types/chat.types.ts';

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

  get(turnId: string): ChatTurn | null {
    return _turns.get(turnId) ?? null;
  },

  getByRun(runId: string): ChatTurn | null {
    for (const t of _turns.values()) {
      if (t.runId === runId) return t;
    }
    return null;
  },

  complete(turnId: string): void {
    const turn = _turns.get(turnId);
    if (!turn) return;
    turn.status      = 'completed';
    turn.completedAt = new Date();
    turn.durationMs  = turn.completedAt.getTime() - turn.startedAt.getTime();
  },

  fail(turnId: string): void {
    const turn = _turns.get(turnId);
    if (!turn) return;
    turn.status      = 'failed';
    turn.completedAt = new Date();
    turn.durationMs  = turn.completedAt.getTime() - turn.startedAt.getTime();
  },

  cancel(turnId: string): void {
    const turn = _turns.get(turnId);
    if (!turn) return;
    turn.status      = 'cancelled';
    turn.completedAt = new Date();
    turn.durationMs  = turn.completedAt.getTime() - turn.startedAt.getTime();
    _turns.delete(turnId);
  },

  setStatus(turnId: string, status: TurnStatus): void {
    const turn = _turns.get(turnId);
    if (turn) turn.status = status;
  },

  clearCompleted(): number {
    let count = 0;
    for (const [id, t] of _turns) {
      if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
        _turns.delete(id);
        count++;
      }
    }
    return count;
  },

  size(): number {
    return _turns.size;
  },
};
