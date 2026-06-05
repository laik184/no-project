/**
 * server/repositories/console/log-repository.ts
 *
 * Persists and retrieves console log lines.
 * Delegates to the persistence layer — never imports infrastructure directly.
 */

import { postgresLogStore } from '../../console/persistence/index.ts';
import type { LogLine }     from '../../shared/console/types.ts';

export interface ILogRepository {
  save(projectId: number, log: LogLine): Promise<void>;
  saveMany(projectId: number, logs: LogLine[]): Promise<void>;
  findByProject(projectId: number, limit?: number): Promise<LogLine[]>;
  findRecent(projectId: number, since: Date, limit?: number): Promise<LogLine[]>;
  deleteOld(projectId: number, before: Date): Promise<number>;
}

class LogRepository implements ILogRepository {
  save(projectId: number, log: LogLine): Promise<void> {
    return postgresLogStore.save(projectId, log);
  }

  saveMany(projectId: number, logs: LogLine[]): Promise<void> {
    return postgresLogStore.saveMany(projectId, logs);
  }

  findByProject(projectId: number, limit = 200): Promise<LogLine[]> {
    return postgresLogStore.findByProject(projectId, limit);
  }

  findRecent(projectId: number, since: Date, limit = 500): Promise<LogLine[]> {
    return postgresLogStore.findRecent(projectId, since, limit);
  }

  deleteOld(projectId: number, before: Date): Promise<number> {
    return postgresLogStore.deleteOld(projectId, before);
  }
}

export const logRepository: ILogRepository = new LogRepository();
