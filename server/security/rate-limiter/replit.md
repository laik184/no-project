# Rate Limiter — HVP-Compliant Architecture

## 1. Rate Limiting Strategies

### Sliding Window
Tracks exact request timestamps within a rolling time period. No boundary burst problem.

```
Window: 60s, Max: 10 requests
t=0s   → [req]                    count=1  ✅
t=30s  → [req,req,req,req,req]    count=6  ✅
t=59s  → [req,req,req,req]        count=10 ✅
t=60s  → prune t<0s, count=9      count=9  ✅
t=61s  → prune t<1s, count=10     BLOCKED  ❌
```
Best for: precise limiting, short windows, user/IP abuse prevention.

---

### Token Bucket
Tokens refill continuously at a set rate. Allows bursts up to bucket capacity.

```
Capacity: 10, Refill: 1 token/s
t=0s   → tokens=10, request → tokens=9   ✅
t=0.1s → tokens=9.1, burst of 9 → t=0.1 ✅
t=1s   → tokens refilled to 1.1          ✅
t=1s   → request → tokens=0.1            ✅
t=1.1s → tokens=0.2, request → BLOCKED   ❌
```
Best for: burst-tolerant endpoints, public APIs, bursty traffic.

---

### Fixed Window
Counts requests in fixed time blocks. Simple, but vulnerable to boundary bursts.

```
Window: 60s, Max: 10
[00:00–01:00] count=10 → next window resets counter
Burst risk: 10 at 00:59 + 10 at 01:00 = 20 in 2 seconds
```
Best for: simple endpoints with low abuse risk, long windows.

---

## 2. Flow (Request → Limiter → Decision)

```
Incoming Request
       |
       ▼
orchestrator.checkLimit(context, state)
       |
       ├── 1. buildIpLimitKey(context)
       │         ↓
       │   checkIpBlock() → already blocked? → REJECT immediately
       │
       ├── 2. For each target (IP, USER, API_KEY):
       │         ↓
       │   resolveConfig(context, state, target)
       │         ↓
       │   selectStrategy(config)
       │         ↓
       │   ┌─────────────────────┐
       │   │ SLIDING_WINDOW      │   applySlidingWindow()
       │   │ TOKEN_BUCKET        │   applyTokenBucket()
       │   └─────────────────────┘
       │         ↓
       │   allowed? → YES → continue to next target
       │             → NO  → optionally block IP → REJECT
       │
       └── 3. All targets passed → ALLOW → { allowed: true, remaining, resetTime }
```

---

## 3. File Responsibilities

### L0 — Foundation

| File | Responsibility |
|------|----------------|
| `types.ts` | All TypeScript types: `RateLimitConfig`, `LimitStrategy`, `RequestContext`, `RateLimiterState`, output shapes. No logic. |
| `state.ts` | Immutable `RateLimiterState`, `INITIAL_STATE`, `transitionState()`. |

### L1 — Orchestrator

| File | Responsibility |
|------|----------------|
| `orchestrator.ts` | Sequences all limiter checks: IP block check → target loop → strategy dispatch → optional block write. No algorithm logic. |

### L2 — Agents

| File | Responsibility |
|------|----------------|
| `rate-limiter-generator.agent.ts` | Registers limiter configs into state with a structured key. Resolves active config per request context. |
| `ip-limiter.agent.ts` | Builds IP-scoped limit keys. Checks, writes, and reads IP block entries. |
| `user-limiter.agent.ts` | Builds user-scoped limit keys. Describes user limit state. |
| `api-key-limiter.agent.ts` | Builds hashed API-key-scoped limit keys (never stores raw key). |
| `sliding-window.agent.ts` | Implements the rolling timestamp algorithm. Prunes expired timestamps, enforces max count. |
| `token-bucket.agent.ts` | Implements the token refill algorithm. Handles burst capacity and steady-state throttling. |
| `limiter-strategy-selector.agent.ts` | Selects the best algorithm based on config shape (burst settings → TOKEN_BUCKET, short window → SLIDING_WINDOW). |

