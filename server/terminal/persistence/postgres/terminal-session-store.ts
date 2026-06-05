/**
 * server/terminal/persistence/postgres/terminal-session-store.ts
 *
 * In-memory backed session store with async interface for future DB migration.
 * The terminal module does not have a dedicated sessions table yet,
 * so session persistence is handled in-process (see terminal-session-manager).
 */

import type { TerminalSession }           from '../../domain/entities/terminal-session.ts';
import type { ITerminalSessionRepository } from '../../domain/interfaces/terminal-session-repository.ts';

const _store = new Map<string, TerminalSession>();

export const terminalSessionStore: ITerminalSessionRepository = {
  async save(session: TerminalSession): Promise<void> {
    _store.set(session.id, { ...session });
  },

  async findById(id: string): Promise<TerminalSession | null> {
    return _store.get(id) ?? null;
  },

  async findByProject(projectId: number): Promise<TerminalSession[]> {
    return [..._store.values()].filter(s => s.projectId === projectId);
  },

  async update(session: TerminalSession): Promise<void> {
    if (!_store.has(session.id)) return;
    _store.set(session.id, { ...session });
  },

  async delete(id: string): Promise<void> {
    _store.delete(id);
  },

  async deleteByProject(projectId: number): Promise<void> {
    for (const [id, s] of _store) {
      if (s.projectId === projectId) _store.delete(id);
    }
  },
};
