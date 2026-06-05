/**
 * server/repositories/terminal/command-repository.ts
 *
 * In-memory repository for TerminalCommand entities.
 * Also delegates command history (append/read) to the file-backed history store.
 */

import type { TerminalCommand } from '../../terminal/domain/entities/terminal-command.ts';
import { terminalHistoryStore } from '../../terminal/persistence/file/terminal-history-store.ts';
import type { HistoryRecord }   from '../../terminal/persistence/file/terminal-history-store.ts';

export type { HistoryRecord };

export interface ICommandRepository {
  save(command: TerminalCommand): void;
  findById(id: string): TerminalCommand | null;
  findBySession(sessionId: string): TerminalCommand[];
  findByProject(projectId: number): TerminalCommand[];
  update(command: TerminalCommand): void;
  delete(id: string): void;
  deleteBySession(sessionId: string): void;
  deleteByProject(projectId: number): void;
  countBySession(sessionId: string): number;
  appendHistory(sessionId: string, record: HistoryRecord): void;
  readHistory(sessionId: string, limit?: number): HistoryRecord[];
  searchHistory(sessionId: string, query: string): HistoryRecord[];
}

class CommandRepository implements ICommandRepository {
  private readonly _store = new Map<string, TerminalCommand>();

  save(command: TerminalCommand): void {
    this._store.set(command.id, { ...command });
  }

  findById(id: string): TerminalCommand | null {
    return this._store.get(id) ?? null;
  }

  findBySession(sessionId: string): TerminalCommand[] {
    return [...this._store.values()].filter(c => c.sessionId === sessionId);
  }

  findByProject(projectId: number): TerminalCommand[] {
    return [...this._store.values()].filter(c => c.projectId === projectId);
  }

  update(command: TerminalCommand): void {
    if (!this._store.has(command.id)) return;
    this._store.set(command.id, { ...command });
  }

  delete(id: string): void {
    this._store.delete(id);
  }

  deleteBySession(sessionId: string): void {
    for (const [id, c] of this._store) {
      if (c.sessionId === sessionId) this._store.delete(id);
    }
  }

  deleteByProject(projectId: number): void {
    for (const [id, c] of this._store) {
      if (c.projectId === projectId) this._store.delete(id);
    }
  }

  countBySession(sessionId: string): number {
    return this.findBySession(sessionId).length;
  }

  appendHistory(sessionId: string, record: HistoryRecord): void {
    terminalHistoryStore.append(sessionId, record);
  }

  readHistory(sessionId: string, limit = 100): HistoryRecord[] {
    return terminalHistoryStore.read(sessionId, limit);
  }

  searchHistory(sessionId: string, query: string): HistoryRecord[] {
    return terminalHistoryStore.search(sessionId, query);
  }
}

export const commandRepository: ICommandRepository = new CommandRepository();
