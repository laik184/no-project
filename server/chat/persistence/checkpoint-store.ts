/**
 * server/chat/persistence/checkpoint-store.ts
 *
 * DB persistence for chat-module checkpoints.
 *
 * Reads changed files from diffQueue (by project + time window) and
 * toolExecutions (by runId) to build real file snapshots for rollback.
 *
 * Manual checkpoints capture a full workspace snapshot via workspace-scanner.
 */
import crypto             from 'crypto';
import fs                 from 'fs/promises';
import path               from 'path';
import { execFile }       from 'child_process';
import { promisify }      from 'util';
import { eq, and, gte }   from 'drizzle-orm';
import { db }             from '../../infrastructure/index.ts';
import { safeWriteFile, safeDeleteFile } from '../../infrastructure/index.ts';
import {
  checkpoints, diffQueue, toolExecutions, agentRuns, rollbackHistory,
} from '../../../shared/schema.ts';
import type {
  ChatCheckpoint, CheckpointTrigger, RollbackResult,
} from '../types/checkpoint.types.ts';
import { captureWorkspaceSnapshot } from './workspace-scanner.ts';
import { getProjectDir } from '../../infrastructure/index.ts';

const SANDBOX      = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';
const execFileAsync = promisify(execFile);

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
    gitCommitSha:  row.gitCommitSha ?? undefined,
  };
}

