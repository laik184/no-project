/**
 * server/services/chat/checkpoint.service.ts
 *
 * Checkpoint operations — business facade over the checkpoint repository
 * and workspace snapshot utilities.
 *
 * No Chat-layer imports — depends only on Repositories, Infrastructure,
 * and Shared utilities.
 */

import crypto from 'crypto';
import fs     from 'fs';
import path   from 'path';
import { db, captureGitSha }          from '../../infrastructure/index.ts';
import { checkpoints }                from '../../../shared/schema.ts';
import { checkpointRepository }       from '../../repositories/chat/checkpoint.repository.ts';
import { scanWorkspace }              from '../../shared/filesystem/workspace-scanner.ts';
import type {
  ChatCheckpoint,
  CheckpointTrigger,
  RollbackResult,
  SnapshotDiff,
}                                     from '../../chat/types/checkpoint.types.ts';

export type { ChatCheckpoint, CheckpointTrigger, RollbackResult, SnapshotDiff };

const SANDBOX_ROOT  = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';
const SNAPSHOTS_DIR = path.join(SANDBOX_ROOT, '.checkpoints');

// ── Snapshot file helpers ─────────────────────────────────────────────────────

function ensureSnapshotsDir(): void {
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

function snapshotPath(checkpointId: string): string {
  return path.join(SNAPSHOTS_DIR, `${checkpointId}.json`);
}

function saveSnapshot(checkpointId: string, files: Record<string, string>): void {
  ensureSnapshotsDir();
  fs.writeFileSync(snapshotPath(checkpointId), JSON.stringify({ checkpointId, files }), 'utf8');
}

function loadSnapshot(checkpointId: string): { checkpointId: string; files: Record<string, string> } | null {
  const p = snapshotPath(checkpointId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

async function captureSnapshot(): Promise<Record<string, string>> {
  const files = await scanWorkspace(SANDBOX_ROOT);
  return Object.fromEntries(files.map((f) => [f.path, f.content]));
}

function diffSnapshots(
  older: Record<string, string>,
  newer: Record<string, string>,
): { created: string[]; modified: string[]; deleted: string[] } {
  const created:  string[] = [];
  const modified: string[] = [];
  const deleted:  string[] = [];

  for (const [p, content] of Object.entries(newer)) {
    if (!(p in older))             created.push(p);
    else if (older[p] !== content) modified.push(p);
  }
  for (const p of Object.keys(older)) {
    if (!(p in newer)) deleted.push(p);
  }
  return { created, modified, deleted };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const checkpointService = {
  async createForRun(
    runId:     string,
    projectId: number,
    goal:      string,
    trigger:   CheckpointTrigger = 'run_complete',
  ): Promise<ChatCheckpoint> {
    const checkpointId = crypto.randomUUID();
    const files        = await captureSnapshot();
    saveSnapshot(checkpointId, files);

    const fileList     = Object.keys(files);
    const gitCommitSha = await captureGitSha(SANDBOX_ROOT).catch(() => undefined);

    const [row] = await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId,
      label:         goal.slice(0, 80),
      description:   `Auto-checkpoint after run: ${goal.slice(0, 120)}`,
      trigger,
      status:        'active',
      fileCount:     fileList.length,
      createdFiles:  fileList as unknown as string[],
      modifiedFiles: [] as unknown as string[],
      deletedFiles:  [] as unknown as string[],
      gitCommitSha:  gitCommitSha ?? null,
    }).returning();

    return checkpointRepository.findById(row.checkpointId) as Promise<ChatCheckpoint>;
  },

  async createManual(projectId: number, label: string): Promise<ChatCheckpoint> {
    const checkpointId = crypto.randomUUID();
    const files        = await captureSnapshot();
    saveSnapshot(checkpointId, files);

    const fileList     = Object.keys(files);
    const gitCommitSha = await captureGitSha(SANDBOX_ROOT).catch(() => undefined);

    const [row] = await db.insert(checkpoints).values({
      checkpointId,
      projectId,
      runId:         null,
      label:         label.slice(0, 80),
      description:   label,
      trigger:       'manual',
      status:        'active',
      fileCount:     fileList.length,
      createdFiles:  fileList as unknown as string[],
      modifiedFiles: [] as unknown as string[],
      deletedFiles:  [] as unknown as string[],
      gitCommitSha:  gitCommitSha ?? null,
    }).returning();

    return checkpointRepository.findById(row.checkpointId) as Promise<ChatCheckpoint>;
  },

  async listByProject(projectId: number, limit = 20): Promise<ChatCheckpoint[]> {
    return checkpointRepository.list(projectId);
  },

  async findById(checkpointId: string): Promise<ChatCheckpoint | null> {
    return checkpointRepository.findById(checkpointId);
  },

  async rollback(checkpointId: string): Promise<RollbackResult> {
    const snap = loadSnapshot(checkpointId);
    if (!snap) {
      return { ok: false, checkpointId, filesRestored: 0, error: 'Snapshot not found on disk' };
    }

    const rollbackId  = crypto.randomUUID();
    let filesRestored = 0;

    try {
      for (const [relPath, content] of Object.entries(snap.files)) {
        const abs = path.join(SANDBOX_ROOT, relPath);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
        filesRestored++;
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { ok: false, checkpointId, filesRestored, rollbackId, error };
    }

    const cp = await checkpointRepository.findById(checkpointId);
    await checkpointRepository.markRolledBack(checkpointId);
    await checkpointRepository.insertRollbackHistory(
      checkpointId,
      rollbackId,
      cp?.projectId ?? 0,
      cp?.runId ?? null,
      Object.keys(snap.files),
    );

    return { ok: true, checkpointId, filesRestored, rollbackId };
  },

  async diff(id1: string, id2: string): Promise<SnapshotDiff> {
    const snap1 = loadSnapshot(id1);
    const snap2 = loadSnapshot(id2);

    if (!snap1 || !snap2) {
      return { added: [], removed: [], modified: [], totalChanges: 0 };
    }

    const { created, modified, deleted } = diffSnapshots(snap1.files, snap2.files);
    return {
      added:        created,
      removed:      deleted,
      modified,
      totalChanges: created.length + modified.length + deleted.length,
    };
  },

  async delete(checkpointId: string): Promise<boolean> {
    const deleted = await checkpointRepository.delete(checkpointId);
    if (deleted) {
      try { fs.unlinkSync(snapshotPath(checkpointId)); } catch { /* ignore */ }
    }
    return deleted;
  },
};
