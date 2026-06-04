/**
 * server/services/chat/session.service.ts
 *
 * Ephemeral browser-session lifecycle.
 * In-memory only — not persisted.
 *
 * Owns: open, close, status lookup, eviction.
 */

import crypto from 'crypto';
import type { ChatSession, SessionStatus } from '../../chat/types/chat.types.ts';

const _sessions = new Map<string, ChatSession>();

export class SessionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'SessionError';
  }
}

export const sessionManager = {
  open(conversationId: string, projectId: number): ChatSession {
    const session: ChatSession = {
      sessionId:      crypto.randomUUID(),
      conversationId,
      projectId,
      status:         'open',
      openedAt:       new Date(),
    };
    _sessions.set(session.sessionId, session);
    return session;
  },

  close(sessionId: string): boolean {
    const s = _sessions.get(sessionId);
    if (!s) return false;
    s.status   = 'closed';
    s.closedAt = new Date();
    _sessions.set(sessionId, s);
    return true;
  },

  get(sessionId: string): ChatSession | null {
    return _sessions.get(sessionId) ?? null;
  },

  getByConversation(conversationId: string): ChatSession | null {
    for (const s of _sessions.values()) {
      if (s.conversationId === conversationId && s.status === 'open') return s;
    }
    return null;
  },

  status(sessionId: string): SessionStatus | null {
    return _sessions.get(sessionId)?.status ?? null;
  },

  evictClosed(): void {
    for (const [id, s] of _sessions) {
      if (s.status === 'closed') _sessions.delete(id);
    }
  },

  size(): number { return _sessions.size; },
};

export const sessionService = sessionManager;
