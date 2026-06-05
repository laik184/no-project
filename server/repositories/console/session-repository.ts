/**
 * server/repositories/console/session-repository.ts
 *
 * In-memory session store for active console SSE connections.
 * Sessions are ephemeral — they live only while the connection is open.
 */

import { randomUUID } from 'crypto';
import type { ConsoleSession } from '../../console/types/index.ts';

export interface ISessionRepository {
  create(projectId: number): ConsoleSession;
  find(sessionId: string): ConsoleSession | undefined;
  findByProject(projectId: number): ConsoleSession[];
  update(sessionId: string, patch: Partial<Pick<ConsoleSession, 'lastHeartbeat' | 'closed'>>): void;
  delete(sessionId: string): void;
  countOpen(projectId: number): number;
}

class SessionRepository implements ISessionRepository {
  private readonly sessions = new Map<string, ConsoleSession>();

  create(projectId: number): ConsoleSession {
    const session: ConsoleSession = {
      sessionId:     randomUUID(),
      projectId,
      connectedAt:   Date.now(),
      lastHeartbeat: Date.now(),
      closed:        false,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  find(sessionId: string): ConsoleSession | undefined {
    return this.sessions.get(sessionId);
  }

  findByProject(projectId: number): ConsoleSession[] {
    return [...this.sessions.values()].filter(
      (s) => s.projectId === projectId && !s.closed,
    );
  }

  update(
    sessionId: string,
    patch: Partial<Pick<ConsoleSession, 'lastHeartbeat' | 'closed'>>,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    Object.assign(session, patch);
  }

  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.closed = true;
      this.sessions.delete(sessionId);
    }
  }

  countOpen(projectId: number): number {
    return this.findByProject(projectId).length;
  }
}

export const sessionRepository: ISessionRepository = new SessionRepository();
