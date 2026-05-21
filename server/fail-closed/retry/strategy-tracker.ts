/**
 * server/fail-closed/retry/strategy-tracker.ts
 *
 * StrategyTracker — prevents the retry engine from running the same strategy twice.
 *
 * Problems solved:
 *   1. Blind repetitive retries (same action, same failure, infinite loop)
 *   2. Semantic similarity — different-named strategies with identical semantics
 *   3. Strategy exhaustion — when all divergent strategies are spent
 *
 * INVARIANT: A blacklisted strategy NEVER runs again in the same run.
 * INVARIANT: Two strategies with cosine similarity > threshold are treated as duplicates.
 */

import type { RetryStrategy } from "../contracts/types.ts";

const SIMILARITY_THRESHOLD = 0.75;

export type StrategyRecord = {
  readonly strategy: RetryStrategy;
  readonly attemptedAt: number;
  readonly outcome: "failed" | "blacklisted";
};

export class StrategyTracker {
  private readonly _attempted  = new Map<string, StrategyRecord>();
  private readonly _blacklist  = new Set<string>();

  record(strategy: RetryStrategy, outcome: "failed" | "blacklisted"): void {
    this._attempted.set(strategy.id, Object.freeze({
      strategy,
      attemptedAt: Date.now(),
      outcome,
    }));
    if (outcome === "blacklisted") {
      this._blacklist.add(strategy.id);
    }
  }

  isBlacklisted(strategyId: string): boolean {
    return this._blacklist.has(strategyId);
  }

  /**
   * Returns true if a candidate strategy is too similar to one already tried.
   * Uses normalized token overlap (Jaccard similarity over semantic vectors).
   */
  isTooSimilar(candidate: RetryStrategy): boolean {
    for (const { strategy: tried } of this._attempted.values()) {
      if (this._jaccardSimilarity(candidate.semanticVector, tried.semanticVector) >= SIMILARITY_THRESHOLD) {
        return true;
      }
    }
    return false;
  }

  /** Filters a list of candidates to only viable (unseen, sufficiently different) ones. */
  filterViable(candidates: readonly RetryStrategy[]): readonly RetryStrategy[] {
    return candidates.filter(
      (c) => !this.isBlacklisted(c.id) && !this.isTooSimilar(c)
    );
  }

  attemptCount(): number { return this._attempted.size; }
  blacklistCount(): number { return this._blacklist.size; }

  listAttempted(): readonly StrategyRecord[] {
    return Object.freeze([...this._attempted.values()]);
  }

  private _jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
    if (a.length === 0 && b.length === 0) return 1;
    const setA = new Set(a.map((s) => s.toLowerCase()));
    const setB = new Set(b.map((s) => s.toLowerCase()));
    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
