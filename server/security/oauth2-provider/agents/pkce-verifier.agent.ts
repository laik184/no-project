import { transitionState } from "../state.js";
import type { AgentResult, OAuthProviderState, OAuthRequest } from "../types.js";
import { verifyPkceChallenge } from "../utils/crypto.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "pkce-verifier";

export interface PkceInput {
  readonly request: OAuthRequest;
  readonly state: Readonly<OAuthProviderState>;
  readonly codeChallenge: string;
}

export function verifyPkce(input: PkceInput): Readonly<AgentResult> {
  const { request, state, codeChallenge } = input;

  if (!request.codeVerifier) {
    const errorMsg = "Missing code_verifier";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_grant", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const isValid = verifyPkceChallenge(request.codeVerifier, codeChallenge);
  if (!isValid) {
    const errorMsg = "PKCE verification failed: code_verifier does not match code_challenge";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_grant", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const log = buildLog(SOURCE, "PKCE challenge verified successfully");
  return {
    nextState: transitionState(state, { appendLog: log }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}

export function validatePkceParams(request: OAuthRequest): { valid: boolean; error?: string } {
  if (!request.codeChallenge) {
    return { valid: false, error: "code_challenge is required" };
  }
  if (request.codeChallengeMethod !== "S256") {
    return { valid: false, error: "only S256 code_challenge_method is supported" };
  }
  return { valid: true };
}
