import { transitionState } from "../state.js";
import type { AgentResult, MFAState } from "../types.js";
import { base32Decode, hmacSHA1 } from "../utils/hash.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { timeStepsInWindow } from "../utils/time-window.util.js";

const SOURCE = "totp-verifier";

export interface TOTPVerifierInput {
  readonly userId: string;
  readonly code: string;
  readonly secret: string;
  readonly state: Readonly<MFAState>;
}

function computeTOTP(secret: string, timeStep: number, digits: number = 6): string {
  const key = base32Decode(secret);
  const time = Buffer.alloc(8);
  let t = timeStep;
  for (let i = 7; i >= 0; i--) {
    time[i] = t & 0xff;
    t = Math.floor(t / 256);
  }
  const hmac = hmacSHA1(key, time);
  const offset = (hmac[19] as number) & 0x0f;
  const code =
    (((hmac[offset] as number) & 0x7f) << 24) |
    (((hmac[offset + 1] as number) & 0xff) << 16) |
    (((hmac[offset + 2] as number) & 0xff) << 8) |
    ((hmac[offset + 3] as number) & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, "0");
}

export function verifyTOTP(input: TOTPVerifierInput): Readonly<AgentResult> {
  const { userId, code, secret, state } = input;

  if (!code || code.length !== 6) {
    const errorMsg = `Invalid TOTP code format for user=${userId}`;
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
        error: "invalid_code",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const steps = timeStepsInWindow();
  const isValid = steps.some((step) => computeTOTP(secret, step) === code);

  if (!isValid) {
    const errorMsg = `TOTP verification failed for user=${userId}`;
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
        error: "invalid_code",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const log = buildLog(SOURCE, `TOTP verified for user=${userId}`);
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({
      success: true,
      method: "TOTP",
      verified: true,
      logs: Object.freeze([log]),
    }),
  };
}
