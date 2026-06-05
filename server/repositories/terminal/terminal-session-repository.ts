/**
 * server/repositories/terminal/terminal-session-repository.ts
 *
 * Thin facade over the terminal session persistence store.
 * Delegates to the in-memory postgres-interface store in the terminal domain.
 * Emits lifecycle events on the EventBus for observability.
 */

import { terminalSessionStore } from '../../terminal/persistence/postgres/terminal-session-store.ts';
import type { TerminalSession }  from '../../terminal/domain/entities/terminal-session.ts';
import { bus }                   from '../../infrastructure/index.ts';

export interface ITerminalSessionRepository {
  save(session: TerminalSession): Promise<void>;
  findById(id: string): Promise<TerminalSession | null>;
  findByProject(projectId: number): Promise<TerminalSession[]>;
  update(session: TerminalSession): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: number): Promise<void>;
}

class TerminalSessionRepository implements ITerminalSessionRepository {
  async save(session: TerminalSession): Promise<void> {
    await terminalSessionStore.save(session);
    bus.emit('console.session_open', { sessionId: session.id, projectId: session.projectId });
  }

  findById(id: string): Promise<TerminalSession | null> {
    return terminalSessionStore.findById(id);
  }

  findByProject(projectId: number): Promise<TerminalSession[]> {
    return terminalSessionStore.findByProject(projectId);
  }

  update(session: TerminalSession): Promise<void> {
    return terminalSessionStore.update(session);
  }

  async delete(id: string): Promise<void> {
    await terminalSessionStore.delete(id);
    bus.emit('console.session_close', { sessionId: id });
  }

  async deleteByProject(projectId: number): Promise<void> {
    const sessions = await terminalSessionStore.findByProject(projectId);
    await terminalSessionStore.deleteByProject(projectId);
    for (const s of sessions) {
      bus.emit('console.session_close', { sessionId: s.id });
    }
  }
}

export const terminalSessionRepository: ITerminalSessionRepository = new TerminalSessionRepository();
