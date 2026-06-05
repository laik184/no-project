/**
 * server/console/persistence/postgres/postgres-log-store.ts
 *
 * PostgreSQL-backed log persistence.
 * Used exclusively by server/repositories/console/log-repository.ts.
 * Imports infrastructure only through the public index.
 */

import { desc, eq, sql } from 'drizzle-orm';
import { db }            from '../../../infrastructure/index.ts';
import { consoleLogs }   from '../../../../shared/schema.ts';
import type { LogLine }  from '../../../shared/console/types.ts';

function rowToLogLine(row: typeof consoleLogs.$inferSelect): LogLine {
  return {
    id:   String(row.id),
    kind: (row.stream ?? 'stdout') as LogLine['kind'],
    line: row.line ?? '',
    ts:   row.ts?.toISOString() ?? new Date().toISOString(),
  };
}

export const postgresLogStore = {
  async save(projectId: number, log: LogLine): Promise<void> {
    await db.insert(consoleLogs).values({
      projectId,
      stream: log.kind,
      line:   log.line,
      ts:     log.ts ? new Date(log.ts) : new Date(),
    });
  },

  async saveMany(projectId: number, logs: LogLine[]): Promise<void> {
    if (logs.length === 0) return;
    const rows = logs.map((log) => ({
      projectId,
      stream: log.kind,
      line:   log.line,
      ts:     log.ts ? new Date(log.ts) : new Date(),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(consoleLogs).values(rows.slice(i, i + 100));
    }
  },

  async findByProject(projectId: number, limit = 200): Promise<LogLine[]> {
    const rows = await db
      .select()
      .from(consoleLogs)
      .where(eq(consoleLogs.projectId, projectId))
      .orderBy(desc(consoleLogs.ts))
      .limit(limit);
    return rows.reverse().map(rowToLogLine);
  },

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
  },

  async deleteOld(projectId: number, before: Date): Promise<number> {
    const result = await db
      .delete(consoleLogs)
      .where(
        sql`${consoleLogs.projectId} = ${projectId} AND ${consoleLogs.ts} < ${before}`,
      );
    return (result as unknown as { rowCount: number }).rowCount ?? 0;
  },
};
