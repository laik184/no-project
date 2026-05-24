/**
 * buffers/partial-aggregation-buffer.ts
 *
 * Receives streaming path events, runs the incremental reducer,
 * and exposes the current PartialAggregationState.
 * Single responsibility: buffer management + reducer orchestration.
 * No telemetry, no publishing — only state maintenance.
 */

import type {
  StreamingPathEvent,
  PartialAggregationState,
  StreamingSessionId,
  StreamingSessionConfig,
} from "../contracts/aggregation.types.ts";
import type { IPartialAggregationBuffer } from "../contracts/aggregation.interfaces.ts";
import { incrementalReducer, seedState }  from "../reducers/incremental-reducer.ts";
import { capture, latest }               from "./aggregation-snapshot.ts";
import { aggregationQueue }              from "./aggregation-queue.ts";

// ── PartialAggregationBuffer ──────────────────────────────────────────────────

export class PartialAggregationBuffer implements IPartialAggregationBuffer {
  private readonly _states = new Map<StreamingSessionId, PartialAggregationState>();

  // ── Session init ────────────────────────────────────────────────────────────

  initSession(cfg: StreamingSessionConfig): PartialAggregationState {
    const state = seedState(cfg.sessionId, cfg.runId, cfg.projectId, cfg.totalPaths);
    this._states.set(cfg.sessionId, state);
    return state;
  }

  // ── Core push ───────────────────────────────────────────────────────────────

  /**
   * Push a path event into the buffer.
   * Enqueues → dequeues → reduces → snapshots every SNAPSHOT_INTERVAL arrivals.
   * Returns the new PartialAggregationState.
   */
  push(event: StreamingPathEvent): PartialAggregationState {
    const { accepted, dropped } = aggregationQueue.enqueue(event);
    if (!accepted) {
      throw new Error(`[partial-aggregation-buffer] Backpressure: ${dropped}`);
    }

    // Process immediately (no async batching needed — all in-process)
    const queued = aggregationQueue.dequeue(event.sessionId);
    if (!queued) {
      return this._states.get(event.sessionId) ?? this._failState(event.sessionId);
    }

    const current = this._states.get(event.sessionId);
    if (!current) throw new Error(`[partial-aggregation-buffer] Unknown session: ${event.sessionId}`);

    const next = incrementalReducer.reduce(current, queued);
    this._states.set(event.sessionId, next);

    // Snapshot every 5 arrivals for replay safety
    if (next.arrivedPaths % 5 === 0 || next.arrivedPaths === next.totalPaths) {
      capture(next);
    }

    return next;
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  getState(sessionId: StreamingSessionId): PartialAggregationState | undefined {
    return this._states.get(sessionId);
  }

  snapshot(sessionId: StreamingSessionId): PartialAggregationState | undefined {
    return latest(sessionId)?.state;
  }

  // ── Conflict counter (called by resolver) ───────────────────────────────────

  incrementConflicts(sessionId: StreamingSessionId, resolved: boolean): void {
    const state = this._states.get(sessionId);
    if (!state) return;
    this._states.set(sessionId, {
      ...state,
      conflicts:         state.conflicts + 1,
      resolvedConflicts: state.resolvedConflicts + (resolved ? 1 : 0),
    });
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  clear(sessionId: StreamingSessionId): void {
    this._states.delete(sessionId);
    aggregationQueue.clear(sessionId);
    incrementalReducer.reset(sessionId);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _failState(sessionId: StreamingSessionId): PartialAggregationState {
    return seedState(sessionId, "", 0, 0);
  }
}

export const partialBuffer = new PartialAggregationBuffer();
