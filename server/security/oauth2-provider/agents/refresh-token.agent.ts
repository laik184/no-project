import { transitionState } from "../state.js";
import type { AgentResult, OAuthProviderState, RefreshToken } from "../types.js";
import { signJwt } from "../utils/jwt.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";
import { generateHashedToken, hashToken, matchesHash } from "../utils/token-hash.util.js";

const SOURCE = "refresh-token";
const ACCESS_TOKEN_TTL_S = 3600;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface RefreshTokenStoreInput {
  readonly refreshTokenRaw: string;
  readonly clientId: string;
  readonly userId: string;
  readonly scopes: readonly string[];
  readonly state: Readonly<OAuthProviderState>;
}

export function storeRefreshToken(input: RefreshTokenStoreInput): Readonly<OAuthProviderState> {
  const { refreshTokenRaw, clientId, userId, scopes, state } = input;

  const refreshToken: RefreshToken = Object.freeze({
    tokenHash: hashToken(refreshTokenRaw),
    clientId,
    userId,
    scopes: Object.freeze([...scopes]),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    issuedAt: Date.now(),
  });

  return transitionState(state, {
    refreshTokens: [...state.refreshTokens, refreshToken],
    appendLog: buildLog(SOURCE, `Refresh token stored for user=${userId} client=${clientId}`),
  });
}

export interface RefreshInput {
  readonly rawRefreshToken: string;
  readonly clientId: string;
  readonly state: Readonly<OAuthProviderState>;
}

export interface RefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export function rotateRefreshToken(input: RefreshInput): Readonly<AgentResult & { tokens?: RefreshedTokens }> {
  const { rawRefreshToken, clientId, state } = input;

  const now = Date.now();
  const storedToken = state.refreshTokens.find(
    (t) =>
      matchesHash(rawRefreshToken, t.tokenHash) &&
      t.clientId === clientId &&
      t.expiresAt > now,
  );

  if (!storedToken) {
    const errorMsg = "Invalid or expired refresh token";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_grant", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const isRevoked = state.revokedTokens.includes(storedToken.tokenHash);
  if (isRevoked) {
    const errorMsg = "Refresh token has been revoked";
    return {
      nextState: transitionState(state, {
        status: "ERROR",
        appendError: buildError(SOURCE, errorMsg),
        appendLog: buildLog(SOURCE, errorMsg),
      }),
      output: Object.freeze({ success: false, error: "invalid_grant", logs: Object.freeze([buildLog(SOURCE, errorMsg)]) }),
    };
  }

  const nowSec = Math.floor(now / 1000);
  const expiresAt = nowSec + ACCESS_TOKEN_TTL_S;

  const newAccessToken = signJwt({
    sub: storedToken.userId,
    client_id: storedToken.clientId,
    scope: storedToken.scopes.join(" "),
    exp: expiresAt,
  });

  const { raw: newRefreshRaw, hash: newRefreshHash } = generateHashedToken();

  const newRefreshToken: RefreshToken = Object.freeze({
    tokenHash: newRefreshHash,
    clientId: storedToken.clientId,
    userId: storedToken.userId,
    scopes: Object.freeze([...storedToken.scopes]),
    expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
    issuedAt: Date.now(),
  });

  const updatedRefreshTokens = state.refreshTokens.filter(
    (t) => t.tokenHash !== storedToken.tokenHash,
  );

  const log = buildLog(SOURCE, `Refresh token rotated for user=${storedToken.userId}`);

  return {
    nextState: transitionState(state, {
      refreshTokens: [...updatedRefreshTokens, newRefreshToken],
      appendLog: log,
    }),
    output: Object.freeze({ success: true, logs: Object.freeze([log]) }),
    tokens: Object.freeze({
      accessToken: newAccessToken,
      refreshToken: newRefreshRaw,
      expiresIn: ACCESS_TOKEN_TTL_S,
    }),
  };
}
