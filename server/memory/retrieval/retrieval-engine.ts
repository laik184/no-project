/**
 * server/memory/retrieval/retrieval-engine.ts
 *
 * RetrievalEngine — deterministic, scoped, scored retrieval over both stores.
 *
 * Retrieval contract:
 *   - NEVER returns quarantined items
 *   - NEVER returns contradicted claims (unless explicitly requested)
 *   - NEVER returns expired items (unless explicitly requested)
 *   - Facts always ranked before claims
 *   - Results deterministic for same query + same store state
 *   - Respects namespace isolation
 */

import type { RetrievalQuery, RetrievalResult } from "../contracts/types.ts";
import type { FactStore } from "../facts/fact-store.ts";
import type { ClaimStore } from "../claims/claim-store.ts";
import type { FactIndex } from "../facts/fact-index.ts";
import type { ClaimIndex } from "../claims/claim-index.ts";
import type { RetrievalFilter } from "./retrieval-filter.ts";
import type { RetrievalScorer } from "./retrieval-scorer.ts";
import type { Clock } from "../infrastructure/clock.ts";

const DEFAULT_LIMIT = 50;

export class RetrievalEngine {
  constructor(
    private readonly _facts:        FactStore,
    private readonly _claims:       ClaimStore,
    private readonly _factIndex:    FactIndex,
    private readonly _claimIndex:   ClaimIndex,
    private readonly _filter:       RetrievalFilter,
    private readonly _scorer:       RetrievalScorer,
    private readonly _clock:        Clock,
  ) {}

  retrieve(query: RetrievalQuery): RetrievalResult {
    const limit = query.limit ?? DEFAULT_LIMIT;

    // ── Facts ─────────────────────────────────────────────────────────────────
    const allFacts = query.namespace
      ? this._facts.listNamespace(query.namespace)
      : this._facts.listAll();

    const filteredFacts = this._filter.filterFacts(allFacts, query);
    const scoredFacts = this._scorer.scoreFacts(filteredFacts);
    const boostedFacts = this._scorer.boostKeyMatches(scoredFacts, query.keys);
    const topFacts = boostedFacts.slice(0, Math.ceil(limit * 0.7)); // 70% budget for facts

    // ── Claims ────────────────────────────────────────────────────────────────
    const allClaims = query.namespace
      ? this._claims.listNamespace(query.namespace)
      : this._claims.listAll();

    const filteredClaims = this._filter.filterClaims(allClaims, query);
    const scoredClaims = this._scorer.scoreClaims(filteredClaims);
    const topClaims = scoredClaims.slice(0, limit - topFacts.length);

    return Object.freeze({
      facts:        Object.freeze(topFacts),
      claims:       Object.freeze(topClaims),
      totalFacts:   filteredFacts.length,
      totalClaims:  filteredClaims.length,
      retrievedAt:  this._clock.now(),
    });
  }

  /**
   * Retrieves only verified facts for a specific key set.
   * Used by context builder for targeted fact injection.
   */
  retrieveFactsByKeys(keys: readonly string[], namespace: string): RetrievalResult {
    return this.retrieve({ keys, namespace, limit: keys.length * 2 });
  }

  /**
   * Retrieves the top unverified claims for a namespace.
   * Used by context builder for [CLAIM — UNVERIFIED] injection.
   */
  retrieveTopClaims(namespace: string, limit = 10): RetrievalResult {
    return this.retrieve({ namespace, limit, minConfidence: 0.3 });
  }

  /**
   * Returns a summary of the current retrieval state for a namespace.
   */
  namespaceSummary(namespace: string): {
    totalFacts: number;
    totalClaims: number;
    activeClaims: number;
  } {
    return {
      totalFacts:   this._facts.listNamespace(namespace).length,
      totalClaims:  this._claims.listNamespace(namespace).length,
      activeClaims: this._claims.listByStatus("unverified", namespace).length,
    };
  }
}
