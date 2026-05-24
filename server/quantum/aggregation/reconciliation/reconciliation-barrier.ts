/**
 * reconciliation/reconciliation-barrier.ts
 *
 * Synchronization barrier ensuring all detected conflicts are resolved
 * before final collapse is allowed. Prevents merge corruption.
 * Single responsibility: conflict gate only.
 */

import type { StreamingSessionId } from "../contracts/aggregation.types.ts";

// ── Barrier state ─────────────────────────────────────────────────────────────

interface BarrierState {
  sessionId:         StreamingSessionId;
  totalConflicts:    number;
  resolvedConflicts: number;
  openedAt:          number;
  closedAt?:         number;
  locked:            boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _barriers = new Map<StreamingSessionId, BarrierState>();

// ── Public API ────────────────────────────────────────────────────────────────

export function openBarrier(sessionId: StreamingSessionId): void {
  _barriers.set(sessionId, {
    sessionId,
    totalConflicts:    0,
    resolvedConflicts: 0,
    openedAt:          Date.now(),
    locked:            false,
  });
}

export function registerConflict(sessionId: StreamingSessionId): void {
  const b = _barriers.get(sessionId);
  if (!b || b.locked) return;
  b.totalConflicts++;
}

export function registerResolution(sessionId: StreamingSessionId): void {
  const b = _barriers.get(sessionId);
  if (!b || b.locked) return;
  b.resolvedConflicts = Math.min(b.resolvedConflicts + 1, b.totalConflicts);
}

/**
 * Returns true if ALL registered conflicts have been resolved.
 * Also returns true if no conflicts were registered (nothing to resolve).
 */
export function isBarrierClear(sessionId: StreamingSessionId): boolean {
  const b = _barriers.get(sessionId);
  if (!b) return true; // no barrier = no block
  return b.resolvedConflicts >= b.totalConflicts;
}

/**
 * Lock the barrier, preventing further conflict registration.
 * Called before final collapse to freeze the gate state.
 */
export function lockBarrier(sessionId: StreamingSessionId): void {
  const b = _barriers.get(sessionId);
  if (!b) return;
  b.locked    = true;
  b.closedAt  = Date.now();
}

export function barrierSummary(sessionId: StreamingSessionId): {
  clear: boolean;
  total: number;
  resolved: number;
  unresolved: number;
} {
  const b = _barriers.get(sessionId);
  if (!b) return { clear: true, total: 0, resolved: 0, unresolved: 0 };
  const unresolved = b.totalConflicts - b.resolvedConflicts;
  return {
    clear:      unresolved === 0,
    total:      b.totalConflicts,
    resolved:   b.resolvedConflicts,
    unresolved,
  };
}

export function clearBarrier(sessionId: StreamingSessionId): void {
  _barriers.delete(sessionId);
}
