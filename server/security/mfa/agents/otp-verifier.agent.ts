import { transitionState } from "../state.js";
import type { AgentResult, MFAState } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { isOTPExpired } from "../utils/time-window.util.js";

const SOURCE = "otp-verifier";

export interface OTPVerifierInput {
  readonly userId: string;
  readonly code: string;
  readonly state: Readonly<MFAState>;
}

export function verifyOTP(input: OTPVerifierInput): Readonly<AgentResult> {
  const { userId, code, state } = input;

  const pending = state.pendingOTPs.find(
    (o) => o.userId === userId && !o.used,
  );

  if (!pending) {
    const errorMsg = `No pending OTP found for user=${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "OTP",
        verified: false,
        error: "no_pending_otp",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  if (isOTPExpired(pending.expiresAt)) {
    const errorMsg = `OTP expired for user=${userId}`;
    const filteredOTPs = state.pendingOTPs.filter((o) => !(o.userId === userId && !o.used));
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        pendingOTPs: filteredOTPs,
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "OTP",
        verified: false,
        error: "otp_expired",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  if (pending.code !== code) {
    const errorMsg = `OTP mismatch for user=${userId}`;
    return {
      nextState: transitionState(state, {
        status: "FAILED",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({
        success: false,
        method: "OTP",
        verified: false,
        error: "invalid_code",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const updatedOTPs = state.pendingOTPs.map((o) =>
    o.userId === userId && !o.used ? Object.freeze({ ...o, used: true }) : o,
  );

  const log = buildLog(SOURCE, `OTP verified for user=${userId}`);
  return {
    nextState: transitionState(state, {
      pendingOTPs: updatedOTPs,
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method: "OTP",
      verified: true,
      logs: Object.freeze([log]),
    }),
  };
}
