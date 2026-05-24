/**
 * checkpoints/aggregation-checkpoint-store.ts
 *
 * Persist and retrieve AggregationCheckpoints for replay safety.
 * In-process store (can be swapped to Redis/DB for multi-node).
 * Single responsibility: checkpoint CRUD only.
 */

import type {
  AggregationCheckpoint,
  StreamingSessionId,
  PartialAggregationState,
} from "../contracts/aggregation.types.ts";
import type { IAggregationCheckpointStore } from "../contracts/aggregation.interfaces.ts";

let _seq = 0;

export class AggregationCheckpointStore implements IAggregationCheckpointStore {
  private readonly _store = new Map<StreamingSessionId, AggregationCheckpoint[]>();

  // ── Save ──────────────────────────────────────────────────────────────────

  save(checkpoint: AggregationCheckpoint): void {
    if (!this._store.has(checkpoint.sessionId)) {
      this._store.set(checkpoint.sessionId, []);
    }
    this._store.get(checkpoint.sessionId)!.push(checkpoint);
  }

  /** Create and save a checkpoint from a live state. */
  checkpoint(state: PartialAggregationState): AggregationCheckpoint {
    const cp: AggregationCheckpoint = {
      id:         `ckpt-${++_seq}-${Date.now()}`,
      sessionId:  state.sessionId,
      runId:      state.runId,
      state:      JSON.parse(JSON.stringify(state)) as PartialAggregationState,
      createdAt:  Date.now(),
      replayable: true,
    };
    this.save(cp);
    return cp;
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  /** Load the most recent checkpoint for a session. */
  load(sessionId: StreamingSessionId): AggregationCheckpoint | undefined {
    const list = this._store.get(sessionId);
    return list ? list[list.length - 1] : undefined;
  }

  /** Load all checkpoints for a session. */
  loadAll(sessionId: StreamingSessionId): AggregationCheckpoint[] {
    return this._store.get(sessionId) ?? [];
  }

  /** Load checkpoint by ID. */
  loadById(sessionId: StreamingSessionId, id: string): AggregationCheckpoint | undefined {
    return this._store.get(sessionId)?.find(c => c.id === id);
  }

  // ── Prune ─────────────────────────────────────────────────────────────────

  prune(sessionId: StreamingSessionId, keepLast: number = 5): void {
    const list = this._store.get(sessionId);
    if (!list || list.length <= keepLast) return;
    this._store.set(sessionId, list.slice(-keepLast));
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  clear(sessionId: StreamingSessionId): void {
    this._store.delete(sessionId);
  }

  // ── Inspection ────────────────────────────────────────────────────────────

  count(sessionId: StreamingSessionId): number {
    return this._store.get(sessionId)?.length ?? 0;
  }

  hasReplayable(sessionId: StreamingSessionId): boolean {
    return (this._store.get(sessionId) ?? []).some(c => c.replayable);
  }
}

export const checkpointStore = new AggregationCheckpointStore();
