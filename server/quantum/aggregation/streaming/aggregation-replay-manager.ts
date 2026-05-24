/**
 * streaming/aggregation-replay-manager.ts
 *
 * Manages replay of interrupted streaming sessions from the last checkpoint.
 * Coordinates with checkpoint store and replay-checkpoint module.
 * Single responsibility: replay orchestration only.
 */

import type {
  AggregationCheckpoint,
  PartialAggregationState,
  StreamingSessionId,
} from "../contracts/aggregation.types.ts";
import type { IAggregationReplayManager } from "../contracts/aggregation.interfaces.ts";
import { checkpointStore }               from "../checkpoints/aggregation-checkpoint-store.ts";
import {
  replayFromCheckpoint,
  validateReplayDeterminism,
  getReplayStatus,
  type ReplayStatus,
} from "../checkpoints/replay-checkpoint.ts";
import {
  emitAggregationRetry,
  emitAggregationRollback,
} from "../telemetry/aggregation-telemetry.ts";
import { startTimer, endTimer, recordReplayLatency } from "../telemetry/streaming-metrics.ts";
import { partialBuffer }                 from "../buffers/partial-aggregation-buffer.ts";

// ── Replay context ────────────────────────────────────────────────────────────

interface ReplayContext {
  sessionId:   StreamingSessionId;
  runId:       string;
  projectId:   number;
  attempt:     number;
}

// ── AggregationReplayManager ──────────────────────────────────────────────────

export class AggregationReplayManager implements IAggregationReplayManager {
  private readonly _contexts = new Map<StreamingSessionId, ReplayContext>();

  registerContext(
    sessionId: StreamingSessionId,
    runId:     string,
    projectId: number,
  ): void {
    this._contexts.set(sessionId, { sessionId, runId, projectId, attempt: 0 });
  }

  async startReplay(
    sessionId:  StreamingSessionId,
    checkpoint: AggregationCheckpoint,
  ): Promise<PartialAggregationState> {
    const ctx = this._contexts.get(sessionId);
    if (!ctx) throw new Error(`[replay-manager] No context for session ${sessionId}`);

    ctx.attempt++;
    const timerKey = `replay:${sessionId}:${ctx.attempt}`;
    startTimer(timerKey);

    emitAggregationRetry(
      sessionId, ctx.runId, ctx.projectId,
      ctx.attempt, "Replay from checkpoint", "replaying",
    );

    try {
      // Extra events = anything currently in the buffer's event log that post-dates checkpoint
      const currentState = partialBuffer.getState(sessionId);
      const extraEvents = (currentState?.eventLog ?? []).filter(
        ev => ev.arrivedAt > checkpoint.createdAt,
      );

      // Validate determinism on first replay attempt only
      if (ctx.attempt === 1) {
        const { deterministic, detail } = validateReplayDeterminism(checkpoint, extraEvents);
        if (!deterministic) {
          throw new Error(`Non-deterministic replay: ${detail}`);
        }
      }

      const rebuilt = replayFromCheckpoint(checkpoint, extraEvents);
      const ms      = endTimer(timerKey);
      recordReplayLatency(ms);

      emitAggregationRollback(
        sessionId, ctx.runId, ctx.projectId,
        checkpoint.id, `Replay complete — ${extraEvents.length} events re-applied`,
      );

      return rebuilt;

    } catch (err) {
      endTimer(timerKey);
      throw err;
    }
  }

  getStatus(sessionId: StreamingSessionId): ReplayStatus {
    return getReplayStatus(sessionId);
  }

  findBestCheckpoint(sessionId: StreamingSessionId): AggregationCheckpoint | undefined {
    return checkpointStore.load(sessionId);
  }

  canReplay(sessionId: StreamingSessionId): boolean {
    return checkpointStore.hasReplayable(sessionId);
  }
}

export const replayManager = new AggregationReplayManager();
