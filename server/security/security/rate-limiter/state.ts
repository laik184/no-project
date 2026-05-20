import type { RateLimiterState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<RateLimiterState> = Object.freeze({
  activeLimits: Object.freeze({}),
  requestCounts: Object.freeze({}),
  blockedRequests: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<RateLimiterState>,
  patch: StatePatch,
): Readonly<RateLimiterState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    activeLimits: patch.activeLimits !== undefined
      ? Object.freeze({ ...patch.activeLimits })
      : current.activeLimits,
    requestCounts: patch.requestCounts !== undefined
      ? Object.freeze({ ...patch.requestCounts })
      : current.requestCounts,
    blockedRequests: patch.blockedRequests !== undefined
      ? Object.freeze([...patch.blockedRequests])
      : current.blockedRequests,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}
