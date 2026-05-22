/**
 * server/quantum/conflicts/conflict-detector.ts
 *
 * Comprehensive multi-type conflict detector for the Nura-X parallel runtime.
 * Delegates FILE_WRITE detection to the existing file-conflict-detector and
 * adds AST, MEMORY, RUNTIME, and DAG_STATE conflict detection.
 *
 * Conflict types
 * ──────────────
 *   FILE_WRITE_CONFLICT  — two paths wrote the same file
 *   AST_CONFLICT         — overlapping edits to the same function/class block
 *   MEMORY_CONFLICT      — concurrent writes to the same memory key
 *   RUNTIME_CONFLICT     — concurrent mutation of the same runtime state key
 *   DAG_STATE_CONFLICT   — two DAG nodes claimed the same output slot
 */

import { v4 as uuidv4 }          from "uuid";
import { detectConflicts as detectFileConflicts } from "./file-conflict-detector.ts";
import { conflictStateStore }    from "./conflict-state-store.ts";
import { emitConflictDetected }  from "../telemetry/conflict-telemetry.ts";
import { extractFragments }      from "./ast-merge-engine.ts";
import type { PathResult }       from "../types/path.types.ts";
import type { UnifiedConflict, ConflictType, ConflictSeverity } from "./conflict-types.ts";

// ── Memory / runtime snapshot types ──────────────────────────────────────────

export interface MemoryEntry { key: string; writerId: string; value: unknown }
export interface DagStateEntry { slotKey: string; nodeId: string; value: unknown }

// ── Main detector ─────────────────────────────────────────────────────────────

export interface DetectorInput {
  quantumRunId:    string;
  runId:           string;
  results:         Map<string, PathResult>;        // pathId → PathResult
  memorySnapshot?: Map<string, MemoryEntry[]>;     // key → competing entries
  dagState?:       Map<string, DagStateEntry[]>;   // slotKey → competing writes
  fileContents?:   Map<string, Map<string, string>>; // filePath:pathId → content
}

export interface DetectionSummary {
  total:          number;
  byType:         Record<ConflictType, number>;
  conflicts:      UnifiedConflict[];
}

/**
 * Run all conflict detectors and return a unified summary.
 * Registers all detected conflicts in the ConflictStateStore.
 */
export function detectAllConflicts(input: DetectorInput): DetectionSummary {
  const all: UnifiedConflict[] = [];

  all.push(..._detectFileWrite(input));
  all.push(..._detectAst(input));
  if (input.memorySnapshot) all.push(..._detectMemory(input));
  if (input.dagState)       all.push(..._detectDagState(input));
  all.push(..._detectRuntime(input));

  // Register in state store + emit telemetry
  for (const c of all) {
    conflictStateStore.recordConflict(c);
    emitConflictDetected(c);
  }

  const byType = {
    FILE_WRITE_CONFLICT: 0, AST_CONFLICT: 0,
    MEMORY_CONFLICT: 0, RUNTIME_CONFLICT: 0, DAG_STATE_CONFLICT: 0,
  } satisfies Record<ConflictType, number>;

  for (const c of all) byType[c.type]++;

  return { total: all.length, byType, conflicts: all };
}

// ── FILE_WRITE detector ───────────────────────────────────────────────────────

function _detectFileWrite(input: DetectorInput): UnifiedConflict[] {
  // Delegate to existing proven detector
  const raw = detectFileConflicts(input.quantumRunId, input.runId, input.results);

  return raw.map(c => _makeConflict({
    type:         "FILE_WRITE_CONFLICT",
    runId:        input.runId,
    quantumRunId: input.quantumRunId,
    resource:     c.filePath,
    parties:      c.pathIds,
    severity:     "high",
    metadata:     { conflictId: c.conflictId },
  }));
}

// ── AST detector ──────────────────────────────────────────────────────────────

