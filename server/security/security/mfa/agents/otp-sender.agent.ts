import { transitionState } from "../state.js";
import type { AgentResult, MFARequest, MFAState, OTPPayload } from "../types.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { generateOTPCode } from "../utils/secret-generator.util.js";
import { makeOTPExpiry } from "../utils/time-window.util.js";

const SOURCE = "otp-sender";

export interface OTPSenderInput {
  readonly request: MFARequest;
  readonly state: Readonly<MFAState>;
}

export type OTPDispatchFn = (destination: string, code: string, channel: "SMS" | "EMAIL") => Promise<void>;

function defaultDispatch(destination: string, code: string, channel: "SMS" | "EMAIL"): Promise<void> {
  console.log(`[OTP-DISPATCH] channel=${channel} destination=${destination} code=${code}`);
  return Promise.resolve();
}

export function sendOTP(
  input: OTPSenderInput,
  dispatch: OTPDispatchFn = defaultDispatch,
): Readonly<AgentResult & { rawCode?: string }> {
  const { request, state } = input;

  if (!request.destination || !request.channel) {
    const errorMsg = "Missing OTP destination or channel";
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
        error: "invalid_request",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const code = generateOTPCode(6);
  const payload: OTPPayload = Object.freeze({
    userId: request.userId,
    code,
    channel: request.channel,
    destination: request.destination,
    expiresAt: makeOTPExpiry(),
    used: false,
  });

  const existing = state.pendingOTPs.filter((o) => o.userId !== request.userId);
  dispatch(request.destination, code, request.channel).catch(() => {});

  const log = buildLog(SOURCE, `OTP sent via ${request.channel} to ${request.destination} for user=${request.userId}`);
  return {
    nextState: transitionState(state, {
      status: "VERIFYING",
      pendingOTPs: [...existing, payload],
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method: "OTP",
      verified: false,
      logs: Object.freeze([log]),
    }),
    rawCode: code,
  };
}
