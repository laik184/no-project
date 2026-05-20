import type { LoggerState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<LoggerState> = Object.freeze({
  logLevel: "info",
  transports: Object.freeze([]),
  format: "json",
  initialized: false,
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<LoggerState>,
  patch: StatePatch,
): Readonly<LoggerState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    logLevel: patch.logLevel ?? current.logLevel,
    transports:
      patch.transports !== undefined
        ? Object.freeze([...patch.transports])
        : current.transports,
    format: patch.format ?? current.format,
    initialized: patch.initialized ?? current.initialized,
    logs: nextLogs,
    errors: nextErrors,
  });
}
