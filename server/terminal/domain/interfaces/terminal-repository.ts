/**
 * server/terminal/domain/interfaces/terminal-repository.ts
 *
 * Repository contract for terminal log persistence.
 */

import type { TerminalLog } from '../entities/terminal-log.ts';
import type { LogSource, LogLevel } from '../../contracts/terminal-state.ts';

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
