import { transitionState } from "../state.js";
import type { AgentResult, OAuthProviderState } from "../types.js";
import { verifyJwt } from "../utils/jwt.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { hashToken, matchesHash } from "../utils/token-hash.util.js";

const SOURCE = "revocation";

export interface RevocationInput {
  readonly tokenToRevoke: string;
  readonly clientId: string;
  readonly state: Readonly<OAuthProviderState>;
}

export function revokeToken(input: RevocationInput): Readonly<AgentResult> {
  const { tokenToRevoke, clientId, state } = input;

  const refreshToken = state.refreshTokens.find(
    (t) => matchesHash(tokenToRevoke, t.tokenHash) && t.clientId === clientId,
  );

  if (refreshToken) {
    if (state.revokedTokens.includes(refreshToken.tokenHash)) {
      const log = buildLog(SOURCE, "Token already revoked");
      return {
        nextState: transitionState(state, { appendLog: log }),
        output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
      };
    }
    const log = buildLog(SOURCE, `Refresh token revoked for client=${clientId}`);
    return {
      nextState: transitionState(state, {
        revokedTokens: [...state.revokedTokens, refreshToken.tokenHash],
        appendLog: log,
      }),
      output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
    };
  }

  const payload = verifyJwt(tokenToRevoke);
  if (payload && payload.client_id === clientId) {
    const tokenHash = hashToken(tokenToRevoke);
    if (state.revokedTokens.includes(tokenHash)) {
      const log = buildLog(SOURCE, "Access token already revoked");
      return {
        nextState: transitionState(state, { appendLog: log }),
        output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
      };
    }
    const log = buildLog(SOURCE, `Access token revoked for client=${clientId} sub=${payload.sub}`);
    return {
      nextState: transitionState(state, {
        revokedTokens: [...state.revokedTokens, tokenHash],
        appendLog: log,
      }),
      output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
    };
  }

  const errorMsg = `Token not found or client mismatch for client=${clientId}`;
  return {
    nextState: transitionState(state, {
      status: "ERROR",
      appendError: buildError(SOURCE, errorMsg),
      appendLog: buildLog(SOURCE, errorMsg),
    }),
    output: Object.freeze({ success: false, error: "invalid_token", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
  };
}
