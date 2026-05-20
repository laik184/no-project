# MFA Module — HVP-Compliant Architecture

## 1. MFA Flow (Enroll → Verify → Enable → Login Verify)

### Full lifecycle

```
User                         MFA Orchestrator                  Agents
 |                                  |                              |
 |-- enrollMFA(TOTP) -------------> |                              |
 |                                  |-- generateTOTP() ----------> |
 |                                  |   (secret + QR URI)          |
 |                                  |-- enrollUser(TOTP) -------> |
 |                                  |-- generateBackupCodes() ---> |
 |<-- { qrCodeUri, backupCodes } ---|                              |
 |                                  |                              |
 | [User scans QR in authenticator app]                            |
 |                                  |                              |
 |-- enableMFA(code: "123456") ---> |                              |
 |                                  |-- verifyTOTP(code) -------> |
 |                                  |-- enableMFA(userId) ------> |
 |<-- { success: true } ------------|                              |
 |                                  |                              |
 | [Later: login attempt]           |                              |
 |                                  |                              |
 |-- verifyMFA(code: "789012") ---> |                              |
 |                                  |-- validateMFARequest() ----> |
 |                                  |-- incrementAttempts() -----> |
 |                                  |-- verifyTOTP(code) -------> |
 |                                  |-- resetAttempts() ---------> |
 |<-- { verified: true } -----------|                              |
```

### OTP Flow (alternative)

```
User
 |-- enrollMFA(OTP, channel=EMAIL, destination=user@x.com) -->
 |   enrollUser → sendOTP → generateBackupCodes
 |<-- { success: true, backupCodes: [...] }
 |
 |-- enableMFA(code received in email) -->
 |   verifyOTP → enableMFA
 |<-- { verified: true }
 |
 |-- verifyMFA(code: "943210", method: OTP) -->
 |   validateMFARequest → incrementAttempts → verifyOTP → resetAttempts
 |<-- { verified: true }
```

---

## 2. File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|----------------|
| `types.ts` | All TypeScript interfaces and union types. No logic. |
| `state.ts` | Immutable `MFAState`, `INITIAL_STATE`, and `transitionState()`. |

### L1 — Orchestrator

| File | Responsibility |
|------|----------------|
| `orchestrator.ts` | Coordinates all MFA flows: enroll, enable, verify, disable. No business logic — pure delegation to agents. |

### L2 — Agents

| File | Responsibility |
|------|----------------|
| `totp-generator.agent.ts` | Generates a Base32 TOTP secret, builds the `otpauth://` URI and QR code URL. |
| `totp-verifier.agent.ts` | Verifies a 6-digit TOTP code using HMAC-SHA1 across a ±1 time-step window. |
| `otp-sender.agent.ts` | Generates a 6-digit OTP, stores it (hashed expiry), dispatches via pluggable send function. |
| `otp-verifier.agent.ts` | Matches submitted OTP against pending record; enforces expiry and single-use. |
| `backup-code.agent.ts` | Generates 10 random backup codes (stored as SHA-256 hashes); validates one-time use. |
| `mfa-enrollment.agent.ts` | Creates or updates a `MFAUserRecord`; activates/deactivates MFA flag. |
| `mfa-validator.agent.ts` | Gate-checks: user exists, MFA is enabled, attempts not exceeded. Manages attempt counting. |

### L3 — Utils

| File | Responsibility |
|------|----------------|
| `hash.util.ts` | SHA-256, HMAC-SHA1, Base32 encode/decode, timing-safe compare, secure random. |
| `secret-generator.util.ts` | Generates TOTP secrets (Base32), 6-digit OTP codes, and backup code strings. |
| `qr-generator.util.ts` | Builds `otpauth://totp/…` URIs and QR code data URIs (via external QR service). |
| `time-window.util.ts` | TOTP time step math, OTP expiry, max-attempt constants. |
| `logger.util.ts` | Structured log/error string builders with ISO timestamp and source label. |

---

