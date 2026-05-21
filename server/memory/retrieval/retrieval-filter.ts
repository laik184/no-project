/**
 * server/memory/retrieval/retrieval-filter.ts
 *
 * RetrievalFilter — excludes unsafe memory items from retrieval results.
 *
 * Filters applied (in order):
 *   1. Quarantine check      — never return contradicted items
 *   2. Status check          — skip expired/contradicted claims
 *   3. Freshness gate        — skip items past their TTL
 *   4. Confidence floor      — skip low-confidence claims if threshold set
 *   5. Namespace scope       — restrict to requested namespace
 *   6. Age ceiling           — skip items older than maxAge
 *
 * INVARIANT: A contradicted item NEVER exits this filter.
 */

import type { VerifiedFact, AgentClaim, RetrievalQuery } from "../contracts/types.ts";
import type { QuarantineStore } from "../contradiction/quarantine-store.ts";
import type { TTLPolicy } from "../expiration/ttl-policy.ts";
import type { Clock } from "../infrastructure/clock.ts";

export class RetrievalFilter {
  constructor(
    private readonly _quarantine: QuarantineStore,
    private readonly _ttl: TTLPolicy,
    private readonly _clock: Clock,
  ) {}

  filterFacts(facts: readonly VerifiedFact[], query: RetrievalQuery): readonly VerifiedFact[] {
    const now = this._clock.now();
    return facts.filter((f) => {
      if (this._quarantine.isQuarantined(f.id))  return false;
      if (f.invalidatedAt)                        return false;
      if (!query.includeExpired && this._ttl.isFactExpired(f, now)) return false;
      if (query.namespace && f.namespace !== query.namespace) return false;
      if (query.maxAge && now - f.verifiedAt > query.maxAge)  return false;
      if (query.keys && !query.keys.includes(f.key))          return false;
      return true;
    });
  }

  filterClaims(claims: readonly AgentClaim[], query: RetrievalQuery): readonly AgentClaim[] {
    const now = this._clock.now();
    const minConf = query.minConfidence ?? 0;

    return claims.filter((c) => {
      if (this._quarantine.isQuarantined(c.id))    return false;
      if (!query.includeContradicted && c.verificationStatus === "contradicted") return false;
      if (c.verificationStatus === "expired")       return false;
      if (!query.includeExpired && this._ttl.isClaimExpired(c, now)) return false;
      if (c.confidence < minConf)                   return false;
      if (query.namespace && c.namespace !== query.namespace) return false;
      if (query.maxAge && now - c.createdAt > query.maxAge)   return false;
      return true;
    });
  }
}
