# OAuth2 Provider — HVP-Compliant Architecture

## 1. OAuth2 Flow (Authorization Code + PKCE)

This provider implements the Authorization Code flow with mandatory PKCE (Proof Key for Code Exchange), which eliminates the risk of authorization code interception attacks — especially important for public clients.

### Step-by-step flow

```
Client                    OAuth2 Provider               Resource Server
  |                            |                               |
  |-- (1) /authorize --------> |                               |
  |    client_id               |                               |
  |    redirect_uri            |  validateClient               |
  |    scope                   |  validateScopes               |
  |    code_challenge (S256)   |  handleConsent                |
  |    response_type=code      |  generateAuthCode             |
  |                            |                               |
  |<-- (2) auth_code ----------|                               |
  |                            |                               |
  |-- (3) /token ------------> |                               |
  |    code                    |  validateClient               |
  |    code_verifier           |  consumeAuthCode              |
  |    redirect_uri            |  verifyPkce (S256)            |
  |    grant_type=auth_code    |  issueAccessToken (JWT)       |
  |                            |  storeRefreshToken (hashed)   |
  |                            |                               |
  |<-- (4) access_token -------|                               |
  |        refresh_token       |                               |
  |        expires_in          |                               |
  |                            |                               |
  |-- (5) API call (Bearer) -->|               |               |
  |                            |               |               |
  |                            |           verifyJwt           |
  |                            |           checkRevoked        |
```

---

## 2. File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|---------------|
| `types.ts` | All TypeScript interfaces and union types. No logic. |
| `state.ts` | Immutable state shape, `INITIAL_STATE`, and `transitionState()` function. |

### L1 — Orchestrator

| File | Responsibility |
|------|---------------|
| `orchestrator.ts` | Coordinates the full OAuth2 flows. No business logic — delegates entirely to agents. Exposes `authorizeOrchestrator`, `issueTokenOrchestrator`, `refreshTokenOrchestrator`, `revokeTokenOrchestrator`. |

### L2 — Agents

| File | Responsibility |
|------|---------------|
| `auth-code-flow.agent.ts` | Generates and consumes authorization codes. Validates redirect URIs. Enforces PKCE presence. |
| `token-issuer.agent.ts` | Signs JWT access tokens with short TTL (1 hour). Returns raw refresh token for storage. |
| `refresh-token.agent.ts` | Stores hashed refresh tokens. Rotates them on use (old token discarded, new one issued). |
| `client-registry.agent.ts` | Registers OAuth clients with hashed secrets. Validates client credentials on every request. |
| `pkce-verifier.agent.ts` | Verifies the `code_verifier` against the stored `code_challenge` using SHA-256 Base64URL. |
| `scope-validator.agent.ts` | Ensures requested scopes are a subset of what the client is registered for. |
| `consent-handler.agent.ts` | Checks that the user has explicitly granted consent before an auth code is issued. |
| `revocation.agent.ts` | Revokes access tokens (by JWT hash) and refresh tokens (by stored hash). Idempotent. |

### L3 — Utils

| File | Responsibility |
|------|---------------|
| `jwt.util.ts` | HMAC-SHA256 JWT signing and verification. No auth logic — pure crypto. |
| `crypto.util.ts` | Secure random bytes, SHA-256 hashing, PKCE challenge verification, timing-safe compare. |
| `token-hash.util.ts` | Generates raw+hash token pairs. Used for refresh tokens to avoid storing raw values. |
| `url.util.ts` | Validates redirect URIs against allowlist. Builds redirect URLs with codes or errors. |
| `logger.util.ts` | Builds structured log and error strings with ISO timestamps and source labels. |

---

## 3. Import Relationships (Strict HVP Layering)

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/auth-code-flow.agent.ts (L2)
        │     └── utils/crypto.util.ts, url.util.ts, logger.util.ts (L3)
        ├── agents/token-issuer.agent.ts (L2)
        │     └── utils/jwt.util.ts, token-hash.util.ts, logger.util.ts (L3)
        ├── agents/refresh-token.agent.ts (L2)
        │     └── utils/jwt.util.ts, token-hash.util.ts, logger.util.ts (L3)
        ├── agents/client-registry.agent.ts (L2)
        │     └── utils/crypto.util.ts, logger.util.ts (L3)
        ├── agents/pkce-verifier.agent.ts (L2)
        │     └── utils/crypto.util.ts, logger.util.ts (L3)
        ├── agents/scope-validator.agent.ts (L2)
        │     └── utils/logger.util.ts (L3)
        ├── agents/consent-handler.agent.ts (L2)
        │     └── utils/logger.util.ts (L3)
        ├── agents/revocation.agent.ts (L2)
        │     └── utils/jwt.util.ts, token-hash.util.ts, logger.util.ts (L3)
        ├── state.ts (L0)
        └── types.ts (L0)
