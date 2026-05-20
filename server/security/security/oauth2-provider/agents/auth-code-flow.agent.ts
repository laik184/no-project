import { transitionState } from "../state.js";
import type { AgentResult, AuthCode, OAuthClient, OAuthProviderState, OAuthRequest } from "../types.js";
import { generateSecureRandom } from "../utils/crypto.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { isValidRedirectUri } from "../utils/url.util.js";

const SOURCE = "auth-code-flow";
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

export interface AuthCodeInput {
  readonly request: OAuthRequest;
  readonly client: Readonly<OAuthClient>;
  readonly userId: string;
  readonly scopes: readonly string[];
  readonly state: Readonly<OAuthProviderState>;
}

export function generateAuthCode(input: AuthCodeInput): Readonly<AgentResult> {
  const { request, client, userId, scopes, state } = input;

  if (!request.redirectUri) {
    const errorMsg = "Missing redirect_uri";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_request", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  if (!isValidRedirectUri(request.redirectUri, client.redirectUris)) {
    const errorMsg = `Invalid redirect_uri: ${request.redirectUri}`;
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_request", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  if (!request.codeChallenge) {
    const errorMsg = "PKCE code_challenge is required";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_request", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const code = generateSecureRandom(32);
  const authCode: AuthCode = Object.freeze({
    code,
    clientId: client.clientId,
    userId,
    redirectUri: request.redirectUri,
    scopes: Object.freeze([...scopes]),
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: "S256",
    expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    used: false,
  });

  const log = buildLog(SOURCE, `Auth code issued for client=${client.clientId} user=${userId}`);
  return {
    nextState: transitionState(state, {
      status: "AUTHORIZING",
      authCodes: [...state.authCodes, authCode],
      appendLog: log,
    }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
  };
}

export function consumeAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
  state: Readonly<OAuthProviderState>,
): { authCode: Readonly<AuthCode> | null; nextState: Readonly<OAuthProviderState>; log: string } {
  const now = Date.now();
  const authCode = state.authCodes.find(
    (c) => c.code === code && c.clientId === clientId && !c.used && c.expiresAt > now,
  );

  if (!authCode) {
    const log = buildLog(SOURCE, `Auth code not found or expired: ${code}`);
    return { authCode: null, nextState: transitionState(state, { appendLog: log }), log };
  }

  if (authCode.redirectUri !== redirectUri) {
    const log = buildLog(SOURCE, `redirect_uri mismatch for code: ${code}`);
    return { authCode: null, nextState: transitionState(state, { appendLog: log }), log };
  }

  const updatedCodes = state.authCodes.map((c) =>
    c.code === code ? Object.freeze({ ...c, used: true }) : c,
  );
  const log = buildLog(SOURCE, `Auth code consumed: ${code}`);
  return {
    authCode,
    nextState: transitionState(state, { authCodes: updatedCodes, appendLog: log }),
    log,
  };
}
