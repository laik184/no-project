/**
 * server/repositories/chat/run.repository.ts
 *
 * Repository pattern over agent_runs table (read + write).
 */
import { eq, and, desc } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../../infrastructure/index.ts';
import { agentRuns } from '../../../shared/schema.ts';
import type { ChatRun, RunStatus } from '../../shared/types/chat.types.ts';

const inMemoryRuns = new Map<string, ChatRun>();

function cloneRun(run: ChatRun): ChatRun {
  return { ...run, startedAt: new Date(run.startedAt), ...(run.completedAt ? { completedAt: new Date(run.completedAt) } : {}) };
}

function rowToRun(row: typeof agentRuns.$inferSelect): ChatRun {
  const startedAt   = row.startedAt ?? new Date();
  const completedAt = row.endedAt ?? undefined;
  return {
    runId:       row.id,
    projectId:   row.projectId!,
    goal:        row.goal,
    mode:        'planned',
    status:      (row.status ?? 'running') as RunStatus,
    startedAt,
    completedAt,
    durationMs:  completedAt ? completedAt.getTime() - startedAt.getTime() : undefined,
    result:      row.result,
  };
}

export const runRepository = {
  async create(runId: string, projectId: number, goal: string): Promise<void> {
    if (!isDatabaseConfigured()) {
      inMemoryRuns.set(runId, {
        runId,
        projectId,
        goal,
        mode: 'auto',
        status: 'running',
        startedAt: new Date(),
      });
      return;
    }
    await db.insert(agentRuns).values({ id: runId, projectId, goal, status: 'running' });
  },

  async setStatus(
    runId:   string,
    status:  'running' | 'completed' | 'failed' | 'cancelled',
    result?: unknown,
  ): Promise<void> {
    if (!isDatabaseConfigured()) {
      const current = inMemoryRuns.get(runId);
      if (!current) return;
      const completedAt = ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined;
      inMemoryRuns.set(runId, {
        ...current,
        status,
        ...(completedAt ? { completedAt, durationMs: completedAt.getTime() - current.startedAt.getTime() } : {}),
        ...(result !== undefined ? { result } : {}),
      });
      return;
    }
    await db.update(agentRuns).set({
      status,
      endedAt: ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined,
      ...(result !== undefined ? { result: result as object } : {}),
    }).where(eq(agentRuns.id, runId));
  },

  async findById(runId: string): Promise<ChatRun | null> {
    if (!isDatabaseConfigured()) {
      const run = inMemoryRuns.get(runId);
      return run ? cloneRun(run) : null;
    }
    const rows = await db.select().from(agentRuns).where(eq(agentRuns.id, runId)).limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  },

  async findActiveByProject(projectId: number): Promise<ChatRun | null> {
    if (!isDatabaseConfigured()) {
      const active = [...inMemoryRuns.values()]
        .filter((run) => run.projectId === projectId && run.status === 'running')
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
      return active ? cloneRun(active) : null;
    }
    const rows = await db.select().from(agentRuns)
      .where(and(eq(agentRuns.projectId, projectId), eq(agentRuns.status, 'running')))
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatRun[]> {
    if (!isDatabaseConfigured()) {
      return [...inMemoryRuns.values()]
        .filter((run) => run.projectId === projectId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, limit)
        .map(cloneRun);
    }
    const rows = await db.select().from(agentRuns)
      .where(eq(agentRuns.projectId, projectId))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
    return rows.map(rowToRun);
  },

  async isActive(runId: string): Promise<boolean> {
    if (!isDatabaseConfigured()) return inMemoryRuns.get(runId)?.status === 'running';
    const rows = await db.select({ status: agentRuns.status }).from(agentRuns)
      .where(eq(agentRuns.id, runId)).limit(1);
    return rows[0]?.status === 'running';
  },
};
