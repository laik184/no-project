/**
 * lifecycle/final-collapse-coordinator.ts
 *
 * Deterministic final collapse of a streaming aggregation session.
 * Checks the reconciliation barrier, validates state, and produces CollapseResult.
 * Single responsibility: collapse execution only.
 */

import type {
  CollapseResult,
  StreamingSessionId,
  StreamingSessionConfig,
  PartialAggregationState,
} from "../contracts/aggregation.types.ts";
import type { IFinalCollapseCoordinator } from "../contracts/aggregation.interfaces.ts";
import { partialBuffer }                  from "../buffers/partial-aggregation-buffer.ts";
import { isBarrierClear, lockBarrier, barrierSummary } from "../reconciliation/reconciliation-barrier.ts";
import { validateReplayDeterminism }       from "../checkpoints/replay-checkpoint.ts";
import { checkpointStore }                 from "../checkpoints/aggregation-checkpoint-store.ts";
import { startTimer, endTimer, recordCollapseLatency } from "../telemetry/streaming-metrics.ts";

// ── FinalCollapseCoordinator ──────────────────────────────────────────────────

export class FinalCollapseCoordinator implements IFinalCollapseCoordinator {

  isReady(sessionId: StreamingSessionId): boolean {
    const state = partialBuffer.getState(sessionId);
    if (!state) return false;
    if (!isBarrierClear(sessionId)) return false;
    return state.arrivedPaths >= state.totalPaths || state.topConfidence >= 0.92;
  }

  collapse(sessionId: StreamingSessionId, cfg: StreamingSessionConfig): CollapseResult {
    const timerKey = `collapse:${sessionId}`;
    startTimer(timerKey);

    const state = partialBuffer.getState(sessionId);
    if (!state) {
      throw new CollapseError(`No aggregation state for session ${sessionId}`);
    }

    // Lock the reconciliation barrier — no new conflicts after this point
    lockBarrier(sessionId);
    const barrier = barrierSummary(sessionId);

    if (!barrier.clear) {
      throw new CollapseError(
        `Cannot collapse — ${barrier.unresolved} unresolved conflict(s) in session ${sessionId}`,
      );
    }

    if (!state.topPathId) {
      throw new CollapseError(`No successful path found for session ${sessionId}`);
    }

    // Replay validation
    const { deterministic, replayValidated } = this._validateReplay(sessionId, state);

    const ms = endTimer(timerKey);
    recordCollapseLatency(ms, sessionId);

    const result: CollapseResult = {
      sessionId,
      runId:             state.runId,
      projectId:         state.projectId,
      winnerPathId:      state.topPathId,
      winnerConfidence:  state.topConfidence,
      totalPaths:        state.totalPaths,
      successPaths:      state.successPaths,
      failedPaths:       state.failedPaths,
      conflicts:         barrier.total,
      resolvedConflicts: barrier.resolved,
      mergedFiles:       [...state.mergedFiles],
      collapsedAt:       Date.now(),
      durationMs:        ms,
      deterministic,
      replayValidated,
    };

    return result;
  }

  private _validateReplay(
    sessionId: StreamingSessionId,
    state: PartialAggregationState,
  ): { deterministic: boolean; replayValidated: boolean } {
    const checkpoint = checkpointStore.load(sessionId);
    if (!checkpoint) return { deterministic: true, replayValidated: false };

    try {
      const extraEvents = state.eventLog.filter(
        ev => ev.arrivedAt > checkpoint.createdAt,
      );
      const { deterministic } = validateReplayDeterminism(checkpoint, extraEvents);
      return { deterministic, replayValidated: true };
    } catch {
      return { deterministic: false, replayValidated: false };
    }
  }
}

export const collapseCoordinator = new FinalCollapseCoordinator();

// ── CollapseError ─────────────────────────────────────────────────────────────

export class CollapseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollapseError";
  }
}