/** Read a sandbox file's content; returns null if it doesn't exist. */
async function readSandboxFile(filePath: string): Promise<string | null> {
  try {
    const full = path.resolve(SANDBOX, filePath.replace(/^\//, ''));
    return await fs.readFile(full, 'utf8');
  } catch { return null; }
}

/**
 * Attempt to capture the current git commit SHA in a directory.
 * Returns null if git is unavailable or not a git repo.
 */
async function captureGitSha(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      timeout: 3000,
    });
    const sha = stdout.trim();
    return sha.length >= 7 ? sha.slice(0, 64) : null;
  } catch {
    return null;
  }
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
    const toolRows = await db.select({
      argsJson: toolExecutions.argsJson,
      toolName: toolExecutions.toolName,
    }).from(toolExecutions).where(eq(toolExecutions.runId, runId));

    for (const t of toolRows) {
      const args = t.argsJson as Record<string, unknown> | null;
      if (!args?.path || typeof args.path !== 'string') continue;
      const p = args.path as string;
      if (!createdFiles.includes(p) && !modifiedFiles.includes(p)) {
        const content = await readSandboxFile(p);
        if (content !== null) {
          modifiedFiles.push(p);
          snapshots[p] = content;
        }
      }
    }

    const checkpointId = crypto.randomUUID();
    const totalFiles   = createdFiles.length + modifiedFiles.length;
    const shortGoal    = goal.length > 72 ? goal.slice(0, 72) + '…' : goal;
    const description  = `Saved progress at end of loop`;

    // Capture git SHA from sandbox root (best-effort)
    const gitCommitSha = await captureGitSha(SANDBOX);

    await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId,
      trigger,
      status:        'stable',
      gitCommitSha,
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
      gitCommitSha:  gitCommitSha ?? undefined,
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

  /**
   * Create a manual checkpoint — captures a FULL workspace snapshot so that
   * rollback can restore the complete project state at this moment.
   * Used by the "Save" button in CheckpointPanel.
   */
  async createManual(projectId: number, label: string): Promise<ChatCheckpoint> {
    const checkpointId = crypto.randomUUID();
    const shortLabel   = label.length > 72 ? label.slice(0, 72) + '…' : label;
    const description  = 'Manual checkpoint saved by user';

    // Capture full workspace state for reliable rollback (Task 1 + Task 7 fix)
    const projectDir = getProjectDir(projectId);
    const { snapshots, filePaths } = await captureWorkspaceSnapshot(projectDir);

    // All currently-existing files are treated as "modified" — rollback restores them
    const modifiedFiles = filePaths;

    // Capture git SHA
    const gitCommitSha = await captureGitSha(projectDir);

    await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId:         null,
      trigger:       'manual',
      status:        'stable',
      gitCommitSha,
      fileCount:     modifiedFiles.length,
      label:         shortLabel,
      description,
      createdFiles:  [] as unknown as string[],
      modifiedFiles: modifiedFiles as unknown as string[],
      deletedFiles:  [] as unknown as string[],
      fileSnapshots: snapshots as unknown as Record<string, string>,
    });

    return {
      id:            checkpointId,
      runId:         '',
      projectId,
      title:         shortLabel,
      description,
      trigger:       'manual',
      filesChanged:  modifiedFiles.length,
      createdFiles:  [],
      modifiedFiles,
      deletedFiles:  [],
      createdAt:     new Date(),
      gitCommitSha:  gitCommitSha ?? undefined,
    };
  },

  /**
   * Permanently delete a checkpoint record.
   * Returns false if the checkpoint was not found.
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const rows = await db.select({ id: checkpoints.id })
      .from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId))
      .limit(1);
    if (rows.length === 0) return false;

    await db.delete(checkpoints).where(eq(checkpoints.checkpointId, checkpointId));
    return true;
  },

  async rollback(checkpointId: string): Promise<RollbackResult> {
    const rows = await db.select()
      .from(checkpoints)
      .where(eq(checkpoints.checkpointId, checkpointId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { ok: false, checkpointId, filesRestored: 0, error: 'Checkpoint not found' };
    }

    const snapshots = (row.fileSnapshots ?? {}) as Record<string, string | null>;
    const created   = (row.createdFiles  ?? []) as string[];
    const restoredPaths: string[] = [];
    let filesRestored = 0;

    // Determine the base directory (prefer project-scoped dir, fall back to sandbox root)
    const projectDir = getProjectDir(row.projectId);

    for (const [filePath, oldContent] of Object.entries(snapshots)) {
      // Support both relative paths (from workspace-scanner) and legacy absolute-ish paths
      const abs = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(projectDir, filePath);

      if (oldContent === null) {
        // File was created during run — delete it on rollback
        await safeDeleteFile(abs);
        restoredPaths.push(filePath);
      } else {
        const result = await safeWriteFile(abs, oldContent);
        if (result.ok) {
          filesRestored++;
          restoredPaths.push(filePath);
        }
      }
    }

    // Delete any files that were created but not in snapshots dict
    for (const f of created) {
      if (!(f in snapshots)) {
        const abs = path.isAbsolute(f)
          ? f
          : path.resolve(projectDir, f);
        await safeDeleteFile(abs);
        restoredPaths.push(f);
      }
    }

    await db.update(checkpoints)
      .set({ status: 'rolled_back' })
      .where(eq(checkpoints.checkpointId, checkpointId));

    // Task 2: Write rollback history audit trail
    const rollbackId = crypto.randomUUID();
    await db.insert(rollbackHistory).values({
      checkpointId,
      projectId:     row.projectId,
      runId:         row.runId ?? null,
      scope:         'full',
      status:        'completed',
      restoredFiles: restoredPaths as unknown as string[],
      triggeredAt:   new Date(),
    }).catch((err) => {
      console.error('[checkpoint-store] Failed to write rollback history:', err);
    });

    return { ok: true, checkpointId, filesRestored, rollbackId };
  },

  /**
   * Compare two checkpoints and return a file-level diff.
   * Used by the diff viewer in CheckpointPanel.
   */
  async diffCheckpoints(
    checkpointId: string,
    compareId:    string,
  ): Promise<{ added: string[]; removed: string[]; modified: string[]; totalChanges: number }> {
    const [rows1, rows2] = await Promise.all([
      db.select().from(checkpoints).where(eq(checkpoints.checkpointId, checkpointId)).limit(1),
      db.select().from(checkpoints).where(eq(checkpoints.checkpointId, compareId)).limit(1),
    ]);

    const cpA = rows1[0];
    const cpB = rows2[0];

    if (!cpA || !cpB) {
      return { added: [], removed: [], modified: [], totalChanges: 0 };
    }

    const filesA = new Set([
      ...((cpA.createdFiles  as string[]) ?? []),
      ...((cpA.modifiedFiles as string[]) ?? []),
    ]);
    const filesB = new Set([
      ...((cpB.createdFiles  as string[]) ?? []),
      ...((cpB.modifiedFiles as string[]) ?? []),
    ]);

    const added:    string[] = [];
    const removed:  string[] = [];
    const modified: string[] = [];

    for (const f of filesA) {
      if (!filesB.has(f)) added.push(f);
      else modified.push(f);
    }
    for (const f of filesB) {
      if (!filesA.has(f)) removed.push(f);
    }

    return {
      added,
      removed,
      modified,
      totalChanges: added.length + removed.length + modified.length,
    };
  },
};
