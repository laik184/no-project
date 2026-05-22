/**
 * Responsibility: Score result confidence for use in consensus merge decisions.
 *                 Weights speed, success, data completeness, and worker reliability.
 * Dependencies: none — pure scoring functions.
 * Failure: all scoring functions return 0.0 on invalid input; never throws.
 * Telemetry: scores are embedded in AggregatedResult for distributed-trace consumption.
 */

import type { CollectedResult } from "./result-collector.ts";

// ── Weights ───────────────────────────────────────────────────────────────────

const W_SUCCESS     = 0.50;  // most important: did it succeed?
const W_SPEED       = 0.20;  // faster is better within same priority
const W_COMPLETENESS = 0.20; // data richness
const W_RETRY_FREE  = 0.10;  // penalize results from retried workers

// ── Scorer ────────────────────────────────────────────────────────────────────

export interface ScoredResult<T> {
  result:     CollectedResult<T>;
  confidence: number;   // 0.0 – 1.0
  breakdown:  { success: number; speed: number; completeness: number; retryFree: number };
}

class ConfidenceScorer {
  score<T>(results: CollectedResult<T>[]): ScoredResult<T>[] {
    if (results.length === 0) return [];

    const successOnly = results.filter(r => r.success);
    const maxDur      = Math.max(...results.map(r => r.durationMs), 1);

    return results.map(r => {
      const success      = r.success ? 1.0 : 0.0;
      const speed        = r.success ? 1 - r.durationMs / maxDur : 0;
      const completeness = this.measureCompleteness(r.data);
      const retryFree    = 1.0; // extended with attempt count when available

      const confidence =
        W_SUCCESS * success +
        W_SPEED   * speed   +
        W_COMPLETENESS * completeness +
        W_RETRY_FREE   * retryFree;

      return {
        result:     r,
        confidence: Math.max(0, Math.min(1, confidence)),
        breakdown:  { success, speed, completeness, retryFree },
      };
    });
  }

  /** Pick the highest-confidence successful result. */
  best<T>(scored: ScoredResult<T>[]): ScoredResult<T> | null {
    const successful = scored.filter(s => s.result.success);
    if (successful.length === 0) return null;
    return successful.reduce((a, b) => a.confidence >= b.confidence ? a : b);
  }

  /** Weighted average confidence across all results. */
  averageConfidence<T>(scored: ScoredResult<T>[]): number {
    if (scored.length === 0) return 0;
    return scored.reduce((sum, s) => sum + s.confidence, 0) / scored.length;
  }

  private measureCompleteness(data: unknown): number {
    if (data === null || data === undefined) return 0;
    if (typeof data === "string") return Math.min(1, data.length / 100);
    if (Array.isArray(data))     return Math.min(1, data.length / 10);
    if (typeof data === "object") {
      const keys = Object.keys(data as object).length;
      return Math.min(1, keys / 5);
    }
    return 0.5;
  }
}

export const confidenceScorer = new ConfidenceScorer();
