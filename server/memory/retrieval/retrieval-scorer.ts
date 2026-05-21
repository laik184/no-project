/**
 * server/memory/retrieval/retrieval-scorer.ts
 *
 * RetrievalScorer — assigns deterministic relevance scores to memory items.
 *
 * Scoring model:
 *   Facts:  score = freshness                 (confidence always 1.0)
 *   Claims: score = freshness × confidence    (lower trust → lower score)
 *
 * Scores are normalized [0, 1]. Higher = more relevant for context injection.
 */

import type { VerifiedFact, AgentClaim, ScoredFact, ScoredClaim } from "../contracts/types.ts";
import type { FreshnessScorer } from "../expiration/freshness-scorer.ts";

export class RetrievalScorer {
  constructor(private readonly _freshness: FreshnessScorer) {}

  scoreFacts(facts: readonly VerifiedFact[]): readonly ScoredFact[] {
    return facts
      .map((item) => ({
        item,
        score: this._freshness.scoreFact(item),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  scoreClaims(claims: readonly AgentClaim[]): readonly ScoredClaim[] {
    return claims
      .map((item) => ({
        item,
        score: this._freshness.scoreWeighted(
          this._freshness.scoreClaim(item),
          item.confidence,
        ),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Re-ranks scored facts to prefer key-specific matches when keys are provided.
   * Key-matched facts get a 20% boost.
   */
  boostKeyMatches(scored: readonly ScoredFact[], keys?: readonly string[]): readonly ScoredFact[] {
    if (!keys || keys.length === 0) return scored;
    const keySet = new Set(keys);
    return [...scored]
      .map((s) => ({
        ...s,
        score: keySet.has(s.item.key) ? Math.min(1, s.score * 1.2) : s.score,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
