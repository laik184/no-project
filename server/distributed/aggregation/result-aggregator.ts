/**
 * Responsibility: Top-level result aggregator — orchestrates collection, scoring,
 *                 merging, and consensus for all parallel worker outputs.
 * Dependencies: result-collector, confidence-scorer, merge-strategy, consensus-engine
 * Failure: collection timeout → partial merge with "conflict" outcome; fail-closed gate blocks.
 * Telemetry: emits distributed.collapse on final aggregation; distributed.conflict on escalation.
 */

import { resultCollector, CollectedResult } from "./result-collector.ts";
import { consensusEngine, ConsensusResult } from "./consensus-engine.ts";
import { mergeStrategy, MergeStrategyName } from "./merge-strategy.ts";
import { bus }                              from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AggregationSession {
  runId:      string;
  projectId:  number;
  expected:   number;
  strategy:   MergeStrategyName;
  timeoutMs:  number;
}

export interface AggregatedResult<T = unknown> {
  runId:      string;
  outcome:    ConsensusResult<T>["outcome"];
  data:       T | null;
  confidence: number;
  agreement:  number;
  collected:  number;
  expected:   number;
  durationMs: number;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

class ResultAggregator {
  /**
   * Open an aggregation session for `expected` parallel results.
   * Returns a promise that resolves when all results arrive (or timeout).
   */
  async aggregate<T>(session: AggregationSession): Promise<AggregatedResult<T>> {
    const t0 = Date.now();

    bus.emit("agent.event", {
      runId:     session.runId,
      projectId: session.projectId,
      phase:     "distributed.aggregation",
      agentName: "result-aggregator",
      eventType: "agent.parallel.started",
      payload:   { expected: session.expected, strategy: session.strategy },
      ts:        t0,
    });

    let raw: CollectedResult<T>[];
    try {
      raw = await resultCollector.open<T>(session.runId, session.expected, session.timeoutMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        runId:      session.runId,
        outcome:    "conflict",
        data:       null,
        confidence: 0,
        agreement:  0,
        collected:  0,
        expected:   session.expected,
        durationMs: Date.now() - t0,
      };
    }

    const consensus = await consensusEngine.reach<T>(
      session.runId,
      session.projectId,
      raw,
      session.strategy,
    );

    const durationMs = Date.now() - t0;

    bus.emit("agent.event", {
      runId:     session.runId,
      projectId: session.projectId,
      phase:     "distributed.aggregation",
      agentName: "result-aggregator",
      eventType: "distributed.collapse",
      payload:   { outcome: consensus.outcome, confidence: consensus.confidence, collected: raw.length, durationMs },
      ts:        Date.now(),
    });

    return {
      runId:      session.runId,
      outcome:    consensus.outcome,
      data:       consensus.data,
      confidence: consensus.confidence,
      agreement:  consensus.agreement,
      collected:  raw.length,
      expected:   session.expected,
      durationMs,
    };
  }

  /** Submit one worker result into the active aggregation session. */
  submit<T>(runId: string, result: Omit<CollectedResult<T>, "receivedAt">): void {
    resultCollector.submit(runId, result);
  }

  /** Cancel an in-flight aggregation session. */
  cancel(runId: string, reason?: string): void {
    resultCollector.cancel(runId, reason);
  }
}

export const resultAggregator = new ResultAggregator();
