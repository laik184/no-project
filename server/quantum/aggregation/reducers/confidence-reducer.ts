/**
 * reducers/confidence-reducer.ts
 *
 * Single responsibility: compute the top confidence path
 * from a set of streaming path events.
 * Deterministic and side-effect free.
 */

import type { StreamingPathEvent } from "../contracts/aggregation.types.ts";
import type { IConfidenceReducer } from "../contracts/aggregation.interfaces.ts";

// ── Scoring weights (mirrors confidence-scorer.ts for the streaming layer) ────

const W = {
  verificationPass: 0.35,
  successOutcome:   0.25,
  lowRetries:       0.15,
  confidence:       0.25,  // trust the path's own reported confidence
} as const;

// ── Score one event ───────────────────────────────────────────────────────────

function scoreEvent(event: StreamingPathEvent): number {
  const verFactor  = event.verificationPassed ? 1.0 : 0.0;
  const succFactor = event.success            ? 1.0 : 0.0;
  const retryFactor = Math.max(0, 1 - event.retries * 0.10);
  const confFactor  = Math.min(1, Math.max(0, event.confidence));

  return (
    verFactor   * W.verificationPass +
    succFactor  * W.successOutcome   +
    retryFactor * W.lowRetries       +
    confFactor  * W.confidence
  );
}

// ── ConfidenceReducer implementation ─────────────────────────────────────────

export class ConfidenceReducer implements IConfidenceReducer {
  /**
   * Score all events and return the top-scoring path.
   * Deterministic: ties broken by earliest arrivedAt.
   */
  score(events: StreamingPathEvent[]): { topPathId: string; topConfidence: number } {
    if (events.length === 0) return { topPathId: "", topConfidence: 0 };

    let topPathId      = "";
    let topScore       = -1;
    let topArrivedAt   = Infinity;

    for (const ev of events) {
      if (!ev.success) continue;
      const score = scoreEvent(ev);
      if (
        score > topScore ||
        (score === topScore && ev.arrivedAt < topArrivedAt)
      ) {
        topScore     = score;
        topPathId    = ev.pathId;
        topArrivedAt = ev.arrivedAt;
      }
    }

    return { topPathId, topConfidence: Math.max(0, topScore) };
  }
}

export const confidenceReducer = new ConfidenceReducer();
