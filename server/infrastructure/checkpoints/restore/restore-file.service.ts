/**
 * restore/restore-file.service.ts
 * Restores a single file from a checkpoint (git or snapshot).
 */

import fs   from "fs/promises";
import path from "path";
import { gitRestoreFile } from "../git-checkpoint.service.ts";
import { checkpointStore }  from "../checkpoint.service.ts";
import { atomicWrite }      from "../atomic-write.util.ts";
import {
  CHECKPOINT_FS_BASE,
} from "../checkpoint.constants.ts";

export interface RestoreFileResult {
  success:      boolean;
  filePath:     string;
  checkpointId: string;
  strategy:     "git" | "snapshot" | "none";
  error?:       string;
}

/**
 * Restore a single file to its state at the given checkpoint.
 */
export async function restoreFile(
  projectId:    number,
  checkpointId: string,
  sandboxRoot:  string,
  relativePath: string,
): Promise<RestoreFileResult> {
  const base: Omit<RestoreFileResult, "strategy" | "success" | "error"> = {
    filePath:     relativePath,
    checkpointId,
  };

  const meta = await checkpointStore.get(projectId, checkpointId);
  if (!meta) {
    return { ...base, success: false, strategy: "none", error: "Checkpoint not found" };
  }

  // ── Strategy 1: git checkout specific file ───────────────────────────────
  if (meta.gitCommitSha) {
    const ok = await gitRestoreFile(sandboxRoot, meta.gitCommitSha, relativePath);
    if (ok) return { ...base, success: true, strategy: "git" };
  }

  // ── Strategy 2: read from snapshot directory ──────────────────────────────
  const encoded    = relativePath.replace(/[/\\]/g, "__");
  const snapshotFs = path.resolve(
    CHECKPOINT_FS_BASE,
    String(projectId),
    checkpointId,
    encoded,
  );
  try {
    const content = await fs.readFile(snapshotFs, "utf-8");
    const absPath = path.join(sandboxRoot, relativePath);
    await atomicWrite(absPath, content);
    return { ...base, success: true, strategy: "snapshot" };
  } catch {
    return {
      ...base,
      success:  false,
      strategy: "none",
      error:    "File not found in git history or snapshot",
    };
  }
}

/**
 * List files captured in a snapshot checkpoint directory.
 */
export async function listSnapshotFiles(
  projectId:    number,
  checkpointId: string,
): Promise<string[]> {
  const dir = path.resolve(CHECKPOINT_FS_BASE, String(projectId), checkpointId);
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e !== "_snapshot_meta.json")
      .map((e) => e.replace(/__/g, "/"));
  } catch {
    return [];
  }
}
