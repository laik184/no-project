/**
 * aggregation/confidence-scorer.ts
 *
 * Scores each execution path for the aggregation phase.
 * Separate from server/intelligence/confidence — this is quantum-layer scoring
 * concerned only with path comparison, not agent-level reliability history.
 */

import type { ExecutionPath }    from "../types/path.types.ts";
import type { PathResult }       from "../types/path.types.ts";
import type { PathRanking }      from "../types/path.types.ts";

// ── Scoring weights ───────────────────────────────────────────────────────────

const W = {
  verificationPass: 0.35,
  successOutcome:   0.25,
  lowRetries:       0.15,
  lowHallucination: 0.15,
  lowDuration:      0.10,
} as const;

// ── Score a single path ───────────────────────────────────────────────────────

export interface PathScoringInput {
  path:   ExecutionPath;
  result: PathResult;
}

export function scorePath(input: PathScoringInput): number {
  const { path, result } = input;

  const verFactor  = result.verificationPassed ? 1.0 : 0.0;
  const succFactor = result.success            ? 1.0 : 0.0;

  const retryFactor = Math.max(0, 1 - result.retries * 0.10);

  const hallFactor  = Math.max(0, 1 - path.hallucinationRisk);

  // Duration score: < 30s = 1.0, 30–120s = 0.5, >120s = 0.1
  const dur = result.durationMs;
  const durFactor =
    dur <  30_000 ? 1.0 :
    dur < 120_000 ? 0.5 : 0.1;

  return (
    verFactor   * W.verificationPass +
    succFactor  * W.successOutcome   +
    retryFactor * W.lowRetries       +
    hallFactor  * W.lowHallucination +
    durFactor   * W.lowDuration
  );
}

// ── Rank all paths ────────────────────────────────────────────────────────────

export function rankPaths(
  paths:   ExecutionPath[],
  results: Map<string, PathResult>,
): PathRanking[] {
  const scored: Array<{ path: ExecutionPath; score: number }> = [];

  for (const path of paths) {
    const result = results.get(path.pathId);
    if (!result) continue;
    scored.push({ path, score: scorePath({ path, result }) });
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.map((entry, idx) => {
    const result = results.get(entry.path.pathId)!;
    return {
      pathId:             entry.path.pathId,
      rank:               idx + 1,
      confidenceScore:    entry.score,
      verificationPassed: result.verificationPassed,
      hallucinationRisk:  entry.path.hallucinationRisk,
      reason:             `Rank ${idx + 1}: score=${entry.score.toFixed(3)} ` +
                          `verified=${result.verificationPassed} ` +
                          `retries=${result.retries}`,
    };
  });
}

// ── Compatibility check (for merge grouping) ──────────────────────────────────

/**
 * Two paths are "merge-compatible" if they share > 50% of written files.
 * This is a heuristic — compatible paths likely solve overlapping sub-problems.
 */
export function areMergeCompatible(
  resultA: PathResult,
  resultB: PathResult,
): boolean {
  const setA = new Set(resultA.filesWritten);
  const setB = new Set(resultB.filesWritten);
  const intersection = [...setA].filter(f => setB.has(f)).length;
  const union        = new Set([...setA, ...setB]).size;
  if (union === 0) return false;
  const jaccard = intersection / union;
  return jaccard > 0.5;
}

// ── Find merge groups ─────────────────────────────────────────────────────────

export function findMergeGroups(results: Map<string, PathResult>): string[][] {
  const pathIds  = Array.from(results.keys());
  const groups:  string[][] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < pathIds.length; i++) {
    if (assigned.has(pathIds[i])) continue;
    const group = [pathIds[i]];
    assigned.add(pathIds[i]);

    for (let j = i + 1; j < pathIds.length; j++) {
      if (assigned.has(pathIds[j])) continue;
      const rA = results.get(pathIds[i])!;
      const rB = results.get(pathIds[j])!;
      if (areMergeCompatible(rA, rB)) {
        group.push(pathIds[j]);
        assigned.add(pathIds[j]);
      }
    }
    groups.push(group);
  }

  return groups;
}
