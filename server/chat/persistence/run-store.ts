/**
 * run-store.ts — Read access to agent_runs for the chat module.
 * Data access only — no business logic, no event emission.
 * Chat DOES NOT write runs — that belongs to orchestration.
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../infrastructure';
import { agentRuns } from '../../../shared/schema.ts';
import type { ChatRun, RunStatus } from '../types/run.types.ts';

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

export const runStore = {
  async findById(runId: string): Promise<ChatRun | null> {
    const rows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  },

  async findActiveByProject(projectId: number): Promise<ChatRun | null> {
    const rows = await db
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.projectId, projectId),
          eq(agentRuns.status, 'running'),
        ),
      )
      .orderBy(desc(agentRuns.startedAt))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatRun[]> {
    const rows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.projectId, projectId))
      .orderBy(desc(agentRuns.startedAt))
      .limit(limit);
    return rows.map(rowToRun);
  },

  async isActive(runId: string): Promise<boolean> {
    const rows = await db
      .select({ status: agentRuns.status })
      .from(agentRuns)
      .where(eq(agentRuns.id, runId))
      .limit(1);
    return rows[0]?.status === 'running';
  },
};
