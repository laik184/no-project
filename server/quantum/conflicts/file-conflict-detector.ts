/**
 * file-conflict-detector.ts
 *
 * Detects write conflicts between execution paths — when two or more paths
 * claim writes to the same file path within one quantum run.
 * Pure detection — no resolution logic here.
 */

import { v4 as uuid } from "uuid";
import type { PathConflict } from "../types/path.types.ts";
import type { PathResult } from "../types/path.types.ts";
import { telemetryConflictDetected } from "../telemetry/quantum-telemetry.ts";

// ── Store ─────────────────────────────────────────────────────────────────────
// quantumRunId → conflictId → PathConflict

const _conflicts = new Map<string, Map<string, PathConflict>>();

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Analyse completed path results and detect file conflicts.
 * Returns all newly detected conflicts.
 */
export function detectConflicts(
  quantumRunId: string,
  runId:        string,
  results:      Map<string, PathResult>,   // pathId → PathResult
): PathConflict[] {
  // Build file → [pathId] map
  const fileToPathIds = new Map<string, string[]>();

  for (const [pathId, result] of results) {
    for (const filePath of result.filesWritten) {
      if (!fileToPathIds.has(filePath)) fileToPathIds.set(filePath, []);
      fileToPathIds.get(filePath)!.push(pathId);
    }
  }

  const detected: PathConflict[] = [];

  for (const [filePath, pathIds] of fileToPathIds) {
    if (pathIds.length < 2) continue;

    const conflict: PathConflict = {
      conflictId:  uuid(),
      filePath,
      pathIds,
      detected:    Date.now(),
      resolved:    false,
    };

    _storeConflict(quantumRunId, conflict);
    telemetryConflictDetected(conflict, runId);
    detected.push(conflict);
  }

  return detected;
}

// ── Store helpers ─────────────────────────────────────────────────────────────

function _storeConflict(quantumRunId: string, conflict: PathConflict): void {
  if (!_conflicts.has(quantumRunId)) _conflicts.set(quantumRunId, new Map());
  _conflicts.get(quantumRunId)!.set(conflict.conflictId, conflict);
}

export function markResolved(
  quantumRunId: string,
  conflictId:   string,
  winnerPathId: string,
  resolution:   PathConflict["resolution"],
): void {
  const conflict = _conflicts.get(quantumRunId)?.get(conflictId);
  if (!conflict) return;
  const updated: PathConflict = {
    ...conflict,
    resolved:      true,
    resolution,
    winnerPathId,
  };
  _conflicts.get(quantumRunId)!.set(conflictId, updated);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getConflicts(quantumRunId: string): PathConflict[] {
  return Array.from(_conflicts.get(quantumRunId)?.values() ?? []);
}

export function getUnresolved(quantumRunId: string): PathConflict[] {
  return getConflicts(quantumRunId).filter(c => !c.resolved);
}

export function hasUnresolved(quantumRunId: string): boolean {
  return getUnresolved(quantumRunId).length > 0;
}

export function conflictCount(quantumRunId: string): number {
  return _conflicts.get(quantumRunId)?.size ?? 0;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearConflicts(quantumRunId: string): void {
  _conflicts.delete(quantumRunId);
}
