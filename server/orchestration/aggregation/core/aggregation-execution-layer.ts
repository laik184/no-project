/**
 * aggregation-execution-layer.ts
 *
 * Responsibility: Orchestration-level aggregation session coordinator.
 *                 Provides the missing glue between the three independent
 *                 aggregation layers (distributed/quantum/coordination) and
 *                 the orchestration lifecycle phases (execute/verify/reflect).
 *
 * Architecture:
 *   This layer does NOT replace existing aggregators — it wraps them with a
 *   unified lifecycle: openSession → submit (×N) → closeSession.
 *   Each execution phase opens its own session. Results from the session are
 *   returned as AggregatedResult for orchestration to act on.
 *
 * Dependencies: result-aggregator (Layer A), bus, redis-aggregation-checkpoint-store
 * Failure: timeout → fail-closed "conflict" outcome, never throws to caller.
 * Telemetry: emits aggregation.started / aggregation.partial / aggregation.completed / aggregation.failed
 * Size: kept under 250 lines — if extended, split into session-manager.ts + submission-manager.ts.
 */

import { resultAggregator }               from "../../../distributed/aggregation/result-aggregator.ts";
import type { AggregatedResult }           from "../../../distributed/aggregation/result-aggregator.ts";
import type { MergeStrategyName }          from "../../../distributed/aggregation/merge-strategy.ts";
import { bus }                             from "../../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AggregationMode = "dag" | "swarm" | "verify" | "reflect" | "tool-loop";

export interface AggregationSessionHandle {
  sessionId: string;
  runId:     string;
  projectId: number;
  mode:      AggregationMode;
  expected:  number;
  openedAt:  number;
}

export interface SubmitPayload<T = unknown> {
  workerId:   string;
  taskId:     string;
  success:    boolean;
  data?:      T;
  error?:     string;
  durationMs: number;
}

// ── Telemetry helpers ─────────────────────────────────────────────────────────

function _emit(
  runId:     string,
  projectId: number,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "orchestration.aggregation",
    agentName: "aggregation-execution-layer",
    eventType: eventType as any,
    payload,
    ts: Date.now(),
  });
}

// ── Active session registry ───────────────────────────────────────────────────

const _activeSessions = new Map<string, AggregationSessionHandle & { submitted: number }>();

// ── AggregationExecutionLayer ─────────────────────────────────────────────────

class AggregationExecutionLayer {
  /**
   * Open an aggregation session for a given orchestration phase.
   * Returns a handle that callers use to submit results.
   *
   * Internally opens a resultAggregator session (Layer A) for data-level
   * consensus. The returned promise resolves when all `expected` results
   * are submitted or `timeoutMs` elapses.
   */
  openSession(opts: {
    runId:     string;
    projectId: number;
    mode:      AggregationMode;
    expected:  number;
    strategy?: MergeStrategyName;
    timeoutMs?: number;
  }): { handle: AggregationSessionHandle; result: Promise<AggregatedResult> } {
    const {
      runId, projectId, mode,
      expected,
      strategy  = "best_confidence",
      timeoutMs = 120_000,
    } = opts;

    const sessionId = `agg-${mode}-${runId}-${Date.now()}`;

    const handle: AggregationSessionHandle & { submitted: number } = {
      sessionId, runId, projectId, mode, expected, openedAt: Date.now(), submitted: 0,
    };

    _activeSessions.set(runId, handle);

    _emit(runId, projectId, "aggregation.started", {
      sessionId, mode, expected, strategy,
    });

    // Delegate to Layer A (resultAggregator) for data-level consensus.
    const result = resultAggregator.aggregate<unknown>({
      runId, projectId, expected, strategy, timeoutMs,
    }).then(res => {
      _activeSessions.delete(runId);
      if (res.outcome === "conflict" || res.outcome === "escalated") {
        _emit(runId, projectId, "aggregation.failed", {
          sessionId, mode, outcome: res.outcome,
          collected: res.collected, expected: res.expected,
          durationMs: res.durationMs,
        });
      } else {
        _emit(runId, projectId, "aggregation.completed", {
          sessionId, mode, outcome: res.outcome,
          confidence: res.confidence, agreement: res.agreement,
          collected: res.collected, expected: res.expected,
          durationMs: res.durationMs,
        });
      }
      return res;
    }).catch(err => {
      _activeSessions.delete(runId);
      _emit(runId, projectId, "aggregation.failed", {
        sessionId, mode, error: (err as Error).message,
      });
      // Return a sentinel "conflict" result — never propagate error to orchestration.
      return {
        runId, outcome: "conflict" as const,
        data: null, confidence: 0, agreement: 0,
        collected: 0, expected, durationMs: Date.now() - handle.openedAt,
      } satisfies AggregatedResult;
    });

    return { handle, result };
  }

  /**
   * Submit one worker result into an active aggregation session.
   * Emits aggregation.partial with current collection progress.
   */
  submit<T>(runId: string, payload: SubmitPayload<T>): void {
    const session = _activeSessions.get(runId);

    resultAggregator.submit<T>(runId, payload);

    if (session) {
      session.submitted++;
      const progress = session.expected > 0
        ? Math.round((session.submitted / session.expected) * 100)
        : 0;

      _emit(runId, session.projectId, "aggregation.partial", {
        sessionId: session.sessionId,
        mode:      session.mode,
        received:  session.submitted,
        expected:  session.expected,
        progress,
        taskId:    payload.taskId,
        success:   payload.success,
      });
    }
  }

  /**
   * Cancel an active aggregation session (e.g. run aborted).
   */
  cancel(runId: string, reason?: string): void {
    const session = _activeSessions.get(runId);
    resultAggregator.cancel(runId, reason);
    _activeSessions.delete(runId);

    if (session) {
      _emit(runId, session.projectId, "aggregation.failed", {
        sessionId: session.sessionId,
        mode:      session.mode,
        reason:    reason ?? "cancelled",
      });
    }
  }

  /** Active session count (for health/metrics). */
  activeSessions(): number {
    return _activeSessions.size;
  }
}

export const aggregationExecutionLayer = new AggregationExecutionLayer();
