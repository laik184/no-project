/**
 * rollback-manager.ts
 *
 * Restore project files to their pre-patch state from a checkpoint.
 * Called when post-patch verification shows the situation worsened.
 *
 * Ownership: autonomous-debug/patchers — single responsibility: rollback.
 * No LLM, no bus access.
 */

import fs from "fs/promises";
import path from "path";
import { loadCheckpoint } from "./file-checkpoint.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RollbackResult {
  readonly success: boolean;
  readonly restoredFiles: string[];
  readonly failedFiles: string[];
  readonly reason: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Restore all files in the checkpoint to their original content.
 * Files that fail (e.g. I/O error) are reported but don't abort the rollback.
 */
export async function rollbackToCheckpoint(
  projectId: number,
  sessionId: string,
  sandboxRoot: string,
): Promise<RollbackResult> {
  const checkpoint = await loadCheckpoint(projectId, sessionId);

  if (!checkpoint) {
    return {
      success:       false,
      restoredFiles: [],
      failedFiles:   [],
      reason:        `No checkpoint found for project ${projectId} session ${sessionId}.`,
    };
  }

  const restoredFiles: string[] = [];
  const failedFiles:   string[] = [];

  for (const [relPath, content] of Object.entries(checkpoint.files)) {
    const abs = path.join(sandboxRoot, relPath);
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
      restoredFiles.push(relPath);
    } catch (err: any) {
      console.error(`[rollback-manager] Failed to restore ${relPath}: ${err.message}`);
      failedFiles.push(relPath);
    }
  }

  const success = restoredFiles.length > 0 && failedFiles.length === 0;
  const reason  = success
    ? `Rolled back ${restoredFiles.length} file(s) to pre-patch state.`
    : failedFiles.length > 0
      ? `Partial rollback: restored ${restoredFiles.length}, failed ${failedFiles.length}.`
      : "No files were restored.";

  return { success, restoredFiles, failedFiles, reason };
}

/**
 * Check whether a rollback would help by comparing current file content
 * against checkpoint. Returns true if at least one file differs.
 */
export async function hasUncommittedChanges(
  projectId: number,
  sessionId: string,
  sandboxRoot: string,
): Promise<boolean> {
  const checkpoint = await loadCheckpoint(projectId, sessionId);
  if (!checkpoint) return false;

  for (const [relPath, original] of Object.entries(checkpoint.files)) {
    try {
      const current = await fs.readFile(path.join(sandboxRoot, relPath), "utf8");
      if (current !== original) return true;
    } catch {
      return true; // File was deleted — definitely changed
    }
  }
  return false;
}
