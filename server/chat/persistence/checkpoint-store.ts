/**
 * server/chat/persistence/checkpoint-store.ts
 *
 * DB persistence for chat-module checkpoints.
 * Reads changed files from diffQueue (by project + time window) and
 * toolExecutions (by runId) to build real file snapshots for rollback.
 */
import crypto   from 'crypto';
import fs       from 'fs/promises';
import path     from 'path';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { db }   from '../../infrastructure/index.ts';
import { safeWriteFile, safeDeleteFile } from '../../infrastructure/index.ts';
import { checkpoints, diffQueue, toolExecutions, agentRuns } from '../../../shared/schema.ts';
import type { ChatCheckpoint, CheckpointTrigger, RollbackResult } from '../types/checkpoint.types.ts';

const SANDBOX = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

// ── helpers ───────────────────────────────────────────────────────────────────

function rowToCheckpoint(row: typeof checkpoints.$inferSelect): ChatCheckpoint {
  return {
    id:            row.checkpointId,
    runId:         row.runId ?? '',
    projectId:     row.projectId,
    title:         row.label ?? 'Checkpoint',
    description:   row.description ?? '',
    trigger:       (row.trigger as CheckpointTrigger) ?? 'run_complete',
    filesChanged:  row.fileCount,
    createdFiles:  (row.createdFiles as string[]) ?? [],
    modifiedFiles: (row.modifiedFiles as string[]) ?? [],
    deletedFiles:  (row.deletedFiles as string[]) ?? [],
    createdAt:     row.createdAt,
  };
}

/** Read a sandbox file's content; returns null if it doesn't exist. */
async function readSandboxFile(filePath: string): Promise<string | null> {
  try {
    const full = path.resolve(SANDBOX, filePath.replace(/^\//, ''));
    return await fs.readFile(full, 'utf8');
  } catch { return null; }
}

// ── store ─────────────────────────────────────────────────────────────────────

export const chatCheckpointStore = {

  async createForRun(
    runId:     string,
    projectId: number,
    goal:      string,
    trigger:   CheckpointTrigger = 'run_complete',
  ): Promise<ChatCheckpoint> {

    // Get run start time to scope diffQueue query
    const runRows = await db.select({ startedAt: agentRuns.startedAt })
      .from(agentRuns).where(eq(agentRuns.id, runId)).limit(1);
    const runStart = runRows[0]?.startedAt ?? new Date(Date.now() - 60_000);

    // Query diffQueue for files changed in this project during the run window
    const diffs = await db.select()
      .from(diffQueue)
      .where(and(eq(diffQueue.projectId, projectId), gte(diffQueue.createdAt, runStart)));

    // Categorize files: null oldContent = created, else modified
    const createdFiles:  string[] = [];
    const modifiedFiles: string[] = [];
    const snapshots:     Record<string, string | null> = {};

    for (const d of diffs) {
      if (!d.filePath) continue;
      if (d.oldContent === null || d.oldContent === '') {
        createdFiles.push(d.filePath);
        snapshots[d.filePath] = null; // rollback = delete
      } else {
        modifiedFiles.push(d.filePath);
        snapshots[d.filePath] = d.oldContent; // rollback = restore
      }
    }

    // Also pick up created files from toolExecutions (write_file calls)
    const toolRows = await db.select({ argsJson: toolExecutions.argsJson, toolName: toolExecutions.toolName })
      .from(toolExecutions)
      .where(and(eq(toolExecutions.runId, runId)));

    for (const t of toolRows) {
      const args = t.argsJson as Record<string, unknown> | null;
      if (!args?.path || typeof args.path !== 'string') continue;
      const p = args.path as string;
      if (!createdFiles.includes(p) && !modifiedFiles.includes(p)) {
        // Read current file content as snapshot (post-run state)
        const content = await readSandboxFile(p);
        if (content !== null) {
          modifiedFiles.push(p);
          snapshots[p] = content;
        }
      }
    }

    const checkpointId  = crypto.randomUUID();
    const totalFiles    = createdFiles.length + modifiedFiles.length;
    const shortGoal     = goal.length > 72 ? goal.slice(0, 72) + '…' : goal;
    const description   = `Saved progress at end of loop`;

    await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId,
      trigger,
      status:        'stable',
      fileCount:     totalFiles,
      label:         shortGoal,
      description,
      createdFiles:  createdFiles  as any,
      modifiedFiles: modifiedFiles as any,
      deletedFiles:  []            as any,
      fileSnapshots: snapshots     as any,
    });

    return {
      id:            checkpointId,
      runId,
      projectId,
      title:         shortGoal,
      description,
      trigger,
      filesChanged:  totalFiles,
      createdFiles,
      modifiedFiles,
      deletedFiles:  [],
      createdAt:     new Date(),
    };
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatCheckpoint[]> {
    const rows = await db.select()
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId))
      .orderBy(checkpoints.createdAt)
      .limit(limit);
    return rows.map(rowToCheckpoint);
  },

  async findById(checkpointId: string): Promise<ChatCheckpoint | null> {
    const rows = await db.select()
      .from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId))
      .limit(1);
    return rows[0] ? rowToCheckpoint(rows[0]) : null;
  },

  async rollback(checkpointId: string): Promise<RollbackResult> {
    const rows = await db.select()
      .from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId))
      .limit(1);

    const row = rows[0];
    if (!row) return { ok: false, checkpointId, filesRestored: 0, error: 'Checkpoint not found' };

    const snapshots = (row.fileSnapshots ?? {}) as Record<string, string | null>;
    const created   = (row.createdFiles  ?? []) as string[];
    let filesRestored = 0;

    for (const [filePath, oldContent] of Object.entries(snapshots)) {
      const abs = path.resolve(SANDBOX, filePath.replace(/^\//, ''));
      if (oldContent === null) {
        // File was created in this run — delete it on rollback
        await safeDeleteFile(abs);
      } else {
        const result = await safeWriteFile(abs, oldContent);
        if (result.ok) filesRestored++;
      }
    }

    // Delete any files that were created but not in snapshots dict
    for (const f of created) {
      if (!(f in snapshots)) {
        const abs = path.resolve(SANDBOX, f.replace(/^\//, ''));
        await safeDeleteFile(abs);
      }
    }

    await db.update(checkpoints)
      .set({ status: 'rolled_back' })
      .where(eq(checkpoints.checkpointId, checkpointId));

    return { ok: true, checkpointId, filesRestored };
  },
};
