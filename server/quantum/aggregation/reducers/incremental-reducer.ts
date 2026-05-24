/**
 * reducers/incremental-reducer.ts
 *
 * Folds a single StreamingPathEvent into the running PartialAggregationState.
 * Pure fold function — no side effects, no I/O, no telemetry.
 * Orchestrators call this after every path.completed event.
 */

import type {
  StreamingPathEvent,
  PartialAggregationState,
  StreamingSessionId,
} from "../contracts/aggregation.types.ts";
import type { IIncrementalReducer } from "../contracts/aggregation.interfaces.ts";
import { confidenceReducer }        from "./confidence-reducer.ts";

// ── State seed ────────────────────────────────────────────────────────────────

export function seedState(
  sessionId:  StreamingSessionId,
  runId:      string,
  projectId:  number,
  totalPaths: number,
): PartialAggregationState {
  return {
    sessionId,
    runId,
    projectId,
    totalPaths,
    arrivedPaths:      0,
    successPaths:      0,
    failedPaths:       0,
    topConfidence:     0,
    topPathId:         undefined,
    conflicts:         0,
    resolvedConflicts: 0,
    phase:             "collecting",
    updatedAt:         Date.now(),
    mergedFiles:       [],
    eventLog:          [],
  };
}

// ── IncrementalReducer ────────────────────────────────────────────────────────

export class IncrementalReducer implements IIncrementalReducer {
  private _states = new Map<StreamingSessionId, PartialAggregationState>();

  /** Pure fold — returns new state, does not mutate original. */
  reduce(
    current: PartialAggregationState,
    event:   StreamingPathEvent,
  ): PartialAggregationState {
    // Idempotency guard: ignore duplicate path arrivals
    if (current.eventLog.some(e => e.pathId === event.pathId)) {
      return current;
    }

    const nextLog      = [...current.eventLog, event];
    const successPaths = current.successPaths + (event.success ? 1 : 0);
    const failedPaths  = current.failedPaths  + (event.success ? 0 : 1);
    const arrivedPaths = current.arrivedPaths + 1;

    // Merge file list (union, dedup)
    const mergedFiles = Array.from(
      new Set([...current.mergedFiles, ...event.filesWritten]),
    );

    // Recompute top confidence over all successful events
    const { topPathId, topConfidence } = confidenceReducer.score(
      nextLog.filter(e => e.success),
    );

    // Advance phase heuristic
    const phase = _advancePhase(current.phase, arrivedPaths, current.totalPaths);

    const next: PartialAggregationState = {
      ...current,
      arrivedPaths,
      successPaths,
      failedPaths,
      topConfidence,
      topPathId,
      phase,
      updatedAt:   Date.now(),
      mergedFiles,
      eventLog:    nextLog,
    };

    this._states.set(event.sessionId, next);
    return next;
  }

  reset(sessionId: StreamingSessionId): void {
    this._states.delete(sessionId);
  }

  getCurrent(sessionId: StreamingSessionId): PartialAggregationState | undefined {
    return this._states.get(sessionId);
  }
}

export const incrementalReducer = new IncrementalReducer();

// ── Phase progression ─────────────────────────────────────────────────────────

function _advancePhase(
  current:    PartialAggregationState["phase"],
  arrived:    number,
  total:      number,
): PartialAggregationState["phase"] {
  if (current === "failed" || current === "collapsed") return current;
  if (arrived === 0)       return "collecting";
  if (arrived < total)     return "reducing";
  return "reconciling";
}
