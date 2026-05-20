# API Key Manager — HVP-Compliant Architecture

## 1. API Key Lifecycle

```
GENERATION          VALIDATION              ROTATION             REVOCATION
     |                   |                      |                     |
  generate()          validate()            rotate()             (set state=REVOKED)
     |                   |                      |                     |
  hash(raw)         hash(incoming)          generate new              |
  store hash        compare hashes          mark old ROTATED          |
  return raw        check expiry            store new hash            |
  (shown once)      check state             return new raw            |
                    check permissions       (shown once)              |
                    check rate limit                                  |
                    track usage                                       |
                         |
                    ACTIVE / BLOCKED
```

### State transitions

```
ACTIVE  →  ROTATED   (key replaced by rotation)
ACTIVE  →  EXPIRED   (expiresAt passed, auto-set on next validation)
ACTIVE  →  REVOKED   (manual revocation)
```

---

## 2. Generation → Hashing → Validation Flow

```
Client                        Orchestrator                        Agents
  |                               |                                  |
  |-- generateApiKey(ownerId) --> |                                  |
  |                               |-- key-generator.agent ---------->|
  |                               |   buildApiKey("nxk")             |
  |                               |   sha256Hex(raw) → keyHash       |
  |                               |   store { id, keyHash, prefix }  |
  |<-- { key: "nxk_abc...", id } -|                                  |
  |   [raw key shown once only]   |                                  |
  |                               |                                  |
  |-- validateApiKey(raw) ------> |                                  |
  |                               |-- key-validator.agent ----------->|
  |                               |   sha256Hex(raw) → compare hash  |
  |                               |   check state, expiry            |
  |                               |-- permission-checker.agent ------>|
  |                               |   check required permission       |
  |                               |-- rate-limiter.agent ------------>|
  |                               |   per-minute + per-day window     |
  |                               |-- usage-tracker.agent ----------->|
  |                               |   increment total + daily counts  |
  |<-- { valid: true, usage: N } -|                                  |
```

---

## 3. File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|----------------|
| `types.ts` | All TypeScript interfaces: `ApiKey`, `ApiKeyMetadata`, `UsageRecord`, `RateLimitConfig`, `ValidationResult`, state and output shapes. No logic. |
| `state.ts` | Immutable `ApiKeyManagerState`, `INITIAL_STATE`, and `transitionState()`. |

### L1 — Orchestrator

| File | Responsibility |
|------|----------------|
| `orchestrator.ts` | Coordinates all key management flows: generate, validate, rotate, track usage. No business logic — pure sequencing of agents. |

### L2 — Agents

| File | Responsibility |
|------|----------------|
| `key-generator.agent.ts` | Creates a secure `nxk_<64-hex>` key. Hashes it immediately with SHA-256. Stores the hash + metadata. Returns the raw key once. |
| `key-validator.agent.ts` | Hashes the incoming key, finds the matching record using timing-safe comparison, validates state and expiry. |
| `key-hasher.agent.ts` | Pure SHA-256 hashing and timing-safe hash comparison. Used as a focused utility agent. |
| `key-rotation.agent.ts` | Generates a new key, marks the old one `ROTATED`, returns the new raw key. Preserves permissions and owner. |
| `usage-tracker.agent.ts` | Increments `totalRequests` and `dailyRequests` (with rolling daily window reset). |
| `rate-limiter.agent.ts` | Enforces per-minute and per-day request limits per key, with sliding window tracking. |
| `permission-checker.agent.ts` | Validates that the key's `permissions[]` includes the required permission (or `"*"` wildcard). |

### L3 — Utils

| File | Responsibility |
|------|----------------|
| `crypto.util.ts` | SHA-256 hashing, secure random bytes, timing-safe string comparison. |
| `token-format.util.ts` | Builds `prefix_hexsecret` key format; validates key format with regex. |
| `time.util.ts` | Expiry checks, day/minute window helpers, `nowMs()`. |
| `id-generator.util.ts` | Generates `key_<24-hex>` IDs for new keys. |
| `logger.util.ts` | Structured log/error strings with ISO timestamp and source label. |

---

## 4. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/key-generator.agent.ts (L2)
        │     └── utils/crypto.util.ts, token-format.util.ts, id-generator.util.ts, logger.util.ts, time.util.ts (L3)
        ├── agents/key-validator.agent.ts (L2)
        │     └── utils/crypto.util.ts, token-format.util.ts, logger.util.ts, time.util.ts (L3)
        ├── agents/key-hasher.agent.ts (L2)
        │     └── utils/crypto.util.ts, logger.util.ts (L3)
        ├── agents/key-rotation.agent.ts (L2)
        │     └── utils/crypto.util.ts, token-format.util.ts, id-generator.util.ts, logger.util.ts, time.util.ts (L3)
        ├── agents/usage-tracker.agent.ts (L2)
        │     └── utils/logger.util.ts, time.util.ts (L3)
        ├── agents/rate-limiter.agent.ts (L2)
        │     └── utils/logger.util.ts, time.util.ts (L3)
        ├── agents/permission-checker.agent.ts (L2)
        │     └── utils/logger.util.ts (L3)
        ├── state.ts (L0)
        └── types.ts (L0)
```

**Rules enforced:**
- L1 imports L2, L3, L0 only
- L2 imports L3 and L0 only — zero agent-to-agent imports
- L3 is self-contained, no intra-package imports
- L0 has no imports

---

## 5. Example Request Validation

```typescript
import { generateApiKey, validateApiKey, rotateApiKey, trackUsage, INITIAL_STATE } from "./index.js";

// Step 1: Generate a key
const gen = generateApiKey(
  {
    ownerId: "user-xyz",
    name: "Production API Key",
    permissions: ["read", "write"],
    expiresInDays: 90,
  },
  INITIAL_STATE,
);
// gen.output.key     → "nxk_a3f9...c4d2" (shown once — store securely)
// gen.output.keyId   → "key_8a1b2c3d4e5f..."
// gen.output.success → true

// Step 2: Validate on each API request
const validation = validateApiKey(
  {
    rawKey: "nxk_a3f9...c4d2",
    requiredPermission: "write",
  },
  gen.nextState,
);
// validation.output → {
//   success: true,
//   valid: true,
//   keyId: "key_8a1b...",
//   usage: 1,
//   logs: [...]
// }

// Step 3: Rotate a key
const rotation = rotateApiKey(
  {
    keyId: gen.output.keyId!,
    expiresInDays: 90,
  },
  validation.nextState,
);
// rotation.output.key → new raw key (old key marked ROTATED)

// Step 4: Track standalone usage
const usage = trackUsage(
  { keyId: gen.output.keyId! },
  rotation.nextState,
);
// usage.output.usage → total request count
```

---

## Security Properties

| Control | Implementation |
|---------|---------------|
| Raw key never stored | SHA-256 hash stored immediately in `key-generator`; raw returned once |
| Timing-safe comparison | `timingSafeCompare()` in `key-validator` — no early-exit hash leaks |
| Format validation | Regex `/^[a-z0-9]+_[a-f0-9]{64}$/` before any hash lookup |
| Key expiry | `isExpired()` on every validation; state auto-updated to `EXPIRED` |
| Rate limiting | Per-minute sliding window + daily hard cap per key |
| Permission scoping | Per-key `permissions[]` array; `"*"` wildcard for admin keys |
| Rotation safety | Old key marked `ROTATED` and immediately invalid; new key returned once |
| Frozen outputs | All `ApiKeyOutput` objects wrapped in `Object.freeze()` |
| Usage auditing | Every successful validation is logged with timestamp and counts |
