// ── Quality State ─────────────────────────────────────────────────────────────
//
// Purely immutable state transitions. Tracks score history across successive
// quality-engine runs. Final report assembly is the sole responsibility of
// quality.orchestrator.ts — not this module.

export interface QualityState {
  readonly lastScore:   number;
  readonly history:     readonly number[];
  readonly lastUpdated: number;
}

export function createInitialQualityState(now: number = Date.now()): QualityState {
  return Object.freeze({
    lastScore:   0,
    history:     Object.freeze([]),
    lastUpdated: now,
  });
}

export function recordQualityScore(
  state: QualityState,
  score: number,
  now: number = Date.now(),
): QualityState {
  return Object.freeze({
    lastScore:   score,
    history:     Object.freeze([...state.history, score]),
    lastUpdated: now,
  });
}
