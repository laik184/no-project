import type { Variant, ExecutionResult } from "./types";

export interface PerformanceHistoryEntry {
  readonly experimentGoal: string;
  readonly winnerId: string;
  readonly winnerName: string;
  readonly confidence: number;
  readonly results: readonly ExecutionResult[];
  readonly recordedAt: number;
}

export interface ExperimentationStateShape {
  readonly experimentsRun: number;
  readonly lastWinner: Variant | null;
  readonly performanceHistory: readonly PerformanceHistoryEntry[];
}

const initialState: ExperimentationStateShape = Object.freeze({
  experimentsRun: 0,
  lastWinner: null,
  performanceHistory: Object.freeze([]) as readonly PerformanceHistoryEntry[],
});

let mutableState: ExperimentationStateShape = initialState;

export function getExperimentState(): ExperimentationStateShape {
  return mutableState;
}

export function recordExperimentResult(
  experimentGoal: string,
  winner: Variant,
  confidence: number,
  results: ExecutionResult[]
): void {
  const entry: PerformanceHistoryEntry = Object.freeze({
    experimentGoal,
    winnerId: winner.id,
    winnerName: winner.name,
    confidence,
    results: Object.freeze([...results]),
    recordedAt: Date.now(),
  });

  const history = [...mutableState.performanceHistory, entry].slice(-200);

  mutableState = Object.freeze({
    experimentsRun: mutableState.experimentsRun + 1,
    lastWinner: Object.freeze({ ...winner }),
    performanceHistory: Object.freeze(history),
  });
}

export function resetExperimentState(): void {
  mutableState = initialState;
}
