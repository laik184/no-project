import { transitionState } from "../state.js";
import type { AccessToken, AgentResult, AuthCode, OAuthProviderState } from "../types.js";
import { signJwt } from "../utils/jwt.util.js";
import { buildLog } from "../utils/logger.util.js";
import { generateHashedToken } from "../utils/token-hash.util.js";

const SOURCE = "token-issuer";
const ACCESS_TOKEN_TTL_S = 3600;

export interface TokenIssuerInput {
  readonly authCode: Readonly<AuthCode>;
  readonly state: Readonly<OAuthProviderState>;
}

export interface IssuedTokens {
  readonly accessToken: string;
  readonly refreshTokenRaw: string;
  readonly expiresIn: number;
}

export function issueAccessToken(input: TokenIssuerInput): Readonly<AgentResult & { tokens?: IssuedTokens }> {
  const { authCode, state } = input;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ACCESS_TOKEN_TTL_S;

  const accessTokenJwt = signJwt({
    sub: authCode.userId,
    client_id: authCode.clientId,
    scope: authCode.scopes.join(" "),
    exp: expiresAt,
  });

  const accessToken: AccessToken = Object.freeze({
    token: accessTokenJwt,
    clientId: authCode.clientId,
    userId: authCode.userId,
    scopes: Object.freeze([...authCode.scopes]),
    expiresAt: expiresAt * 1000,
    issuedAt: now * 1000,
  });

  const { raw: refreshTokenRaw, hash: refreshTokenHash } = generateHashedToken();

  const log = buildLog(SOURCE, `Access token issued for user=${authCode.userId} client=${authCode.clientId}`);

  return {
    nextState: transitionState(state, {
      status: "ISSUING",
      accessTokens: [...state.accessTokens, accessToken],
      appendLog: log,
    }),
    output: Object.freeze({
      success: true,
      logs: Object.freeze([log]),
    }),
    tokens: Object.freeze({
      accessToken: accessTokenJwt,
      refreshTokenRaw,
      expiresIn: ACCESS_TOKEN_TTL_S,
    }),
  };
}
