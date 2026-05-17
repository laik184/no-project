/**
 * snapshot-diff.ts
 * Computes the diff between two snapshot directories.
 * Identifies added, removed, and modified files between checkpoints.
 * Used by the recovery manager to show what an agent run changed.
 */

import fs   from "fs/promises";
import path from "path";
import { CHECKPOINT_FS_BASE } from "../checkpoints/checkpoint.constants.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChangeKind = "added" | "removed" | "modified" | "unchanged";

export interface FileDelta {
  relativePath: string;
  kind:         ChangeKind;
  beforeSize?:  number;
  afterSize?:   number;
}

export interface SnapshotDiff {
  projectId:      number;
  beforeId:       string;
  afterId:        string;
  computedAt:     number;
  totalChanges:   number;
  added:          FileDelta[];
  removed:        FileDelta[];
  modified:       FileDelta[];
  unchanged:      number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readSnapshotIndex(
  projectId:    number,
  checkpointId: string,
): Promise<Map<string, number>> {
  const dir = path.resolve(CHECKPOINT_FS_BASE, String(projectId), checkpointId);
  const index = new Map<string, number>();
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (entry === "_snapshot_meta.json") continue;
      const rel  = entry.replace(/__/g, "/");
      const stat = await fs.stat(path.join(dir, entry));
      index.set(rel, stat.size);
    }
  } catch { /* snapshot may not exist */ }
  return index;
}

async function readFileFromSnapshot(
  projectId:    number,
  checkpointId: string,
  relativePath: string,
): Promise<string | null> {
  const encoded = relativePath.replace(/[/\\]/g, "__");
  const abs     = path.resolve(
    CHECKPOINT_FS_BASE, String(projectId), checkpointId, encoded,
  );
  try {
    return await fs.readFile(abs, "utf-8");
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the diff between two snapshots.
 * `beforeId` = earlier checkpoint, `afterId` = later checkpoint.
 */
export async function diffSnapshots(
  projectId: number,
  beforeId:  string,
  afterId:   string,
): Promise<SnapshotDiff> {
  const [before, after] = await Promise.all([
    readSnapshotIndex(projectId, beforeId),
    readSnapshotIndex(projectId, afterId),
  ]);

  const added:    FileDelta[] = [];
  const removed:  FileDelta[] = [];
  const modified: FileDelta[] = [];
  let   unchanged = 0;

  // Files in after — check against before
  for (const [rel, afterSize] of after) {
    if (!before.has(rel)) {
      added.push({ relativePath: rel, kind: "added", afterSize });
    } else {
      const beforeSize = before.get(rel)!;
      if (beforeSize !== afterSize) {
        modified.push({ relativePath: rel, kind: "modified", beforeSize, afterSize });
      } else {
        unchanged++;
      }
    }
  }

  // Files in before but not in after — removed
  for (const [rel, beforeSize] of before) {
    if (!after.has(rel)) {
      removed.push({ relativePath: rel, kind: "removed", beforeSize });
    }
  }

  return {
    projectId,
    beforeId,
    afterId,
    computedAt:   Date.now(),
    totalChanges: added.length + removed.length + modified.length,
    added,
    removed,
    modified,
    unchanged,
  };
}

/**
 * Produce a compact text summary of the diff (for agent/log output).
 */
export function formatDiffSummary(diff: SnapshotDiff): string {
  const lines: string[] = [
    `Snapshot diff ${diff.beforeId} → ${diff.afterId}`,
    `  +${diff.added.length} added  -${diff.removed.length} removed  ~${diff.modified.length} modified  =${diff.unchanged} unchanged`,
  ];
  for (const f of diff.added)    lines.push(`  + ${f.relativePath}`);
  for (const f of diff.removed)  lines.push(`  - ${f.relativePath}`);
  for (const f of diff.modified) lines.push(`  ~ ${f.relativePath} (${f.beforeSize}B → ${f.afterSize}B)`);
  return lines.join("\n");
}