### L3 — Utils

| File | Responsibility |
|------|----------------|
| `time-window.util.ts` | Window start calculation, timestamp pruning, expiry checks. |
| `key-builder.util.ts` | Builds scoped state keys: `ip:x.x.x.0:route`, `user:id:route`, `apikey:<hash>:route`. |
| `counter.util.ts` | Remaining count math, allowed check, token refill calculation. |
| `hash.util.ts` | SHA-256 short hash for key anonymization; IP subnet anonymization. |
| `logger.util.ts` | Structured log/error strings with ISO timestamps and source labels. |

---

## 4. Import Graph

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/rate-limiter-generator.agent.ts (L2)
        │     └── utils/key-builder.util.ts, logger.util.ts (L3)
        ├── agents/ip-limiter.agent.ts (L2)
        │     └── utils/key-builder.util.ts, logger.util.ts, time-window.util.ts (L3)
        ├── agents/user-limiter.agent.ts (L2)
        │     └── utils/key-builder.util.ts, logger.util.ts (L3)
        ├── agents/api-key-limiter.agent.ts (L2)
        │     └── utils/key-builder.util.ts, logger.util.ts (L3)
        ├── agents/sliding-window.agent.ts (L2)
        │     └── utils/counter.util.ts, logger.util.ts, time-window.util.ts (L3)
        ├── agents/token-bucket.agent.ts (L2)
        │     └── utils/counter.util.ts, logger.util.ts, time-window.util.ts (L3)
        ├── agents/limiter-strategy-selector.agent.ts (L2)
        │     └── types.ts (L0)
        ├── state.ts (L0)
        └── types.ts (L0)
```

**Rules enforced:**
- L1 imports L2, L3, L0 only
- L2 imports L3 and L0 only — zero agent-to-agent imports
- L3 is self-contained
- L0 has no imports

---

## 5. Example Usage

```typescript
import { createRateLimiter, checkLimit, resetLimits, INITIAL_STATE } from "./index.js";

// Step 1: Register a limiter config (e.g. at app startup)
const { nextState: s1 } = createRateLimiter(
  {
    target: "IP",
    strategy: "SLIDING_WINDOW",
    maxRequests: 100,
    windowMs: 60_000,
    blockDurationMs: 300_000,
    routeKey: "/api/login",
  },
  INITIAL_STATE,
);

// Step 2: Check on every incoming request
const context = {
  ip: "203.0.113.42",
  userId: "user-abc",
  route: "/api/login",
  timestamp: Date.now(),
};

const result = checkLimit(context, s1);
// result.output → {
//   success: true,
//   allowed: true,
//   remaining: 99,
//   resetTime: <ms>,
//   logs: [...]
// }

// Step 3: After 100 requests in 60s
const blocked = checkLimit(context, result.nextState);
// blocked.output.allowed → false
// blocked.output.error   → "rate_limit_exceeded"

// Step 4: Reset limits for a key (e.g. after admin unblock)
const reset = resetLimits("ip:203.0.113.0::/api/login", blocked.nextState);
```

---

## Security Properties

| Threat | Mitigation |
|--------|-----------|
| Brute-force login | IP limiter on `/api/login` with `SLIDING_WINDOW` + `blockDurationMs` |
| Credential stuffing | Per-user limiter catches distributed single-IP attacks |
| API abuse | API key limiter with `TOKEN_BUCKET` for burst protection |
| Header spoofing | IP anonymization via subnet masking before key build |
| Raw key exposure | API keys hashed with SHA-256 before building state keys — never stored raw |
| Boundary burst | `SLIDING_WINDOW` selected automatically for short windows |
| DDoS bursts | `TOKEN_BUCKET` with configurable `burstCapacity` smooths spikes |
| Cascading state | All state transitions via `transitionState()` — immutable, no mutation |