```

**Rules enforced:**
- L1 imports L2, L3, L0 only
- L2 imports L3 and L0 only — never another agent
- L3 imports nothing from this package
- L0 has no imports

---

## 4. Token Lifecycle

```
Authorization Code
  - TTL: 10 minutes
  - Single-use (marked used on first exchange)
  - Contains: clientId, userId, scopes, codeChallenge, redirectUri

Access Token (JWT)
  - TTL: 1 hour (3600 seconds)
  - Signed with HMAC-SHA256
  - Claims: sub, client_id, scope, iat, exp, jti
  - Revoked by storing SHA-256 hash in revokedTokens[]

Refresh Token
  - TTL: 30 days
  - Stored as SHA-256 hash only (raw value returned to client once)
  - Rotated on each use — old token is removed from state
  - Revoked by moving hash to revokedTokens[]
```

---

## 5. Example Request → Response

### Step 1: Register a client
```typescript
import { registerClient, INITIAL_STATE } from "./index.js";

const { nextState } = registerClient(
  {
    clientId: "my-app",
    clientSecret: "s3cr3t",
    name: "My Application",
    redirectUris: ["https://myapp.com/callback"],
    allowedScopes: ["read", "write"],
  },
  INITIAL_STATE,
);
```

### Step 2: Authorize (get auth code)
```typescript
import { authorize } from "./index.js";

const result = authorize(
  {
    grantType: "authorization_code",
    clientId: "my-app",
    redirectUri: "https://myapp.com/callback",
    scopes: ["read"],
    userId: "user-123",
    codeChallenge: "<sha256_base64url_of_verifier>",
    codeChallengeMethod: "S256",
    consentGiven: true,
  },
  nextState,
);

// result.authCode => "abc123..."
// result.output => { success: true, logs: [...] }
```

### Step 3: Exchange code for tokens
```typescript
import { issueToken } from "./index.js";

const tokenResult = issueToken(
  {
    grantType: "authorization_code",
    clientId: "my-app",
    clientSecret: "s3cr3t",
    code: result.authCode,
    codeVerifier: "<original_random_verifier>",
    redirectUri: "https://myapp.com/callback",
  },
  result.nextState,
);

// tokenResult.output => {
//   success: true,
//   accessToken: "eyJ...",
//   refreshToken: "a8f3...",
//   expiresIn: 3600,
//   scope: "read",
//   logs: [...]
// }
```

### Step 4: Refresh tokens
```typescript
import { refreshToken } from "./index.js";

const refreshed = refreshToken(
  {
    grantType: "refresh_token",
    clientId: "my-app",
    clientSecret: "s3cr3t",
    refreshToken: tokenResult.output.refreshToken,
  },
  tokenResult.nextState,
);
```

### Step 5: Revoke a token
```typescript
import { revokeToken } from "./index.js";

const revoked = revokeToken(
  {
    grantType: "authorization_code",
    clientId: "my-app",
    clientSecret: "s3cr3t",
    tokenToRevoke: tokenResult.output.refreshToken,
  },
  tokenResult.nextState,
);
```

---

## Security Properties

| Control | Implementation |
|---------|---------------|
| PKCE enforced | S256 only; code_challenge required on /authorize |
| Short-lived access tokens | 1-hour JWT with exp claim |
| Hashed refresh tokens | SHA-256; raw value never stored |
| Client secret validation | SHA-256 hash comparison with timing-safe equals |
| Scope restriction | Requested scopes must be subset of client's allowedScopes |
| Auth code single-use | Marked `used: true` immediately on exchange |
| Auth code short TTL | 10-minute expiry |
| Token revocation | Both access and refresh tokens revocable by hash |
| Frozen outputs | All output objects are `Object.freeze()`'d |
