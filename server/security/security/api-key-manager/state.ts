import type { ApiKeyManagerState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<ApiKeyManagerState> = Object.freeze({
  keys: Object.freeze([]),
  usage: Object.freeze({}),
  rateLimits: Object.freeze({}),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<ApiKeyManagerState>,
  patch: StatePatch,
): Readonly<ApiKeyManagerState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    keys: patch.keys !== undefined ? Object.freeze([...patch.keys]) : current.keys,
    usage: patch.usage !== undefined ? Object.freeze({ ...patch.usage }) : current.usage,
    rateLimits: patch.rateLimits !== undefined ? Object.freeze({ ...patch.rateLimits }) : current.rateLimits,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}
