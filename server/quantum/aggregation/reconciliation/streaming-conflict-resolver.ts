/**
 * reconciliation/streaming-conflict-resolver.ts
 *
 * Detects and incrementally resolves file-level conflicts between
 * concurrently completed paths. Supports rollback and deterministic replay.
 * Single responsibility: conflict lifecycle management.
 */

import type {
  StreamingConflict,
  StreamingPathEvent,
  StreamingSessionId,
  ConflictResolutionStrategy,
} from "../contracts/aggregation.types.ts";
import type { IStreamingConflictResolver } from "../contracts/aggregation.interfaces.ts";
import { applyStrategy, selectStrategy }   from "./merge-strategies.ts";
import {
  registerConflict,
  registerResolution,
} from "./reconciliation-barrier.ts";

let _seq = 0;

export class StreamingConflictResolver implements IStreamingConflictResolver {
  // conflictId → conflict
  private readonly _conflicts = new Map<string, StreamingConflict>();
  // sessionId → conflictIds
  private readonly _bySession = new Map<StreamingSessionId, string[]>();
  // sessionId → eventsByPathId (for rollback + re-resolve)
  private readonly _events    = new Map<StreamingSessionId, Map<string, StreamingPathEvent>>();

  // ── Detect ────────────────────────────────────────────────────────────────

  detect(
    eventA: StreamingPathEvent,
    eventB: StreamingPathEvent,
  ): StreamingConflict | null {
    const { sessionId } = eventA;
    this._storeEvent(sessionId, eventA);
    this._storeEvent(sessionId, eventB);

    const sharedFiles = eventA.filesWritten.filter(f => eventB.filesWritten.includes(f));
    if (sharedFiles.length === 0) return null;

    // One conflict per shared file (most significant first)
    const filePath  = sharedFiles[0];
    const strategy  = selectStrategy(filePath);
    const conflict: StreamingConflict = {
      id:         `conflict-${++_seq}-${Date.now()}`,
      sessionId,
      filePath,
      ownerA:     eventA.pathId,
      ownerB:     eventB.pathId,
      strategy,
      resolved:   false,
      detectedAt: Date.now(),
    };

    this._conflicts.set(conflict.id, conflict);
    if (!this._bySession.has(sessionId)) this._bySession.set(sessionId, []);
    this._bySession.get(sessionId)!.push(conflict.id);
    registerConflict(sessionId);

    return conflict;
  }

  // ── Resolve ───────────────────────────────────────────────────────────────

  resolve(conflict: StreamingConflict): StreamingConflict {
    const { sessionId } = conflict;
    const evA = this._getEvent(sessionId, conflict.ownerA);
    const evB = this._getEvent(sessionId, conflict.ownerB);
    if (!evA || !evB) return conflict;

    const result = applyStrategy(conflict.strategy, conflict, evA, evB);
    const resolved: StreamingConflict = {
      ...conflict,
      resolved:   true,
      resolvedAt: Date.now(),
      strategy:   result.strategy,
    };

    this._conflicts.set(conflict.id, resolved);
    registerResolution(sessionId);
    return resolved;
  }

  resolveAll(sessionId: StreamingSessionId): StreamingConflict[] {
    const ids = this._bySession.get(sessionId) ?? [];
    return ids
      .map(id => this._conflicts.get(id))
      .filter((c): c is StreamingConflict => !!c && !c.resolved)
      .map(c => this.resolve(c));
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  getUnresolved(sessionId: StreamingSessionId): StreamingConflict[] {
    const ids = this._bySession.get(sessionId) ?? [];
    return ids
      .map(id => this._conflicts.get(id))
      .filter((c): c is StreamingConflict => !!c && !c.resolved);
  }

  getAll(sessionId: StreamingSessionId): StreamingConflict[] {
    const ids = this._bySession.get(sessionId) ?? [];
    return ids.map(id => this._conflicts.get(id)).filter(Boolean) as StreamingConflict[];
  }

  // ── Rollback ──────────────────────────────────────────────────────────────

  rollback(sessionId: StreamingSessionId): void {
    const ids = this._bySession.get(sessionId) ?? [];
    for (const id of ids) {
      const c = this._conflicts.get(id);
      if (c?.resolved) {
        this._conflicts.set(id, { ...c, resolved: false, resolvedAt: undefined });
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _storeEvent(sessionId: StreamingSessionId, ev: StreamingPathEvent): void {
    if (!this._events.has(sessionId)) this._events.set(sessionId, new Map());
    this._events.get(sessionId)!.set(ev.pathId, ev);
  }

  private _getEvent(
    sessionId: StreamingSessionId,
    pathId: string,
  ): StreamingPathEvent | undefined {
    return this._events.get(sessionId)?.get(pathId);
  }

  clear(sessionId: StreamingSessionId): void {
    const ids = this._bySession.get(sessionId) ?? [];
    for (const id of ids) this._conflicts.delete(id);
    this._bySession.delete(sessionId);
    this._events.delete(sessionId);
  }
}

export const conflictResolver = new StreamingConflictResolver();
