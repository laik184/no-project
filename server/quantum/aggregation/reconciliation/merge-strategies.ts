/**
 * reconciliation/merge-strategies.ts
 *
 * Registry and implementations of the four conflict merge strategies.
 * Pure functions — no side effects, no state, no telemetry.
 */

import type {
  StreamingConflict,
  ConflictResolutionStrategy,
  StreamingPathEvent,
} from "../contracts/aggregation.types.ts";

// ── Strategy result ────────────────────────────────────────────────────────────

export interface MergeStrategyResult {
  strategy:   ConflictResolutionStrategy;
  winnerId:   string;
  reason:     string;
  confidence: number;
}

// ── 1. Union ──────────────────────────────────────────────────────────────────

/**
 * Union: both sides contribute — no winner, additive merge.
 * Used when both paths write to non-overlapping regions of a file.
 */
export function unionMerge(
  conflict: StreamingConflict,
  _evA: StreamingPathEvent,
  _evB: StreamingPathEvent,
): MergeStrategyResult {
  return {
    strategy:   "union",
    winnerId:   conflict.ownerA, // primary owner; content merged additively
    reason:     "Union merge: both contributions accepted additively",
    confidence: 0.75,
  };
}

// ── 2. Precedence ─────────────────────────────────────────────────────────────

/**
 * Precedence: earlier-arrived path wins.
 * Deterministic: ties broken by pathId lexicographic order.
 */
export function precedenceMerge(
  conflict: StreamingConflict,
  evA:      StreamingPathEvent,
  evB:      StreamingPathEvent,
): MergeStrategyResult {
  const aWins =
    evA.arrivedAt < evB.arrivedAt ||
    (evA.arrivedAt === evB.arrivedAt && evA.pathId < evB.pathId);

  return {
    strategy:   "precedence",
    winnerId:   aWins ? conflict.ownerA : conflict.ownerB,
    reason:     `Precedence merge: ${aWins ? "ownerA" : "ownerB"} arrived first`,
    confidence: 0.80,
  };
}

// ── 3. Confidence ─────────────────────────────────────────────────────────────

/**
 * Confidence: higher-scoring path wins.
 * Deterministic: ties resolved by verification status, then arrivedAt.
 */
export function confidenceMerge(
  conflict: StreamingConflict,
  evA:      StreamingPathEvent,
  evB:      StreamingPathEvent,
): MergeStrategyResult {
  let aWins: boolean;

  if (evA.confidence !== evB.confidence) {
    aWins = evA.confidence > evB.confidence;
  } else if (evA.verificationPassed !== evB.verificationPassed) {
    aWins = evA.verificationPassed;
  } else {
    aWins = evA.arrivedAt <= evB.arrivedAt;
  }

  return {
    strategy:   "confidence",
    winnerId:   aWins ? conflict.ownerA : conflict.ownerB,
    reason:     `Confidence merge: winner confidence=${aWins ? evA.confidence : evB.confidence}`,
    confidence: Math.max(evA.confidence, evB.confidence),
  };
}

// ── 4. AST-Safe ───────────────────────────────────────────────────────────────

/**
 * AST-safe: prefer verified path, then confidence, then precedence.
 * Most conservative — blocks collapse if neither path is verified.
 */
export function astSafeMerge(
  conflict: StreamingConflict,
  evA:      StreamingPathEvent,
  evB:      StreamingPathEvent,
): MergeStrategyResult {
  const aVerified = evA.verificationPassed;
  const bVerified = evB.verificationPassed;

  if (aVerified && !bVerified) {
    return { strategy: "ast_safe", winnerId: conflict.ownerA, reason: "AST-safe: ownerA verified", confidence: evA.confidence };
  }
  if (!aVerified && bVerified) {
    return { strategy: "ast_safe", winnerId: conflict.ownerB, reason: "AST-safe: ownerB verified", confidence: evB.confidence };
  }
  // Both or neither verified — fall back to confidence
  return confidenceMerge(conflict, evA, evB);
}

// ── Strategy dispatcher ────────────────────────────────────────────────────────

export function applyStrategy(
  strategy: ConflictResolutionStrategy,
  conflict: StreamingConflict,
  evA:      StreamingPathEvent,
  evB:      StreamingPathEvent,
): MergeStrategyResult {
  switch (strategy) {
    case "union":      return unionMerge(conflict, evA, evB);
    case "precedence": return precedenceMerge(conflict, evA, evB);
    case "confidence": return confidenceMerge(conflict, evA, evB);
    case "ast_safe":   return astSafeMerge(conflict, evA, evB);
  }
}

// ── Strategy selector ─────────────────────────────────────────────────────────

/**
 * Auto-select the best strategy based on file type and context.
 */
export function selectStrategy(filePath: string): ConflictResolutionStrategy {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx") || filePath.endsWith(".js")) {
    return "ast_safe";
  }
  if (filePath.endsWith(".json") || filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
    return "confidence";
  }
  return "precedence";
}
