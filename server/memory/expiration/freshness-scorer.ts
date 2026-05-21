/**
 * server/memory/expiration/freshness-scorer.ts
 *
 * FreshnessScorer — computes normalized [0,1] freshness scores for memory items.
 * Used by the RetrievalScorer to rank results by recency.
 * No storage. No state. Pure calculation.
 */

import type { VerifiedFact, AgentClaim } from "../contracts/types.ts";
import type { Clock } from "../infrastructure/clock.ts";
import type { TTLPolicy } from "./ttl-policy.ts";

export class FreshnessScorer {
  constructor(
    private readonly _clock: Clock,
    private readonly _ttl: TTLPolicy,
  ) {}

  scoreFact(fact: VerifiedFact): number {
    if (fact.invalidatedAt) return 0;
    const now = this._clock.now();
    if (this._ttl.isFactExpired(fact, now)) return 0;
    return this._ttl.freshnessRatio(fact.verifiedAt, fact.expiresAt, now);
  }

  scoreClaim(claim: AgentClaim): number {
    if (claim.verificationStatus !== "unverified") return 0;
    const now = this._clock.now();
    if (this._ttl.isClaimExpired(claim, now)) return 0;
    return this._ttl.freshnessRatio(claim.createdAt, claim.expiresAt, now);
  }

  /**
   * Combined score: freshness × confidence.
   * Facts always have confidence=1, so their score is pure freshness.
   */
  scoreWeighted(freshness: number, confidence: number): number {
    return freshness * confidence;
  }

  isFactFresh(fact: VerifiedFact): boolean {
    return this.scoreFact(fact) > 0;
  }

  isClaimFresh(claim: AgentClaim): boolean {
    return this.scoreClaim(claim) > 0;
  }
}
