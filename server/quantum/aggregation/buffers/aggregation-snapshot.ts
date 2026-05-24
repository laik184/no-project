/**
 * buffers/aggregation-snapshot.ts
 *
 * Point-in-time snapshot of PartialAggregationState.
 * Snapshots are immutable copies — safe to pass across module boundaries.
 * Used by: checkpoints, replay manager, health monitor.
 */

import type {
  PartialAggregationState,
  StreamingSessionId,
} from "../contracts/aggregation.types.ts";

// ── Snapshot record ───────────────────────────────────────────────────────────

export interface AggregationSnapshot {
  id:          string;
  sessionId:   StreamingSessionId;
  state:       PartialAggregationState;
  capturedAt:  number;
  arrivedPaths: number;
}

// ── Snapshot store ────────────────────────────────────────────────────────────

const _snapshots = new Map<StreamingSessionId, AggregationSnapshot[]>();
let _seq = 0;

// ── Public API ────────────────────────────────────────────────────────────────

/** Capture an immutable snapshot of state. Returns the snapshot. */
export function capture(state: PartialAggregationState): AggregationSnapshot {
  const snapshot: AggregationSnapshot = {
    id:           `snap-${++_seq}-${Date.now()}`,
    sessionId:    state.sessionId,
    capturedAt:   Date.now(),
    arrivedPaths: state.arrivedPaths,
    // Deep-copy to prevent mutation leaks
    state:        deepCopy(state),
  };

  if (!_snapshots.has(state.sessionId)) _snapshots.set(state.sessionId, []);
  _snapshots.get(state.sessionId)!.push(snapshot);

  return snapshot;
}

/** Get the latest snapshot for a session. */
export function latest(sessionId: StreamingSessionId): AggregationSnapshot | undefined {
  const snaps = _snapshots.get(sessionId);
  return snaps ? snaps[snaps.length - 1] : undefined;
}

/** Get all snapshots for a session. */
export function all(sessionId: StreamingSessionId): AggregationSnapshot[] {
  return _snapshots.get(sessionId) ?? [];
}

/** Prune all but the last N snapshots for a session. */
export function prune(sessionId: StreamingSessionId, keepLast: number = 3): void {
  const snaps = _snapshots.get(sessionId);
  if (!snaps || snaps.length <= keepLast) return;
  _snapshots.set(sessionId, snaps.slice(-keepLast));
}

/** Clear all snapshots for a session. */
export function clear(sessionId: StreamingSessionId): void {
  _snapshots.delete(sessionId);
}

// ── Deep copy ─────────────────────────────────────────────────────────────────

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
