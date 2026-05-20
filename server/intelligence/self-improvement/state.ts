import type { ImprovementPlan, Bottleneck, StrategyType } from "./types";

export interface DetectedPattern {
  pattern: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
}

export interface SelfImprovementState {
  readonly lastAnalysis: ImprovementPlan | null;
  readonly improvementHistory: readonly ImprovementPlan[];
  readonly successRates: Readonly<Record<StrategyType, number>>;
  readonly detectedPatterns: readonly DetectedPattern[];
}

const DEFAULT_SUCCESS_RATES: Readonly<Record<StrategyType, number>> = Object.freeze({
  optimize: 0,
  refactor: 0,
  cache: 0,
  parallelize: 0,
  "retry-tune": 0,
});

let state: SelfImprovementState = Object.freeze({
  lastAnalysis: null,
  improvementHistory: Object.freeze([]),
  successRates: DEFAULT_SUCCESS_RATES,
  detectedPatterns: Object.freeze([]),
});

export function getState(): SelfImprovementState {
  return state;
}

export function recordAnalysis(plan: ImprovementPlan): void {
  const frozen = Object.freeze({ ...plan });
  const history = [...state.improvementHistory, frozen].slice(-50);
  state = Object.freeze({
    ...state,
    lastAnalysis: frozen,
    improvementHistory: Object.freeze(history),
  });
}

export function recordPatterns(newPatterns: DetectedPattern[]): void {
  const existing = [...state.detectedPatterns];
  for (const np of newPatterns) {
    const idx = existing.findIndex((p) => p.pattern === np.pattern);
    if (idx >= 0) {
      existing[idx] = Object.freeze({
        ...existing[idx],
        occurrences: existing[idx].occurrences + np.occurrences,
        lastSeen: np.lastSeen,
      });
    } else {
      existing.push(Object.freeze(np));
    }
  }
  state = Object.freeze({
    ...state,
    detectedPatterns: Object.freeze(existing.slice(-100)),
  });
}

export function updateSuccessRate(strategy: StrategyType, succeeded: boolean): void {
  const current = state.successRates[strategy];
  const updated = succeeded
    ? Math.min(1, current + 0.05)
    : Math.max(0, current - 0.03);
  state = Object.freeze({
    ...state,
    successRates: Object.freeze({ ...state.successRates, [strategy]: updated }),
  });
}

export function resetState(): void {
  state = Object.freeze({
    lastAnalysis: null,
    improvementHistory: Object.freeze([]),
    successRates: DEFAULT_SUCCESS_RATES,
    detectedPatterns: Object.freeze([]),
  });
}
