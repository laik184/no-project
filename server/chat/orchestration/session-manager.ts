/**
 * session-manager.ts — Chat session lifecycle only.
 * A session is a single browser tab / client connection window.
 * Sessions are ephemeral — not persisted to DB.
 */
import crypto from 'crypto';
import type { ChatSession, SessionStatus } from '../types/chat.types.ts';

const _sessions = new Map<string, ChatSession>();

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

  get(sessionId: string): ChatSession | null {
    return _sessions.get(sessionId) ?? null;
  },

  setStatus(sessionId: string, status: SessionStatus): void {
    const s = _sessions.get(sessionId);
    if (!s) return;
    s.status = status;
    if (status === 'closed') s.closedAt = new Date();
  },

  close(sessionId: string): void {
    const s = _sessions.get(sessionId);
    if (!s) return;
    s.status   = 'closed';
    s.closedAt = new Date();
    _sessions.delete(sessionId);
  },

  listByProject(projectId: number): ChatSession[] {
    return Array.from(_sessions.values()).filter(
      (s) => s.projectId === projectId,
    );
  },

  closeAllByProject(projectId: number): number {
    let count = 0;
    for (const [id, s] of _sessions) {
      if (s.projectId === projectId) {
        s.status   = 'closed';
        s.closedAt = new Date();
        _sessions.delete(id);
        count++;
      }
    }
    return count;
  },

  size(): number {
    return _sessions.size;
  },
};
