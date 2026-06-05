/**
 * server/terminal/domain/interfaces/terminal-session-repository.ts
 *
 * Repository contract for terminal session persistence.
 */

import type { TerminalSession } from '../entities/terminal-session.ts';

export interface ITerminalSessionRepository {
  save(session: TerminalSession): Promise<void>;
  findById(id: string): Promise<TerminalSession | null>;
  findByProject(projectId: number): Promise<TerminalSession[]>;
  update(session: TerminalSession): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByProject(projectId: number): Promise<void>;
}
