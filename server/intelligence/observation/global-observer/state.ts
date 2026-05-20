import type { Anomaly, Trend } from "./types";

export interface ObserverState {
  readonly lastHealthScore: number | null;
  readonly anomalyHistory: readonly Anomaly[];
  readonly trendHistory: readonly Trend[];
  readonly observationCount: number;
  readonly lastObservedAt: number | null;
}

let state: ObserverState = Object.freeze({
  lastHealthScore: null,
  anomalyHistory: Object.freeze([]),
  trendHistory: Object.freeze([]),
  observationCount: 0,
  lastObservedAt: null,
});

export function getState(): ObserverState {
  return state;
}

export function recordObservation(
  healthScore: number,
  anomalies: Anomaly[],
  trends: Trend[]
): void {
  const mergedAnomalies = [...state.anomalyHistory, ...anomalies].slice(-200);
  const mergedTrends = [...state.trendHistory, ...trends].slice(-200);

  state = Object.freeze({
    lastHealthScore: healthScore,
    anomalyHistory: Object.freeze(mergedAnomalies),
    trendHistory: Object.freeze(mergedTrends),
    observationCount: state.observationCount + 1,
    lastObservedAt: Date.now(),
  });
}

export function resetState(): void {
  state = Object.freeze({
    lastHealthScore: null,
    anomalyHistory: Object.freeze([]),
    trendHistory: Object.freeze([]),
    observationCount: 0,
    lastObservedAt: null,
  });
}
