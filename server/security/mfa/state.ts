import type { MFAState, StatePatch } from "./types.js";

export const INITIAL_STATE: Readonly<MFAState> = Object.freeze({
  users: Object.freeze([]),
  pendingTOTP: Object.freeze([]),
  pendingOTPs: Object.freeze([]),
  status: "IDLE",
  logs: Object.freeze([]),
  errors: Object.freeze([]),
});

export function transitionState(
  current: Readonly<MFAState>,
  patch: StatePatch,
): Readonly<MFAState> {
  const nextLogs = patch.appendLog
    ? Object.freeze([...current.logs, patch.appendLog])
    : current.logs;

  const nextErrors = patch.appendError
    ? Object.freeze([...current.errors, patch.appendError])
    : current.errors;

  return Object.freeze({
    users: patch.users !== undefined ? Object.freeze([...patch.users]) : current.users,
    pendingTOTP: patch.pendingTOTP !== undefined ? Object.freeze([...patch.pendingTOTP]) : current.pendingTOTP,
    pendingOTPs: patch.pendingOTPs !== undefined ? Object.freeze([...patch.pendingOTPs]) : current.pendingOTPs,
    status: patch.status ?? current.status,
    logs: nextLogs,
    errors: nextErrors,
  });
}
