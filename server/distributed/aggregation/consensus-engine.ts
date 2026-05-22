/**
 * Responsibility: Consensus engine — determines when parallel results agree sufficiently
 *                 and escalates irreconcilable conflicts to supervisor arbitration.
 * Dependencies: confidence-scorer, merge-strategy, result-collector
 * Failure: insufficient consensus triggers escalation; never silently accepts a bad merge.
 * Telemetry: emits distributed.consensus / distributed.conflict on every consensus decision.
 */

import { confidenceScorer }     from "./confidence-scorer.ts";
import { mergeStrategy, MergeStrategyName } from "./merge-strategy.ts";
import type { CollectedResult } from "./result-collector.ts";
import { bus }                  from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConsensusOutcome = "agreed" | "majority" | "conflict" | "escalated";

export interface ConsensusResult<T> {
  outcome:    ConsensusOutcome;
  data:       T | null;
  confidence: number;
  agreement:  number;  // 0.0–1.0 fraction of results that agree
  strategy:   MergeStrategyName;
}

// ── Config ────────────────────────────────────────────────────────────────────

const AGREEMENT_THRESHOLD = 0.6;  // 60% must agree for "majority"
const CONFIDENCE_FLOOR    = 0.5;  // below this → conflict

// ── Engine ────────────────────────────────────────────────────────────────────

class ConsensusEngine {
  async reach<T>(
    runId:     string,
    projectId: number,
    results:   CollectedResult<T>[],
    strategy:  MergeStrategyName = "consensus",
  ): Promise<ConsensusResult<T>> {
    const scored   = confidenceScorer.score(results);
    const avgConf  = confidenceScorer.averageConfidence(scored);
    const merged   = mergeStrategy.apply(results, strategy);

    const agreement = this.calculateAgreement(results);

    let outcome: ConsensusOutcome;
    if (!merged.merged || avgConf < CONFIDENCE_FLOOR) {
      outcome = "conflict";
    } else if (agreement >= 1.0) {
      outcome = "agreed";
    } else if (agreement >= AGREEMENT_THRESHOLD) {
      outcome = "majority";
    } else {
      outcome = "escalated";
    }

    const eventType = outcome === "conflict" || outcome === "escalated"
      ? "distributed.conflict"
      : "distributed.consensus";

    bus.emit("agent.event", {
      runId,
      projectId,
      phase:     "distributed.consensus",
      agentName: "consensus-engine",
      eventType,
      payload:   { outcome, confidence: avgConf, agreement, strategy, conflicts: merged.conflicts },
      ts:        Date.now(),
    });

    return {
      outcome,
      data:       merged.data,
      confidence: avgConf,
      agreement,
      strategy,
    };
  }

  private calculateAgreement<T>(results: CollectedResult<T>[]): number {
    const successful = results.filter(r => r.success);
    if (successful.length <= 1) return 1.0;

    // Compare JSON fingerprints
    const fingerprints = successful.map(r => JSON.stringify(r.data).slice(0, 200));
    const mostCommon   = this.mode(fingerprints);
    const count        = fingerprints.filter(f => f === mostCommon).length;
    return count / successful.length;
  }

  private mode(arr: string[]): string {
    const freq = new Map<string, number>();
    for (const v of arr) freq.set(v, (freq.get(v) ?? 0) + 1);
    return [...freq.entries()].reduce((a, b) => a[1] >= b[1] ? a : b)[0];
  }
}

export const consensusEngine = new ConsensusEngine();
