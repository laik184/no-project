import type { TelemetryState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<TelemetryState> = Object.freeze({
  activeTraces: Object.freeze([]),
  spans: Object.freeze([]),
  metrics: Object.freeze([]),
  errors: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
});

export function transitionState(
  current: Readonly<TelemetryState>,
  patch: StatePatch,
): Readonly<TelemetryState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    activeTraces:
      patch.activeTraces !== undefined
        ? Object.freeze([...patch.activeTraces])
        : current.activeTraces,
    spans:
      patch.spans !== undefined
        ? Object.freeze([...patch.spans])
        : current.spans,
    metrics:
      patch.metrics !== undefined
        ? Object.freeze([...patch.metrics])
        : current.metrics,
    errors: nextErrors,
    status: patch.status ?? current.status,
    logs: nextLogs,
  });
}
