/**
 * server/repositories/terminal/terminal-session-repository.ts
 *
 * Thin facade over the terminal session persistence store.
 * Delegates to the in-memory postgres-interface store in the terminal domain.
 */

import { terminalSessionStore } from '../../terminal/persistence/postgres/terminal-session-store.ts';
import type { TerminalSession }  from '../../terminal/domain/entities/terminal-session.ts';

export interface ITerminalSessionRepository {
  save(session: TerminalSession): Promise<void>;
  findById(id: string): Promise<TerminalSession | null>;
  findByProject(projectId: number): Promise<TerminalSession[]>;
  update(session: TerminalSession): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: number): Promise<void>;
}

class TerminalSessionRepository implements ITerminalSessionRepository {
  save(session: TerminalSession): Promise<void> {
    return terminalSessionStore.save(session);
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

  delete(id: string): Promise<void> {
    return terminalSessionStore.delete(id);
  }

  deleteByProject(projectId: number): Promise<void> {
    return terminalSessionStore.deleteByProject(projectId);
  }
}

export const terminalSessionRepository: ITerminalSessionRepository = new TerminalSessionRepository();
