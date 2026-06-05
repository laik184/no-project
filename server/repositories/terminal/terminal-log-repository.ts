/**
 * server/repositories/terminal/terminal-log-repository.ts
 *
 * Thin facade over the PostgreSQL-backed terminal log store.
 * Delegates to the persistence layer — never imports infrastructure directly.
 */

import { terminalLogStore }    from '../../terminal/persistence/postgres/terminal-log-store.ts';
import type { TerminalLog }    from '../../terminal/domain/entities/terminal-log.ts';
import type { LogSource, LogLevel } from '../../terminal/contracts/terminal-state.ts';

export interface ITerminalLogRepository {
  save(log: TerminalLog): Promise<void>;
  saveMany(logs: TerminalLog[]): Promise<void>;
  findBySession(sessionId: string, limit?: number): Promise<TerminalLog[]>;
  findByProject(projectId: number, limit?: number): Promise<TerminalLog[]>;
  findByLevel(sessionId: string, level: LogLevel): Promise<TerminalLog[]>;
  findBySource(sessionId: string, source: LogSource): Promise<TerminalLog[]>;
  deleteBySession(sessionId: string): Promise<void>;
  deleteByProject(projectId: number): Promise<void>;
}

class TerminalLogRepository implements ITerminalLogRepository {
  save(log: TerminalLog): Promise<void> {
    return terminalLogStore.save(log);
  }

  saveMany(logs: TerminalLog[]): Promise<void> {
    return terminalLogStore.saveMany(logs);
  }

  async findBySession(sessionId: string, limit = 200): Promise<TerminalLog[]> {
    const rows = await terminalLogStore.findByProject(0, limit, sessionId);
    return rows.filter(l => l.sessionId === sessionId);
  }

  findByProject(projectId: number, limit = 200): Promise<TerminalLog[]> {
    return terminalLogStore.findByProject(projectId, limit);
  }

  async findByLevel(sessionId: string, level: LogLevel): Promise<TerminalLog[]> {
    const rows = await this.findBySession(sessionId, 1000);
    return rows.filter(l => l.level === level);
  }

  async findBySource(sessionId: string, source: LogSource): Promise<TerminalLog[]> {
    const rows = await this.findBySession(sessionId, 1000);
    return rows.filter(l => l.source === source);
  }

  async deleteBySession(_sessionId: string): Promise<void> {
    // Session-level deletes not yet supported by the log store.
    // Implement when a sessions table is added.
  }

  deleteByProject(projectId: number): Promise<void> {
    return terminalLogStore.deleteByProject(projectId);
  }
}

export const terminalLogRepository: ITerminalLogRepository = new TerminalLogRepository();
