/**
 * server/repositories/console/log-repository.ts
 *
 * Persists and retrieves console log lines.
 * Backed by the consoleLogs table in PostgreSQL.
 */

import { desc, eq, lt, sql } from 'drizzle-orm';
import { db }          from '../../infrastructure/db/index.ts';
import { consoleLogs } from '../../../shared/schema.ts';
import type { LogLine } from '../../console/types/index.ts';

export interface ILogRepository {
  save(projectId: number, log: LogLine): Promise<void>;
  saveMany(projectId: number, logs: LogLine[]): Promise<void>;
  findByProject(projectId: number, limit?: number): Promise<LogLine[]>;
  findRecent(projectId: number, since: Date, limit?: number): Promise<LogLine[]>;
  deleteOld(projectId: number, before: Date): Promise<number>;
}

function rowToLogLine(row: typeof consoleLogs.$inferSelect): LogLine {
  return {
    id:   String(row.id),
    kind: (row.stream ?? 'stdout') as LogLine['kind'],
    line: row.line ?? '',
    ts:   row.ts?.toISOString() ?? new Date().toISOString(),
  };
}

class LogRepository implements ILogRepository {
  async save(projectId: number, log: LogLine): Promise<void> {
    await db.insert(consoleLogs).values({
      projectId,
      stream: log.kind,
      line:   log.line,
      ts:     log.ts ? new Date(log.ts) : new Date(),
    });
  }

  async saveMany(projectId: number, logs: LogLine[]): Promise<void> {
    if (logs.length === 0) return;

    const rows = logs.map((log) => ({
      projectId,
      stream: log.kind,
      line:   log.line,
      ts:     log.ts ? new Date(log.ts) : new Date(),
    }));

    // Chunk into 100-row inserts to stay within pg parameter limits
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(consoleLogs).values(rows.slice(i, i + 100));
    }
  }

  async findByProject(projectId: number, limit = 200): Promise<LogLine[]> {
    const rows = await db
      .select()
      .from(consoleLogs)
      .where(eq(consoleLogs.projectId, projectId))
      .orderBy(desc(consoleLogs.ts))
      .limit(limit);

    return rows.reverse().map(rowToLogLine);
  }

  async findRecent(projectId: number, since: Date, limit = 500): Promise<LogLine[]> {
    const rows = await db
      .select()
      .from(consoleLogs)
      .where(
        sql`${consoleLogs.projectId} = ${projectId} AND ${consoleLogs.ts} > ${since}`,
      )
      .orderBy(consoleLogs.ts)
      .limit(limit);

    return rows.map(rowToLogLine);
  }

  async deleteOld(projectId: number, before: Date): Promise<number> {
    const result = await db
      .delete(consoleLogs)
      .where(
        sql`${consoleLogs.projectId} = ${projectId} AND ${consoleLogs.ts} < ${before}`,
      );

    return (result as unknown as { rowCount: number }).rowCount ?? 0;
  }
}

export const logRepository: ILogRepository = new LogRepository();
