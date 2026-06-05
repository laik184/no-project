/**
 * server/shared/console/session-state.ts
 *
 * In-memory session state store shared between:
 *   - server/console/streaming/stream-broker.ts (manages connection lifecycle)
 *   - server/repositories/console/session-repository.ts (reads for service layer)
 *
 * Zero application imports — this is a pure data store.
 */

import { randomUUID } from 'crypto';
import type { ConsoleSession } from './types.ts';

const sessions = new Map<string, ConsoleSession>();

export const sessionStateStore = {
  create(projectId: number): ConsoleSession {
    const session: ConsoleSession = {
      sessionId:    randomUUID(),
      projectId,
      connectedAt:  Date.now(),
      lastHeartbeat: Date.now(),
      closed:       false,
    };
    sessions.set(session.sessionId, session);
    return session;
  },

  find(sessionId: string): ConsoleSession | undefined {
    return sessions.get(sessionId);
  },

  findByProject(projectId: number): ConsoleSession[] {
    return [...sessions.values()].filter(
      (s) => s.projectId === projectId && !s.closed,
    );
  },

  update(
    sessionId: string,
    patch: Partial<Pick<ConsoleSession, 'lastHeartbeat' | 'closed'>>,
  ): void {
    const session = sessions.get(sessionId);
    if (!session) return;
    Object.assign(session, patch);
  },

  delete(sessionId: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      session.closed = true;
      sessions.delete(sessionId);
    }
  },

  countOpen(projectId: number): number {
    return sessionStateStore.findByProject(projectId).length;
  },
};
