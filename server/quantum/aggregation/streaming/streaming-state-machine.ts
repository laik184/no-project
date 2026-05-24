/**
 * streaming/streaming-state-machine.ts
 *
 * State machine for streaming aggregation session lifecycle.
 * Enforces valid transitions and rejects illegal phase changes.
 * Single responsibility: phase transition control only.
 */

import type { AggregationPhase, StreamingSessionId } from "../contracts/aggregation.types.ts";

// ── Transition table ──────────────────────────────────────────────────────────

type Transitions = Partial<Record<AggregationPhase, AggregationPhase[]>>;

const VALID_TRANSITIONS: Transitions = {
  collecting:  ["reducing", "failed", "replaying"],
  reducing:    ["reconciling", "collapsing", "failed", "replaying"],
  reconciling: ["publishing", "collapsing", "failed", "replaying"],
  publishing:  ["collapsing", "failed"],
  collapsing:  ["collapsed", "failed"],
  collapsed:   [],
  failed:      ["replaying"],
  replaying:   ["collecting", "reducing", "reconciling", "failed"],
};

// ── Machine instance ──────────────────────────────────────────────────────────

interface MachineState {
  phase:      AggregationPhase;
  history:    Array<{ from: AggregationPhase; to: AggregationPhase; ts: number }>;
  lockedAt?:  number;
}

const _machines = new Map<StreamingSessionId, MachineState>();

// ── Public API ────────────────────────────────────────────────────────────────

export function initMachine(sessionId: StreamingSessionId): void {
  _machines.set(sessionId, { phase: "collecting", history: [] });
}

export function currentPhase(sessionId: StreamingSessionId): AggregationPhase {
  return _machines.get(sessionId)?.phase ?? "collecting";
}

export function tryTransition(
  sessionId: StreamingSessionId,
  to:        AggregationPhase,
  _reason?:  string,
): { ok: boolean; error?: string } {
  const machine = _machines.get(sessionId);
  if (!machine) return { ok: false, error: `Unknown session: ${sessionId}` };
  if (machine.lockedAt !== undefined) {
    return { ok: false, error: `Session ${sessionId} is locked (terminal state reached)` };
  }

  const from    = machine.phase;
  const allowed = VALID_TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return {
      ok:    false,
      error: `Invalid transition ${from} → ${to} for session ${sessionId}`,
    };
  }

  machine.history.push({ from, to, ts: Date.now() });
  machine.phase = to;

  if (to === "collapsed" || to === "failed") {
    machine.lockedAt = Date.now();
  }

  return { ok: true };
}

export function forceTransition(
  sessionId: StreamingSessionId,
  to:        AggregationPhase,
): void {
  const machine = _machines.get(sessionId);
  if (!machine) return;
  machine.history.push({ from: machine.phase, to, ts: Date.now() });
  machine.phase    = to;
  machine.lockedAt = undefined; // unlock for recovery transitions
}

export function isTerminal(sessionId: StreamingSessionId): boolean {
  const phase = currentPhase(sessionId);
  return phase === "collapsed" || phase === "failed";
}

export function getHistory(sessionId: StreamingSessionId) {
  return _machines.get(sessionId)?.history ?? [];
}

export function destroyMachine(sessionId: StreamingSessionId): void {
  _machines.delete(sessionId);
}
