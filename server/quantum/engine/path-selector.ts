/**
 * path-selector.ts
 *
 * Selects the best execution path from all completed paths.
 * Uses a multi-factor decision: confidence, verification, hallucination risk,
 * and path priority (declared at strategy level as tie-breaker).
 */

import type { ExecutionPath }   from "../types/path.types.ts";
import type { AggregatedResult } from "../types/quantum.types.ts";
import { getPathsForRun, getBestPath } from "../superposition/path-registry.ts";
import { rankPaths }             from "../aggregation/confidence-scorer.ts";
import { getAllResults }          from "../aggregation/result-aggregator.ts";

// ── Selection result ──────────────────────────────────────────────────────────

export interface SelectionResult {
  winnerId:    string;
  winnerPath:  ExecutionPath;
  score:       number;
  reason:      string;
  alternatives: string[];
}

// ── Selector ──────────────────────────────────────────────────────────────────

export function selectBestPath(
  quantumRunId: string,
  aggregated:   AggregatedResult,
): SelectionResult | null {
  const completedPaths = getPathsForRun(quantumRunId).filter(
    p => aggregated.completedPaths.includes(p.pathId),
  );

  if (completedPaths.length === 0) return null;

  const results  = getAllResults(quantumRunId);
  const rankings = rankPaths(completedPaths, results);

  if (rankings.length === 0) return null;

  const best     = rankings[0];
  const bestPath = completedPaths.find(p => p.pathId === best.pathId)!;

  return {
    winnerId:     best.pathId,
    winnerPath:   bestPath,
    score:        best.confidenceScore,
    reason:       best.reason,
    alternatives: rankings.slice(1).map(r => r.pathId),
  };
}

// ── Fast selection (uses registry directly) ───────────────────────────────────

export function fastSelectBest(quantumRunId: string): ExecutionPath | null {
  return getBestPath(quantumRunId) ?? null;
}

// ── Dead-heat breaker ─────────────────────────────────────────────────────────

/**
 * When two paths have scores within 0.02, prefer the one with higher priority.
 */
export function resolveDeadHeat(
  pathA: ExecutionPath,
  pathB: ExecutionPath,
  scoreA: number,
  scoreB: number,
): ExecutionPath {
  const delta = Math.abs(scoreA - scoreB);
  if (delta <= 0.02) {
    return pathA.priority >= pathB.priority ? pathA : pathB;
  }
  return scoreA >= scoreB ? pathA : pathB;
}
