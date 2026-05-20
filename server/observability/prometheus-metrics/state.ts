import type { Metric, PrometheusState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<PrometheusState> = Object.freeze({
  metrics: Object.freeze([]),
  registry: null,
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<PrometheusState>,
  patch: StatePatch,
): Readonly<PrometheusState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    metrics:
      patch.metrics !== undefined
        ? Object.freeze([...patch.metrics])
        : current.metrics,
    registry:
      patch.registry !== undefined ? patch.registry : current.registry,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}

export function upsertMetricToState(
  state: Readonly<PrometheusState>,
  metric: Readonly<Metric>,
): Readonly<PrometheusState> {
  const updatedRegistry = Object.freeze({
    ...(state.registry ?? {}),
    [metric.name]: metric,
  });

  const updatedMetrics: readonly Metric[] = state.metrics.some(
    (m) => m.name === metric.name,
  )
    ? Object.freeze(state.metrics.map((m) => (m.name === metric.name ? metric : m)))
    : Object.freeze([...state.metrics, metric]);

  return transitionState(state, {
    registry: updatedRegistry,
    metrics: updatedMetrics,
  });
}

export function lookupMetricInState(
  state: Readonly<PrometheusState>,
  name: string,
): Readonly<Metric> | undefined {
  return state.registry?.[name];
}
