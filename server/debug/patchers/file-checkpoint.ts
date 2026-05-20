/**
 * file-checkpoint.ts
 *
 * Snapshot project files before the recovery agent patches them.
 * Enables rollback if a patch makes the situation worse.
 *
 * Checkpoints stored at: .data/checkpoints/<projectId>/<sessionId>/
 * Each file is stored with its relative path as the filename (slashes → __).
 *
 * Ownership: autonomous-debug/patchers — single responsibility: snapshots.
 * No LLM, no bus access.
 */

import fs from "fs/promises";
import path from "path";
import type { PatchCheckpoint } from "../types/debug-types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const CHECKPOINT_BASE = path.resolve(".data", "checkpoints");
const MAX_CHECKPOINTS_PER_PROJECT = 5;

// ─── Path helpers ─────────────────────────────────────────────────────────────

function checkpointDir(projectId: number, sessionId: string): string {
  return path.join(CHECKPOINT_BASE, String(projectId), sessionId);
}

function encodeFilePath(filePath: string): string {
  return filePath.replace(/\//g, "__").replace(/\\/g, "__");
}

function metaPath(projectId: number, sessionId: string): string {
  return path.join(checkpointDir(projectId, sessionId), "_meta.json");
}

// ─── Eviction ─────────────────────────────────────────────────────────────────

async function evictOldCheckpoints(projectId: number): Promise<void> {
  const projectDir = path.join(CHECKPOINT_BASE, String(projectId));
  try {
    const entries = await fs.readdir(projectDir);
    if (entries.length < MAX_CHECKPOINTS_PER_PROJECT) return;

    // Sort by name (sessionId contains timestamp suffix) and remove oldest
    const toRemove = entries.sort().slice(0, entries.length - MAX_CHECKPOINTS_PER_PROJECT + 1);
    for (const entry of toRemove) {
      await fs.rm(path.join(projectDir, entry), { recursive: true, force: true });
    }
  } catch {
    // Directory may not exist yet — no-op
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a checkpoint for the given file paths.
 * Returns the checkpoint object (or null if all files failed to read).
 */
export async function createCheckpoint(
  projectId: number,
  sessionId: string,
  filePaths: string[],
  sandboxRoot: string,
): Promise<PatchCheckpoint | null> {
  const files: Record<string, string> = {};
  const dir = checkpointDir(projectId, sessionId);

  await evictOldCheckpoints(projectId);
  await fs.mkdir(dir, { recursive: true });

  for (const rel of filePaths) {
    const abs = path.join(sandboxRoot, rel);
    try {
      const content = await fs.readFile(abs, "utf8");
      files[rel] = content;
      const encoded = encodeFilePath(rel);
      await fs.writeFile(path.join(dir, encoded), content, "utf8");
    } catch {
      // File may not exist yet — skip
    }
  }

  if (Object.keys(files).length === 0) return null;

  const checkpoint: PatchCheckpoint = {
    projectId,
    sessionId,
    ts: Date.now(),
    files,
  };

  await fs.writeFile(metaPath(projectId, sessionId), JSON.stringify({
    projectId, sessionId, ts: checkpoint.ts, fileCount: Object.keys(files).length,
  }), "utf8");

  return checkpoint;
}

/**
 * Load a previously stored checkpoint from disk.
 */
export async function loadCheckpoint(
  projectId: number,
  sessionId: string,
): Promise<PatchCheckpoint | null> {
  const dir = checkpointDir(projectId, sessionId);
  try {
    const entries = await fs.readdir(dir);
    const files: Record<string, string> = {};

    for (const entry of entries) {
      if (entry === "_meta.json") continue;
      const rel = entry.replace(/__/g, "/");
      files[rel] = await fs.readFile(path.join(dir, entry), "utf8");
    }

    return { projectId, sessionId, ts: Date.now(), files };
  } catch {
    return null;
  }
}

/** List all checkpoint sessionIds for a project, newest last. */
export async function listCheckpoints(projectId: number): Promise<string[]> {
  const projectDir = path.join(CHECKPOINT_BASE, String(projectId));
  try {
    const entries = await fs.readdir(projectDir);
    return entries.sort();
  } catch {
    return [];
  }
}
