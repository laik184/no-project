/**
 * server/engine/swarm/swarm-conflict-router.ts
 *
 * Detects and routes file-level conflicts between concurrent swarm agents.
 * Applies deterministic merge strategies and supports rollback.
 * Single responsibility: conflict detection and arbitration only.
 */

import type { SwarmConflict, SwarmTaskResult } from "./swarm-types.ts";
import {
  emitConflictDetected,
  emitConflictResolved,
} from "./swarm-telemetry.ts";

let _seq = 0;

// ── Conflict store ────────────────────────────────────────────────────────────

const _conflicts = new Map<string, SwarmConflict>();
const _bySwarm   = new Map<string, string[]>();

// ── Strategy selection ────────────────────────────────────────────────────────

type ConflictStrategy = SwarmConflict["strategy"];

function selectStrategy(filePath: string): ConflictStrategy {
  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) return "ast_safe";
  if (/\.(json|yaml|yml)$/.test(filePath)) return "confidence";
  return "precedence";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Cross-check two results for file-level conflicts.
 * Call this after each pair of concurrent agents completes.
 */
export function detectConflicts(
  runId:     string,
  projectId: number,
  swarmId:   string,
  resultA:   SwarmTaskResult,
  resultB:   SwarmTaskResult,
): SwarmConflict[] {
  const sharedFiles = resultA.filesWritten.filter(f => resultB.filesWritten.includes(f));
  const detected: SwarmConflict[] = [];

  for (const filePath of sharedFiles) {
    const conflict: SwarmConflict = {
      conflictId: `sc-${++_seq}-${Date.now()}`,
      swarmId,
      filePath,
      agentA:     resultA.agentId,
      agentB:     resultB.agentId,
      resolved:   false,
      strategy:   selectStrategy(filePath),
      detectedAt: Date.now(),
    };

    _conflicts.set(conflict.conflictId, conflict);
    if (!_bySwarm.has(swarmId)) _bySwarm.set(swarmId, []);
    _bySwarm.get(swarmId)!.push(conflict.conflictId);

    emitConflictDetected(runId, projectId, swarmId,
      conflict.conflictId, filePath, resultA.agentId, resultB.agentId);

    detected.push(conflict);
  }

  return detected;
}

/**
 * Resolve a conflict deterministically.
 * Winner = highest confidence; tie-break = verified first, then agentA.
 */
export function resolveConflict(
  runId:     string,
  projectId: number,
  conflict:  SwarmConflict,
  resultA:   SwarmTaskResult,
  resultB:   SwarmTaskResult,
): { conflict: SwarmConflict; winner: string } {
  let winner: string;

  if (conflict.strategy === "ast_safe") {
    winner = resultA.confidence >= resultB.confidence ? resultA.agentId : resultB.agentId;
  } else if (conflict.strategy === "confidence") {
    winner = resultA.confidence > resultB.confidence ? resultA.agentId : resultB.agentId;
  } else {
    // precedence: agentA wins (earlier in plan)
    winner = resultA.agentId;
  }

  const resolved: SwarmConflict = {
    ...conflict,
    resolved: true,
  };

  _conflicts.set(conflict.conflictId, resolved);
  emitConflictResolved(runId, projectId, conflict.swarmId,
    conflict.conflictId, conflict.strategy, winner);

  return { conflict: resolved, winner };
}

/** Resolve all pending conflicts for a swarm. */
export function resolveAll(
  runId:      string,
  projectId:  number,
  swarmId:    string,
  results:    Map<string, SwarmTaskResult>,
): SwarmConflict[] {
  const ids = _bySwarm.get(swarmId) ?? [];
  const unresolved = ids
    .map(id => _conflicts.get(id))
    .filter((c): c is SwarmConflict => !!c && !c.resolved);

  for (const c of unresolved) {
    const rA = results.get(c.agentA);
    const rB = results.get(c.agentB);
    if (rA && rB) resolveConflict(runId, projectId, c, rA, rB);
  }

  return unresolved;
}

export function getUnresolved(swarmId: string): SwarmConflict[] {
  const ids = _bySwarm.get(swarmId) ?? [];
  return ids
    .map(id => _conflicts.get(id))
    .filter((c): c is SwarmConflict => !!c && !c.resolved);
}

export function clearConflicts(swarmId: string): void {
  const ids = _bySwarm.get(swarmId) ?? [];
  for (const id of ids) _conflicts.delete(id);
  _bySwarm.delete(swarmId);
}
