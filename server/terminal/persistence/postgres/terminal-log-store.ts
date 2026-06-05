/**
 * server/terminal/persistence/postgres/terminal-log-store.ts
 *
 * PostgreSQL-backed terminal log persistence using the consoleLogs table.
 */

import { eq, desc } from 'drizzle-orm';
import { db }       from '../../../infrastructure/index.ts';
import { consoleLogs } from '../../../../shared/schema.ts';
import type { TerminalLog } from '../../domain/entities/terminal-log.ts';

function rowToLog(row: typeof consoleLogs.$inferSelect, sessionId: string): TerminalLog {
  return {
    id:        String(row.id),
    sessionId,
    projectId: row.projectId ?? 0,
    line:      row.line ?? '',
    source:    (row.stream ?? 'stdout') as TerminalLog['source'],
    level:     'unknown',
    timestamp: row.ts ? row.ts.getTime() : Date.now(),
  };
}

export const terminalLogStore = {
  async save(log: TerminalLog): Promise<void> {
    await db.insert(consoleLogs).values({
      projectId: log.projectId,
      stream:    log.source,
      line:      log.line,
      ts:        new Date(log.timestamp),
    });
  },

  async saveMany(logs: TerminalLog[]): Promise<void> {
    if (!logs.length) return;
    const rows = logs.map(l => ({
      projectId: l.projectId,
      stream:    l.source,
      line:      l.line,
      ts:        new Date(l.timestamp),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(consoleLogs).values(rows.slice(i, i + 100));
    }
  },

  async findByProject(projectId: number, limit = 200, sessionId = ''): Promise<TerminalLog[]> {
    const rows = await db
      .select()
      .from(consoleLogs)
      .where(eq(consoleLogs.projectId, projectId))
      .orderBy(desc(consoleLogs.ts))
      .limit(limit);
    return rows.map(r => rowToLog(r, sessionId)).reverse();
  },

  async deleteByProject(projectId: number): Promise<void> {
    await db.delete(consoleLogs).where(eq(consoleLogs.projectId, projectId));
  },
};