function _detectAst(input: DetectorInput): UnifiedConflict[] {
  if (!input.fileContents) return [];
  const found: UnifiedConflict[] = [];

  // Group file contents by filePath → { pathId → content }
  const byFile = new Map<string, Map<string, string>>();
  for (const [key, pathMap] of input.fileContents) {
    // key format: "filePath"
    for (const [pathId, content] of pathMap) {
      if (!byFile.has(key)) byFile.set(key, new Map());
      byFile.get(key)!.set(pathId, content);
    }
  }

  for (const [filePath, pathContents] of byFile) {
    if (pathContents.size < 2) continue;
    const entries = Array.from(pathContents.entries());

    // Compare fragment IDs from all path pairs
    const fragmentSets = entries.map(([pathId, content]) => ({
      pathId,
      ids: new Set(extractFragments(filePath, pathId, content).map(f => f.nodeId)),
    }));

    for (let i = 0; i < fragmentSets.length - 1; i++) {
      for (let j = i + 1; j < fragmentSets.length; j++) {
        const overlap = [...fragmentSets[i].ids].filter(id => fragmentSets[j].ids.has(id));
        if (overlap.length > 0) {
          found.push(_makeConflict({
            type:         "AST_CONFLICT",
            runId:        input.runId,
            quantumRunId: input.quantumRunId,
            resource:     filePath,
            parties:      [fragmentSets[i].pathId, fragmentSets[j].pathId],
            severity:     "medium",
            metadata:     { overlappingNodes: overlap.length, nodeIds: overlap.slice(0, 5) },
          }));
        }
      }
    }
  }
  return found;
}

// ── MEMORY detector ───────────────────────────────────────────────────────────

function _detectMemory(input: DetectorInput): UnifiedConflict[] {
  const found: UnifiedConflict[] = [];
  for (const [key, entries] of input.memorySnapshot!) {
    if (entries.length < 2) continue;
    found.push(_makeConflict({
      type:         "MEMORY_CONFLICT",
      runId:        input.runId,
      quantumRunId: input.quantumRunId,
      resource:     key,
      parties:      entries.map(e => e.writerId),
      severity:     "critical",
      metadata:     { writerCount: entries.length },
    }));
  }
  return found;
}

// ── DAG_STATE detector ────────────────────────────────────────────────────────

function _detectDagState(input: DetectorInput): UnifiedConflict[] {
  const found: UnifiedConflict[] = [];
  for (const [slotKey, entries] of input.dagState!) {
    if (entries.length < 2) continue;
    found.push(_makeConflict({
      type:         "DAG_STATE_CONFLICT",
      runId:        input.runId,
      quantumRunId: input.quantumRunId,
      resource:     slotKey,
      parties:      entries.map(e => e.nodeId),
      severity:     "high",
      metadata:     { competingNodes: entries.length },
    }));
  }
  return found;
}

// ── RUNTIME detector (heuristic based on concurrent path completions) ─────────

function _detectRuntime(input: DetectorInput): UnifiedConflict[] {
  const completedAtSameMs: string[] = [];
  let   lastTs = 0;

  for (const [pathId, result] of input.results) {
    if (Math.abs(result.completedAt - lastTs) < 50) {
      completedAtSameMs.push(pathId);
    }
    lastTs = result.completedAt;
  }

  if (completedAtSameMs.length < 2) return [];

  return [_makeConflict({
    type:         "RUNTIME_CONFLICT",
    runId:        input.runId,
    quantumRunId: input.quantumRunId,
    resource:     `runtime:${input.quantumRunId}`,
    parties:      completedAtSameMs,
    severity:     "medium",
    metadata:     { simultaneousCompletions: completedAtSameMs.length },
  })];
}

// ── Factory helper ────────────────────────────────────────────────────────────

function _makeConflict(
  opts: Omit<UnifiedConflict, "conflictId" | "detectedAt" | "status">,
): UnifiedConflict {
  return {
    ...opts,
    conflictId: uuidv4(),
    detectedAt: Date.now(),
    status:     "detected",
  };
}

// ── Severity helper ───────────────────────────────────────────────────────────

export function conflictSeverity(type: ConflictType): ConflictSeverity {
  const map: Record<ConflictType, ConflictSeverity> = {
    MEMORY_CONFLICT:     "critical",
    FILE_WRITE_CONFLICT: "high",
    DAG_STATE_CONFLICT:  "high",
    AST_CONFLICT:        "medium",
    RUNTIME_CONFLICT:    "medium",
  };
  return map[type];
}
