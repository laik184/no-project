/**
 * snapshot.service.ts
 * File-system snapshot service.
 * Captures project files to .data/checkpoints/v2/<projectId>/<checkpointId>/
 * Used as a fallback when git is unavailable or as extra safety layer.
 */

import fs   from "fs/promises";
import path from "path";
import {
  CHECKPOINT_FS_BASE,
  SNAPSHOT_EXCLUDE,
  SNAPSHOT_MAX_BYTES,
  MAX_CHECKPOINTS_PER_PROJECT,
} from "./checkpoint.constants.ts";
import { atomicWrite } from "./atomic-write.util.ts";
import type { SnapshotFile } from "./checkpoint.types.ts";

// ─── Directory helpers ────────────────────────────────────────────────────────

function snapshotDir(projectId: number, checkpointId: string): string {
  return path.resolve(CHECKPOINT_FS_BASE, String(projectId), checkpointId);
}

function metaFilePath(projectId: number, checkpointId: string): string {
  return path.join(snapshotDir(projectId, checkpointId), "_snapshot_meta.json");
}

// ─── File collection ──────────────────────────────────────────────────────────

async function collectFiles(
  dir:     string,
  root:    string,
  budget:  { remaining: number },
): Promise<SnapshotFile[]> {
  const results: SnapshotFile[] = [];
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (SNAPSHOT_EXCLUDE.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);

    if (entry.isDirectory()) {
      const sub = await collectFiles(abs, root, budget);
      results.push(...sub);
    } else if (entry.isFile()) {
      if (budget.remaining <= 0) continue;
      try {
        const stat    = await fs.stat(abs);
        if (stat.size > 500_000) continue; // skip very large individual files
        const content = await fs.readFile(abs, "utf-8");
        budget.remaining -= stat.size;
        results.push({ relativePath: rel, content, sizeBytes: stat.size });
      } catch { /* binary or unreadable — skip */ }
    }
  }
  return results;
}

// ─── Eviction ─────────────────────────────────────────────────────────────────

async function evictOldSnapshots(projectId: number): Promise<void> {
  const projectDir = path.resolve(CHECKPOINT_FS_BASE, String(projectId));
  try {
    const entries = await fs.readdir(projectDir);
    if (entries.length < MAX_CHECKPOINTS_PER_PROJECT) return;
    const toRemove = entries.sort().slice(0, entries.length - MAX_CHECKPOINTS_PER_PROJECT + 1);
    for (const e of toRemove) {
      await fs.rm(path.join(projectDir, e), { recursive: true, force: true });
    }
  } catch { /* dir may not exist yet */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function captureSnapshot(
  projectId:    number,
  checkpointId: string,
  sandboxRoot:  string,
): Promise<{ fileCount: number; skipped: boolean }> {
  await evictOldSnapshots(projectId);
  const dir    = snapshotDir(projectId, checkpointId);
  await fs.mkdir(dir, { recursive: true });

  const budget = { remaining: SNAPSHOT_MAX_BYTES };
  const files  = await collectFiles(sandboxRoot, sandboxRoot, budget);

  if (files.length === 0) return { fileCount: 0, skipped: false };

  for (const file of files) {
    const encoded = file.relativePath.replace(/[/\\]/g, "__");
    await atomicWrite(path.join(dir, encoded), file.content);
  }

  await atomicWrite(metaFilePath(projectId, checkpointId), JSON.stringify({
    checkpointId,
    projectId,
    fileCount: files.length,
    capturedAt: Date.now(),
    budgetExceeded: budget.remaining <= 0,
  }, null, 2));

  return { fileCount: files.length, skipped: budget.remaining <= 0 };
}

export async function restoreSnapshot(
  projectId:    number,
  checkpointId: string,
  sandboxRoot:  string,
): Promise<{ restored: string[]; failed: string[] }> {
  const dir     = snapshotDir(projectId, checkpointId);
  const restored: string[] = [];
  const failed:   string[] = [];

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { restored, failed };
  }

  for (const entry of entries) {
    if (entry === "_snapshot_meta.json") continue;
    const rel   = entry.replace(/__/g, "/");
    const abs   = path.join(sandboxRoot, rel);
    try {
      const content = await fs.readFile(path.join(dir, entry), "utf-8");
      await atomicWrite(abs, content);
      restored.push(rel);
    } catch {
      failed.push(rel);
    }
  }
  return { restored, failed };
}

export async function listSnapshots(projectId: number): Promise<string[]> {
  const projectDir = path.resolve(CHECKPOINT_FS_BASE, String(projectId));
  try {
    return (await fs.readdir(projectDir)).sort();
  } catch {
    return [];
  }
}

export async function snapshotExists(projectId: number, checkpointId: string): Promise<boolean> {
  try {
    await fs.stat(snapshotDir(projectId, checkpointId));
    return true;
  } catch {
    return false;
  }
}
