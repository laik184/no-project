import { transitionState } from "../state.js";
import type { AgentResult, MFAMethod, MFAState } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { MAX_ATTEMPTS } from "../utils/time-window.util.js";

const SOURCE = "mfa-validator";

export interface MFAValidatorInput {
  readonly userId: string;
  readonly method: MFAMethod;
  readonly state: Readonly<MFAState>;
}

export function validateMFARequest(input: MFAValidatorInput): {
  valid: boolean;
  error?: string;
  nextState: Readonly<MFAState>;
} {
  const { userId, method, state } = input;

  const user = state.users.find((u) => u.userId === userId);
  if (!user) {
    const log = buildLog(SOURCE, `User not found: ${userId}`);
    return {
      valid: false,
      error: "user_not_found",
      nextState: transitionState(state, { appendLog: log }),
    };
  }

  if (!user.mfaEnabled) {
    const log = buildLog(SOURCE, `MFA not enabled for user=${userId}`);
    return {
      valid: false,
      error: "mfa_not_enabled",
      nextState: transitionState(state, { appendLog: log }),
    };
  }

  if (user.attempts >= MAX_ATTEMPTS) {
    const errorMsg = `Max MFA attempts exceeded for user=${userId}`;
    return {
      valid: false,
      error: "max_attempts_exceeded",
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
    };
  }

  const log = buildLog(SOURCE, `MFA request validated for user=${userId} method=${method}`);
  return {
    valid: true,
    nextState: transitionState(state, { appendLog: log }),
  };
}

export function incrementAttempts(userId: string, state: Readonly<MFAState>): Readonly<MFAState> {
  const updatedUsers = state.users.map((u) =>
    u.userId === userId ? Object.freeze({ ...u, attempts: u.attempts + 1 }) : u,
  );
  return transitionState(state, {
    users: updatedUsers,
    appendLog: buildLog(SOURCE, `Attempt incremented for user=${userId}`),
  });
}

export function resetAttempts(userId: string, state: Readonly<MFAState>): Readonly<MFAState> {
  const updatedUsers = state.users.map((u) =>
    u.userId === userId
      ? Object.freeze({ ...u, attempts: 0, lastVerifiedAt: Date.now() })
      : u,
  );
  return transitionState(state, {
    users: updatedUsers,
    appendLog: buildLog(SOURCE, `Attempts reset for user=${userId}`),
  });
}

export function failMFAResult(
  method: MFAMethod,
  error: string,
  log: string,
  state: Readonly<MFAState>,
): Readonly<AgentResult> {
  return {
    nextState: transitionState(state, {
      status: "FAILED",
      appendError: buildError(SOURCE, log),
      appendLog: buildLog(SOURCE, log),
    }),
    output: Object.freeze({
      success: false,
      method,
      verified: false,
      error,
      logs: Object.freeze([buildLog(SOURCE, log)]),
    }),
  };
}
