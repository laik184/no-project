/**
 * server/repositories/console/session-repository.ts
 *
 * Thin facade over the shared session-state store.
 * In-memory — sessions are ephemeral by design.
 * Imports types from server/shared/console (not from console domain).
 */

import { sessionStateStore }        from '../../shared/console/session-state.ts';
import type { ConsoleSession }      from '../../shared/console/types.ts';

export interface ISessionRepository {
  create(projectId: number): ConsoleSession;
  find(sessionId: string): ConsoleSession | undefined;
  findByProject(projectId: number): ConsoleSession[];
  update(sessionId: string, patch: Partial<Pick<ConsoleSession, 'lastHeartbeat' | 'closed'>>): void;
  delete(sessionId: string): void;
  countOpen(projectId: number): number;
}

class SessionRepository implements ISessionRepository {
  create(projectId: number): ConsoleSession {
    return sessionStateStore.create(projectId);
  }

  find(sessionId: string): ConsoleSession | undefined {
    return sessionStateStore.find(sessionId);
  }

  findByProject(projectId: number): ConsoleSession[] {
    return sessionStateStore.findByProject(projectId);
  }

  update(
    sessionId: string,
    patch: Partial<Pick<ConsoleSession, 'lastHeartbeat' | 'closed'>>,
  ): void {
    sessionStateStore.update(sessionId, patch);
  }

  delete(sessionId: string): void {
    sessionStateStore.delete(sessionId);
  }

  countOpen(projectId: number): number {
    return sessionStateStore.countOpen(projectId);
  }
}

export const sessionRepository: ISessionRepository = new SessionRepository();
