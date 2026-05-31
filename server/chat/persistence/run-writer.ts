/**
 * run-writer.ts — Write access to agent_runs for the chat module.
 * Data access only: inserts and updates run rows so FK constraints on
 * chat_messages.run_id are satisfied.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../infrastructure';
import { agentRuns } from '../../../shared/schema.ts';

export const runWriter = {
  /**
   * Insert a new agent_runs row.
   * Must be called BEFORE any chat_messages inserts that reference this runId.
   */
  async create(runId: string, projectId: number, goal: string): Promise<void> {
    await db.insert(agentRuns).values({
      id:        runId,
      projectId,
      goal,
      status:    'running',
    });
  },

  /**
   * Update the run's status and optional result.
   */
  async setStatus(
    runId:   string,
    status:  'running' | 'completed' | 'failed' | 'cancelled',
    result?: unknown,
  ): Promise<void> {
    await db
      .update(agentRuns)
      .set({
        status,
        endedAt: ['completed', 'failed', 'cancelled'].includes(status) ? new Date() : undefined,
        ...(result !== undefined ? { result: result as object } : {}),
      })
      .where(eq(agentRuns.id, runId));
  },
};
