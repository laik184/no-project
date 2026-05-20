import { transitionState } from "../state.js";
import type { AgentResult, MFAMethod, MFAState, MFAUserRecord } from "../types.js";
import { sha256Hex } from "../utils/hash.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "mfa-enrollment";

export interface EnrollmentInput {
  readonly userId: string;
  readonly method: MFAMethod;
  readonly totpSecret?: string;
  readonly state: Readonly<MFAState>;
}

export interface DisableInput {
  readonly userId: string;
  readonly state: Readonly<MFAState>;
}

export function enrollUser(input: EnrollmentInput): Readonly<AgentResult> {
  const { userId, method, totpSecret, state } = input;

  const existingUser = state.users.find((u) => u.userId === userId);

  if (method === "TOTP" && !totpSecret) {
    const errorMsg = `TOTP secret required for enrollment of user=${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method,
        verified: false,
        error: "missing_totp_secret",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const newRecord: MFAUserRecord = Object.freeze({
    userId,
    mfaEnabled: false,
    enrolledMethod: method,
    totpSecretHash: totpSecret ? sha256Hex(totpSecret) : undefined,
    backupCodes: Object.freeze(existingUser?.backupCodes ?? []),
    lastVerifiedAt: existingUser?.lastVerifiedAt,
    attempts: 0,
  });

  const updatedUsers = existingUser
    ? state.users.map((u) => (u.userId === userId ? newRecord : u))
    : [...state.users, newRecord];

  const cleanedPendingTOTP = state.pendingTOTP.filter((t) => t.userId !== userId);
  const log = buildLog(SOURCE, `MFA enrollment started for user=${userId} method=${method}`);

  return {
    nextState: transitionState(state, {
      status: "ENROLLING",
      users: updatedUsers,
      pendingTOTP: cleanedPendingTOTP,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method,
      verified: false,
      logs: Object.freeze([log]),
    }),
  };
}

export function enableMFA(userId: string, state: Readonly<MFAState>): Readonly<AgentResult> {
  const user = state.users.find((u) => u.userId === userId);
  if (!user) {
    const errorMsg = `Cannot enable MFA — user not enrolled: ${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: user?.enrolledMethod ?? "TOTP",
        verified: false,
        error: "user_not_enrolled",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const enabledUser = Object.freeze({ ...user, mfaEnabled: true, lastVerifiedAt: Date.now() });
  const updatedUsers = state.users.map((u) => (u.userId === userId ? enabledUser : u));
  const log = buildLog(SOURCE, `MFA enabled for user=${userId}`);

  return {
    nextState: transitionState(state, {
      status: "ENABLED",
      users: updatedUsers,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method: user.enrolledMethod ?? "TOTP",
      verified: true,
      logs: Object.freeze([log]),
    }),
  };
}

export function disableMFA(input: DisableInput): Readonly<AgentResult> {
  const { userId, state } = input;

  const user = state.users.find((u) => u.userId === userId);
  if (!user) {
    const errorMsg = `User not found for MFA disable: ${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "TOTP",
        verified: false,
        error: "user_not_found",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const disabledUser = Object.freeze({
    ...user,
    mfaEnabled: false,
    enrolledMethod: undefined,
    totpSecretHash: undefined,
    backupCodes: Object.freeze([]),
    attempts: 0,
  });
  const updatedUsers = state.users.map((u) => (u.userId === userId ? disabledUser : u));
  const log = buildLog(SOURCE, `MFA disabled for user=${userId}`);

  return {
    nextState: transitionState(state, {
      status: "IDLE",
      users: updatedUsers,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method: user.enrolledMethod ?? "TOTP",
      verified: false,
      logs: Object.freeze([log]),
    }),
  };
}
