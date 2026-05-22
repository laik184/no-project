/**
 * merge-strategy.ts
 *
 * Selects and applies a merge strategy for each file across paths.
 * Delegates to ast-merge-engine or confidence-winner based on file type
 * and confidence delta between the competing paths.
 */

import type { MergeResult, MergeStrategyKind } from "../types/merge.types.ts";
import type { PathResult }    from "../types/path.types.ts";
import { getFileContents, cacheFileContent } from "../conflicts/conflict-resolver.ts";

export { cacheFileContent };

// ── Strategy selection ────────────────────────────────────────────────────────

export function selectStrategy(
  filePath:    string,
  scoreDelta:  number,   // abs(scoreA - scoreB)
): MergeStrategyKind {
  if (_isCodeFile(filePath) && scoreDelta < 0.20) return "AST_MERGE";
  if (scoreDelta >= 0.20)                          return "CONFIDENCE_WINNER";
  return "CONFIDENCE_WINNER";
}

function _isCodeFile(fp: string): boolean {
  return /\.(ts|tsx|js|jsx|mts|mjs)$/.test(fp);
}

// ── Apply merge for a single file ─────────────────────────────────────────────

export function applyMergeForFile(
  quantumRunId: string,
  filePath:     string,
  pathIdA:      string,
  pathIdB:      string,
  scoreA:       number,
  scoreB:       number,
): MergeResult {
  const contents = getFileContents(quantumRunId, filePath);
  const contentA = contents.get(pathIdA) ?? "";
  const contentB = contents.get(pathIdB) ?? "";
  const delta    = Math.abs(scoreA - scoreB);
  const strategy = selectStrategy(filePath, delta);

  if (strategy === "AST_MERGE" && contentA && contentB) {
    // Dynamic import to avoid top-level circular risk
    const { astMerge } = require("../conflicts/ast-merge-engine.ts");
    return astMerge({ filePath, contentA, contentB,
      confidenceA: scoreA, confidenceB: scoreB, pathIdA, pathIdB });
  }

  // CONFIDENCE_WINNER
  const winner = scoreA >= scoreB ? pathIdA : pathIdB;
  return {
    filePath,
    strategy:     "CONFIDENCE_WINNER",
    winnerPathId:  winner,
    content:       winner === pathIdA ? contentA : contentB,
    conflicts:     1,
    success:       true,
    reason:        `Confidence winner: delta=${delta.toFixed(3)} winner=${winner}`,
  };
}

// ── Batch merge across all conflicting files ──────────────────────────────────

export function batchMerge(
  quantumRunId:   string,
  primaryPathId:  string,
  secondaryPathId: string,
  primaryScore:   number,
  secondaryScore: number,
  primaryResult:  PathResult,
  secondaryResult: PathResult,
): MergeResult[] {
  // Find files present in both paths
  const sharedFiles = primaryResult.filesWritten.filter(
    f => secondaryResult.filesWritten.includes(f),
  );

  return sharedFiles.map(filePath =>
    applyMergeForFile(
      quantumRunId, filePath,
      primaryPathId, secondaryPathId,
      primaryScore,  secondaryScore,
    ),
  );
}
