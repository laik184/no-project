import { transitionState } from "../state.js";
import type { AgentResult, MFARequest, MFAState, TOTPSecret } from "../types.js";
import { sha256Hex } from "../utils/hash.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { buildOTPAuthURI, buildQRCodeDataURI } from "../utils/qr-generator.util.js";
import { generateTOTPSecret } from "../utils/secret-generator.util.js";

const SOURCE = "totp-generator";

export interface TOTPGeneratorInput {
  readonly request: MFARequest;
  readonly state: Readonly<MFAState>;
}

export function generateTOTP(input: TOTPGeneratorInput): Readonly<AgentResult & { totpSecret?: TOTPSecret }> {
  const { request, state } = input;

  if (!request.userId) {
    const errorMsg = "Missing userId for TOTP generation";
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
        error: "invalid_request",
        logs: Object.freeze([buildLog(SOURCE, errorMsg)]),
      }),
    };
  }

  const rawSecret = generateTOTPSecret();
  const issuer = request.issuer ?? "NuraX";
  const otpauthUri = buildOTPAuthURI({
    secret: rawSecret,
    issuer,
    accountName: request.userId,
  });
  const qrCodeUri = buildQRCodeDataURI(otpauthUri);

  const totpSecret: TOTPSecret = Object.freeze({
    userId: request.userId,
    secret: rawSecret,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    issuer,
    accountName: request.userId,
    qrCodeUri,
    createdAt: Date.now(),
  });

  const secretHash = sha256Hex(rawSecret);
  const existing = state.pendingTOTP.filter((t) => t.userId !== request.userId);
  const log = buildLog(SOURCE, `TOTP secret generated for user=${request.userId}`);

  return {
    nextState: transitionState(state, {
      status: "ENROLLING",
      pendingTOTP: [...existing, totpSecret],
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      method: "TOTP",
      verified: false,
      qrCodeUri,
      logs: Object.freeze([log]),
    }),
    totpSecret,
  };
}
