/**
 * server/repositories/terminal/command-repository.ts
 *
 * In-memory repository for TerminalCommand entities.
 * Commands are ephemeral — no DB persistence required.
 */

import type { TerminalCommand } from '../../terminal/domain/entities/terminal-command.ts';

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
}

export const commandRepository: ICommandRepository = new CommandRepository();
