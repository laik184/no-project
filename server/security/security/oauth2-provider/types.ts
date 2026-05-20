export type OAuthStatus = "IDLE" | "AUTHORIZING" | "ISSUING" | "ERROR";

export type GrantType = "authorization_code" | "refresh_token";

export type TokenType = "Bearer";

export interface OAuthClient {
  readonly clientId: string;
  readonly clientSecretHash: string;
  readonly redirectUris: readonly string[];
  readonly allowedScopes: readonly string[];
  readonly name: string;
  readonly createdAt: number;
}

export interface AuthCode {
  readonly code: string;
  readonly clientId: string;
  readonly userId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly codeChallenge: string;
  readonly codeChallengeMethod: "S256";
  readonly expiresAt: number;
  readonly used: boolean;
}

export interface AccessToken {
  readonly token: string;
  readonly clientId: string;
  readonly userId: string;
  readonly scopes: readonly string[];
  readonly expiresAt: number;
  readonly issuedAt: number;
}

export interface RefreshToken {
  readonly tokenHash: string;
  readonly clientId: string;
  readonly userId: string;
  readonly scopes: readonly string[];
  readonly expiresAt: number;
  readonly issuedAt: number;
}

export type Scope = string;

export interface OAuthRequest {
  readonly grantType: GrantType;
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly redirectUri?: string;
  readonly code?: string;
  readonly codeVerifier?: string;
  readonly refreshToken?: string;
  readonly scopes?: readonly string[];
  readonly userId?: string;
  readonly codeChallenge?: string;
  readonly codeChallengeMethod?: "S256";
  readonly consentGiven?: boolean;
  readonly tokenToRevoke?: string;
}

export interface OAuthResponse {
  readonly success: boolean;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly scope?: string;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface OAuthProviderState {
  readonly clients: readonly OAuthClient[];
  readonly authCodes: readonly AuthCode[];
  readonly accessTokens: readonly AccessToken[];
  readonly refreshTokens: readonly RefreshToken[];
  readonly revokedTokens: readonly string[];
  readonly status: OAuthStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly clients?: readonly OAuthClient[];
  readonly authCodes?: readonly AuthCode[];
  readonly accessTokens?: readonly AccessToken[];
  readonly refreshTokens?: readonly RefreshToken[];
  readonly revokedTokens?: readonly string[];
  readonly status?: OAuthStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<OAuthProviderState>;
  readonly output: Readonly<OAuthResponse>;
}
