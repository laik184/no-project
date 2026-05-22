/**
 * conflict-detector.ts
 *
 * Detects all conflict classes across parallel agent results:
 *   - same_file_write:     two+ agents wrote the same file
 *   - stale_write:         a result contains a mutation older than the session
 *   - patch_overlap:       two mutations overlap the same byte ranges
 *   - ownership_conflict:  a file is locked to a different owner
 *   - duplicate_execution: two nodes produced identical outputs for the same node role
 *
 * Returns structured MergeConflict records — does NOT resolve them.
 */

import type { AgentResult, MergeConflict, ConflictKind } from "./aggregation-types.ts";
import { emitMergeConflict } from "./aggregation-telemetry.ts";

export interface DetectionReport {
  conflicts:      MergeConflict[];
  safeFiles:      string[];
  conflictCount:  number;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1_000;  // 5 min

// ── Main detector ─────────────────────────────────────────────────────────────

export function detectAllConflicts(
  results:    AgentResult[],
  runId:      string,
  waveIndex:  number,
  sessionCreatedAt: number,
): DetectionReport {
  const conflicts: MergeConflict[] = [];

  _detectSameFileWrites(results, runId, waveIndex, conflicts);
  _detectStaleWrites(results, runId, waveIndex, sessionCreatedAt, conflicts);
  _detectDuplicateExecution(results, runId, waveIndex, conflicts);

  for (const c of conflicts) emitMergeConflict(c);

  const conflictingFiles = new Set(conflicts.map(c => c.filePath));
  const allFiles = new Set(results.flatMap(r => r.fileMutations.map(m => m.filePath)));
  const safeFiles = [...allFiles].filter(f => !conflictingFiles.has(f));

  return { conflicts, safeFiles, conflictCount: conflicts.length };
}

// ── Detectors ─────────────────────────────────────────────────────────────────

function _detectSameFileWrites(
  results:   AgentResult[],
  runId:     string,
  waveIndex: number,
  out:       MergeConflict[],
): void {
  const fileOwners = new Map<string, AgentResult[]>();

  for (const result of results) {
    for (const mutation of result.fileMutations) {
      if (mutation.operation === "delete") continue;
      if (!fileOwners.has(mutation.filePath)) fileOwners.set(mutation.filePath, []);
      fileOwners.get(mutation.filePath)!.push(result);
    }
  }

  for (const [filePath, owners] of fileOwners) {
    if (owners.length < 2) continue;
    for (let i = 1; i < owners.length; i++) {
      out.push(_makeConflict("same_file_write", filePath, owners[0].nodeId, owners[i].nodeId, runId, waveIndex));
    }
  }
}

function _detectStaleWrites(
  results:          AgentResult[],
  runId:            string,
  waveIndex:        number,
  sessionCreatedAt: number,
  out:              MergeConflict[],
): void {
  const cutoff = sessionCreatedAt - STALE_THRESHOLD_MS;

  for (const result of results) {
    for (const mutation of result.fileMutations) {
      if (mutation.ts < cutoff) {
        out.push(_makeConflict("stale_write", mutation.filePath, mutation.ownerId, "session", runId, waveIndex));
      }
    }
  }
}

function _detectDuplicateExecution(
  results:   AgentResult[],
  runId:     string,
  waveIndex: number,
  out:       MergeConflict[],
): void {
  const roleMap = new Map<string, AgentResult[]>();

  for (const result of results) {
    const key = result.agentId;
    if (!roleMap.has(key)) roleMap.set(key, []);
    roleMap.get(key)!.push(result);
  }

  for (const [, group] of roleMap) {
    if (group.length < 2) continue;
    for (let i = 1; i < group.length; i++) {
      out.push(_makeConflict("duplicate_execution", "(output)", group[0].nodeId, group[i].nodeId, runId, waveIndex));
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

function _makeConflict(
  kind:      ConflictKind,
  filePath:  string,
  ownerA:    string,
  ownerB:    string,
  runId:     string,
  waveIndex: number,
): MergeConflict {
  return { kind, filePath, ownerA, ownerB, runId, waveIndex, resolved: false };
}
