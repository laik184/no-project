import type { SanitizerState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<SanitizerState> = Object.freeze({
  lastInput: Object.freeze({}),
  sanitizedOutput: Object.freeze({}),
  issues: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<SanitizerState>,
  patch: StatePatch,
): Readonly<SanitizerState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    lastInput: patch.lastInput !== undefined ? Object.freeze({ ...patch.lastInput }) : current.lastInput,
    sanitizedOutput: patch.sanitizedOutput !== undefined ? Object.freeze({ ...patch.sanitizedOutput }) : current.sanitizedOutput,
    issues: patch.issues !== undefined ? Object.freeze([...patch.issues]) : current.issues,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}