## 3. Import Flow

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/totp-generator.agent.ts (L2)
        │     └── utils/hash.util.ts, qr-generator.util.ts, logger.util.ts, secret-generator.util.ts (L3)
        ├── agents/totp-verifier.agent.ts (L2)
        │     └── utils/hash.util.ts, logger.util.ts, time-window.util.ts (L3)
        ├── agents/otp-sender.agent.ts (L2)
        │     └── utils/logger.util.ts, secret-generator.util.ts, time-window.util.ts (L3)
        ├── agents/otp-verifier.agent.ts (L2)
        │     └── utils/logger.util.ts, time-window.util.ts (L3)
        ├── agents/backup-code.agent.ts (L2)
        │     └── utils/hash.util.ts, logger.util.ts, secret-generator.util.ts (L3)
        ├── agents/mfa-enrollment.agent.ts (L2)
        │     └── utils/hash.util.ts, logger.util.ts (L3)
        ├── agents/mfa-validator.agent.ts (L2)
        │     └── utils/logger.util.ts, time-window.util.ts (L3)
        ├── state.ts (L0)
        └── types.ts (L0)
```

**Rules enforced:**
- L1 imports L2, L3, L0 only
- L2 imports L3 and L0 only — zero agent-to-agent imports
- L3 is import-free within this package
- L0 has no imports

---

## 4. OTP vs TOTP

| Property | OTP | TOTP |
|----------|-----|------|
| Full name | One-Time Password | Time-based One-Time Password |
| Standard | Custom | RFC 6238 (TOTP) / RFC 4226 (HOTP) |
| Delivery | SMS or Email | Authenticator app (Google Auth, Authy) |
| Generation | Server-generated, sent to user | User's app generates from shared secret |
| Validity | Time-limited (10 min TTL) | One 30-second time window (±1 drift) |
| Storage | Server stores the code (expiring) | Server stores only the shared secret hash |
| Network risk | Code travels over SMS/Email | No code transmission — shared secret only |
| UX | Requires network/carrier | Works offline |

---

## 5. Security Rules

| Rule | Implementation |
|------|---------------|
| OTP expiry | 10-minute TTL enforced in `otp-verifier` via `isOTPExpired()` |
| OTP single-use | Marked `used: true` immediately on successful verification |
| TOTP time window | ±1 step (30s each side) to tolerate clock drift; prevents replay within window |
| Backup codes one-time use | SHA-256 hashed; `used: true` + `usedAt` recorded on consumption |
| Max retry attempts | Hard limit of 5 attempts per user (`MAX_ATTEMPTS`); blocked on breach |
| TOTP secret storage | Secret stored raw in `pendingTOTP` (in-memory only during enrollment); only SHA-256 hash persisted in `MFAUserRecord` |
| Timing-safe compare | `timingSafeCompare()` used for all secret/code comparisons |
| Frozen outputs | All `MFAResponse` objects wrapped in `Object.freeze()` |
| Attempt reset | Successful verification always resets attempt counter |

---

## 6. Example Usage

```typescript
import { enrollMFA, enableMFA, verifyMFA, disableMFA, INITIAL_STATE } from "./index.js";

// Step 1: Enroll with TOTP
const enrollment = enrollMFA(
  {
    userId: "user-abc",
    method: "TOTP",
    issuer: "MyApp",
  },
  INITIAL_STATE,
);
// enrollment.qrCodeUri  → show QR to user
// enrollment.backupCodes → show once and store securely

// Step 2: Enable after user scans QR and submits first code
const enabled = enableMFA(
  {
    userId: "user-abc",
    method: "TOTP",
    code: "123456",
  },
  enrollment.nextState,
);

// Step 3: Verify at login
const verified = verifyMFA(
  {
    userId: "user-abc",
    method: "TOTP",
    code: "789012",
  },
  enabled.nextState,
);
// verified.output.verified → true/false

// Step 4: Disable MFA
const disabled = disableMFA(
  { userId: "user-abc", method: "TOTP" },
  verified.nextState,
);
```
