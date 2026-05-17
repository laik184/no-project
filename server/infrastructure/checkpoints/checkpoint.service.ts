/**
 * checkpoint.service.ts
 * Central checkpoint orchestrator.
 * Manages the in-memory + DB checkpoint registry and coordinates
 * git commits with file snapshots.
 */

import fs   from "fs/promises";
import path from "path";
import crypto from "crypto";
import { db }                      from "../db/index.ts";
import { checkpoints }             from "../../../shared/schema.ts";
import { eq, and, desc }           from "drizzle-orm";
import { createCheckpointCommit }  from "./git-checkpoint.service.ts";
import { captureSnapshot }         from "./snapshot.service.ts";
import {
  emitCheckpointCreating,
  emitCheckpointStable,
  emitCheckpointFailed,
} from "./checkpoint.events.ts";
import {
  CHECKPOINT_FS_BASE,
  MAX_CHECKPOINTS_PER_PROJECT,
} from "./checkpoint.constants.ts";
import type {
  CheckpointMeta,
  CreateCheckpointOptions,
  CheckpointStatus,
} from "./checkpoint.types.ts";

// ─── In-memory cache (avoids DB round-trips for hot path) ─────────────────────

const memCache = new Map<string, CheckpointMeta>(); // key: `${projectId}:${checkpointId}`

function cacheKey(projectId: number, checkpointId: string): string {
  return `${projectId}:${checkpointId}`;
}

// ─── Store implementation ─────────────────────────────────────────────────────

async function create(opts: CreateCheckpointOptions): Promise<CheckpointMeta> {
  const checkpointId = `cp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const meta: CheckpointMeta = {
    checkpointId,
    projectId:    opts.projectId,
    runId:        opts.runId,
    trigger:      opts.trigger,
    status:       "creating",
    gitCommitSha: null,
    fileCount:    0,
    createdAt:    Date.now(),
    label:        opts.label,
  };

  emitCheckpointCreating(meta);
  memCache.set(cacheKey(opts.projectId, checkpointId), meta);

  try {
    // ── 1. Git safety commit ────────────────────────────────────────────────
    const sha = await createCheckpointCommit(
      opts.sandboxRoot,
      checkpointId,
      opts.label,
    );
    meta.gitCommitSha = sha;

    // ── 2. File snapshot (belt-and-suspenders) ──────────────────────────────
    const { fileCount } = await captureSnapshot(
      opts.projectId,
      checkpointId,
      opts.sandboxRoot,
    );
    meta.fileCount = fileCount;

    // ── 3. Persist to DB ────────────────────────────────────────────────────
    meta.status = "stable";
    await persistToDB(meta);

    memCache.set(cacheKey(opts.projectId, checkpointId), meta);
    emitCheckpointStable(meta);
  } catch (err: any) {
    meta.status = "failed";
    memCache.set(cacheKey(opts.projectId, checkpointId), meta);
    emitCheckpointFailed(checkpointId, opts.projectId, err.message);
    console.error(`[checkpoint] Creation failed for ${checkpointId}:`, err.message);
  }

  return meta;
}

async function get(
  projectId:    number,
  checkpointId: string,
): Promise<CheckpointMeta | null> {
  const cached = memCache.get(cacheKey(projectId, checkpointId));
  if (cached) return cached;

  try {
    const rows = await db
      .select()
      .from(checkpoints)
      .where(and(
        eq(checkpoints.projectId,    projectId),
        eq(checkpoints.checkpointId, checkpointId),
      ))
      .limit(1);

    if (!rows.length) return null;
    const meta = rowToMeta(rows[0]);
    memCache.set(cacheKey(projectId, checkpointId), meta);
    return meta;
  } catch {
    return null;
  }
}

async function listForProject(projectId: number): Promise<CheckpointMeta[]> {
  try {
    const rows = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.projectId, projectId))
      .orderBy(desc(checkpoints.createdAt))
      .limit(MAX_CHECKPOINTS_PER_PROJECT);
    return rows.map(rowToMeta);
  } catch {
    // Fallback to in-memory cache
    return [...memCache.values()].filter((m) => m.projectId === projectId);
  }
}

async function markRolledBack(
  projectId:    number,
  checkpointId: string,
): Promise<void> {
  const key  = cacheKey(projectId, checkpointId);
  const meta = memCache.get(key);
  if (meta) { meta.status = "rolled_back"; memCache.set(key, meta); }
  await updateStatus(projectId, checkpointId, "rolled_back");
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function persistToDB(meta: CheckpointMeta): Promise<void> {
  try {
    await db.insert(checkpoints).values({
      checkpointId:  meta.checkpointId,
      projectId:     meta.projectId,
      runId:         meta.runId ?? null,
      trigger:       meta.trigger,
      status:        meta.status,
      gitCommitSha:  meta.gitCommitSha ?? null,
      fileCount:     meta.fileCount,
      label:         meta.label ?? null,
      createdAt:     new Date(meta.createdAt),
    }).onConflictDoNothing();
  } catch (e: any) {
    console.warn("[checkpoint] DB persist failed (non-fatal):", e.message);
  }
}

async function updateStatus(
  projectId:    number,
  checkpointId: string,
  status:       CheckpointStatus,
): Promise<void> {
  try {
    await db.update(checkpoints)
      .set({ status })
      .where(and(
        eq(checkpoints.projectId,    projectId),
        eq(checkpoints.checkpointId, checkpointId),
      ));
  } catch { /* non-fatal */ }
}

function rowToMeta(row: any): CheckpointMeta {
  return {
    checkpointId:  row.checkpointId,
    projectId:     row.projectId,
    runId:         row.runId ?? undefined,
    trigger:       row.trigger,
    status:        row.status,
    gitCommitSha:  row.gitCommitSha ?? null,
    fileCount:     row.fileCount ?? 0,
    createdAt:     row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
    label:         row.label ?? undefined,
  };
}

// ─── Exported store object ─────────────────────────────────────────────────────

export const checkpointStore = {
  create,
  get,
  listForProject,
  markRolledBack,
};
