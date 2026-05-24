/**
 * checkpoints/replay-checkpoint.ts
 *
 * Rebuilds PartialAggregationState from a checkpoint + event log.
 * Guarantees deterministic replay — same events always produce same state.
 * Single responsibility: replay execution only.
 */

import type {
  AggregationCheckpoint,
  StreamingPathEvent,
  PartialAggregationState,
  StreamingSessionId,
} from "../contracts/aggregation.types.ts";
import { incrementalReducer } from "../reducers/incremental-reducer.ts";

// ── Replay status ─────────────────────────────────────────────────────────────

export type ReplayStatus = "idle" | "replaying" | "done" | "failed";

interface ReplayRecord {
  status:     ReplayStatus;
  startedAt:  number;
  finishedAt?: number;
  eventsReplayed: number;
  error?:     string;
}

const _records = new Map<StreamingSessionId, ReplayRecord>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Replay events from a checkpoint to rebuild partial state.
 * Only replays events that arrived AFTER the checkpoint was created.
 */
export function replayFromCheckpoint(
  checkpoint: AggregationCheckpoint,
  extraEvents: StreamingPathEvent[],
): PartialAggregationState {
  const { sessionId } = checkpoint;
  _records.set(sessionId, { status: "replaying", startedAt: Date.now(), eventsReplayed: 0 });

  try {
    // Start from checkpoint state (already reduced up to checkpoint)
    let state: PartialAggregationState = JSON.parse(
      JSON.stringify(checkpoint.state),
    ) as PartialAggregationState;

    // Sort extra events deterministically by arrivedAt then pathId
    const sorted = [...extraEvents].sort((a, b) =>
      a.arrivedAt !== b.arrivedAt
        ? a.arrivedAt - b.arrivedAt
        : a.pathId.localeCompare(b.pathId),
    );

    let replayed = 0;
    for (const ev of sorted) {
      // Skip events already in checkpoint's log
      if (state.eventLog.some(e => e.pathId === ev.pathId)) continue;
      state = incrementalReducer.reduce(state, ev);
      replayed++;
    }

    const record = _records.get(sessionId)!;
    record.status        = "done";
    record.finishedAt    = Date.now();
    record.eventsReplayed = replayed;

    return state;

  } catch (err) {
    const record = _records.get(sessionId);
    if (record) {
      record.status = "failed";
      record.finishedAt = Date.now();
      record.error  = String(err);
    }
    throw err;
  }
}

/**
 * Validate that replaying from a checkpoint produces the expected state.
 * Determinism check: run twice, compare arrivedPaths + topPathId.
 */
export function validateReplayDeterminism(
  checkpoint: AggregationCheckpoint,
  events:     StreamingPathEvent[],
): { deterministic: boolean; detail: string } {
  const run1 = replayFromCheckpoint(checkpoint, events);
  const run2 = replayFromCheckpoint(checkpoint, events);

  const match =
    run1.arrivedPaths  === run2.arrivedPaths  &&
    run1.topPathId     === run2.topPathId     &&
    run1.topConfidence === run2.topConfidence;

  return {
    deterministic: match,
    detail: match
      ? `Deterministic — arrivedPaths=${run1.arrivedPaths} topPathId=${run1.topPathId}`
      : `NON-DETERMINISTIC: run1.arrivedPaths=${run1.arrivedPaths} run2.arrivedPaths=${run2.arrivedPaths}`,
  };
}

export function getReplayStatus(sessionId: StreamingSessionId): ReplayStatus {
  return _records.get(sessionId)?.status ?? "idle";
}

export function getReplayRecord(sessionId: StreamingSessionId): ReplayRecord | undefined {
  return _records.get(sessionId);
}

export function clearReplayRecord(sessionId: StreamingSessionId): void {
  _records.delete(sessionId);
}
