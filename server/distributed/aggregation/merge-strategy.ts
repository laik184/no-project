/**
 * Responsibility: Defines and executes merge strategies for parallel agent outputs.
 *                 Supports: union, consensus, precedence, best-confidence.
 * Dependencies: confidence-scorer, result-collector
 * Failure: if merge fails, returns a "merge_failed" result with error message.
 * Telemetry: strategy used and outcome recorded in AggregatedResult.
 */

import { confidenceScorer }          from "./confidence-scorer.ts";
import type { CollectedResult }      from "./result-collector.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MergeStrategyName =
  | "union"           // combine all non-conflicting successful outputs
  | "consensus"       // majority vote weighted by confidence
  | "precedence"      // first successful result wins
  | "best_confidence" // highest confidence score wins
  | "last_write";     // last received successful result wins

export interface MergeResult<T> {
  strategy:    MergeStrategyName;
  data:        T | null;
  confidence:  number;
  sourceCount: number;
  conflicts:   number;
  merged:      boolean;
}

// ── Strategy ──────────────────────────────────────────────────────────────────

class MergeStrategy {
  apply<T>(
    results:  CollectedResult<T>[],
    strategy: MergeStrategyName = "best_confidence",
  ): MergeResult<T> {
    const successful = results.filter(r => r.success && r.data !== undefined);

    if (successful.length === 0) {
      return { strategy, data: null, confidence: 0, sourceCount: results.length, conflicts: 0, merged: false };
    }

    switch (strategy) {
      case "precedence":
        return this.precedence(successful, strategy, results.length);

      case "last_write":
        return this.lastWrite(successful, strategy, results.length);

      case "best_confidence":
        return this.bestConfidence(successful, strategy, results.length);

      case "consensus":
        return this.consensus(successful, strategy, results.length);

      case "union":
        return this.union(successful, strategy, results.length);
    }
  }

  private precedence<T>(s: CollectedResult<T>[], strategy: MergeStrategyName, total: number): MergeResult<T> {
    const first = s[0];
    return { strategy, data: first.data!, confidence: 0.7, sourceCount: total, conflicts: s.length - 1, merged: true };
  }

  private lastWrite<T>(s: CollectedResult<T>[], strategy: MergeStrategyName, total: number): MergeResult<T> {
    const last = s.reduce((a, b) => a.receivedAt >= b.receivedAt ? a : b);
    return { strategy, data: last.data!, confidence: 0.6, sourceCount: total, conflicts: s.length - 1, merged: true };
  }

  private bestConfidence<T>(s: CollectedResult<T>[], strategy: MergeStrategyName, total: number): MergeResult<T> {
    const scored = confidenceScorer.score(s);
    const best   = confidenceScorer.best(scored);
    if (!best) return { strategy, data: null, confidence: 0, sourceCount: total, conflicts: 0, merged: false };
    return { strategy, data: best.result.data!, confidence: best.confidence, sourceCount: total, conflicts: s.length - 1, merged: true };
  }

  private consensus<T>(s: CollectedResult<T>[], strategy: MergeStrategyName, total: number): MergeResult<T> {
    // Group by JSON fingerprint and pick most common
    const groups = new Map<string, { count: number; data: T; confidence: number }>();
    const scored = confidenceScorer.score(s);

    for (const sc of scored) {
      if (!sc.result.success) continue;
      const key = JSON.stringify(sc.result.data).slice(0, 200);
      const existing = groups.get(key);
      if (existing) {
        existing.count      += 1;
        existing.confidence += sc.confidence;
      } else {
        groups.set(key, { count: 1, data: sc.result.data!, confidence: sc.confidence });
      }
    }

    const winner = [...groups.values()].reduce((a, b) =>
      a.count > b.count || (a.count === b.count && a.confidence > b.confidence) ? a : b,
    );

    return {
      strategy,
      data:        winner.data,
      confidence:  winner.confidence / winner.count,
      sourceCount: total,
      conflicts:   groups.size - 1,
      merged:      true,
    };
  }

  private union<T>(s: CollectedResult<T>[], strategy: MergeStrategyName, total: number): MergeResult<T> {
    // Union only works on arrays or objects; falls back to best_confidence
    const first = s[0].data;
    if (Array.isArray(first)) {
      const merged = [...new Set(s.flatMap(r => r.data as unknown[]))] as unknown as T;
      return { strategy, data: merged, confidence: 0.8, sourceCount: total, conflicts: 0, merged: true };
    }
    return this.bestConfidence(s, strategy, total);
  }
}

export const mergeStrategy = new MergeStrategy();
