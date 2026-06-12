# Error Recovery Doc

> How NURAX detects, classifies, retries, self-heals, and escalates failures — from a single bad tool call to a full agent run breakdown.

---

## Design Philosophy

NURAX is **fail-closed**. Every failure path must:

1. Be classified into a known error type before any recovery decision is made
2. Attempt autonomous repair (up to a hard cap) before surfacing to the user
3. Never silently swallow an error — if recovery is impossible, escalate explicitly
4. Leave a checkpoint before every repair attempt so rollback is always available

---

## Error Hierarchy

**Base file:** `server/shared/errors/base-app-error.ts`  
**Types file:** `server/shared/errors/error-types.ts`

All errors extend `BaseAppError`, which carries:

```typescript
class BaseAppError extends Error {
  code: string;          // machine-readable identifier
  severity: Severity;    // 'low' | 'medium' | 'high' | 'critical'
  context?: object;      // structured metadata for debugging
  recoverable: boolean;  // drives retry vs abort decisions
}
```

### Error Type Catalogue

| Class | Severity | Recoverable | Trigger |
|---|---|---|---|
| `ValidationError` | low | true | Bad input schema, missing required field |
| `LLMError` | high | true* | OpenRouter API failure, bad response format |
| `ToolError` | medium | true | Tool handler threw, invalid args |
| `ToolNotFoundError` | high | false | Agent called unregistered tool name |
| `FilesystemError` | medium | true | ENOENT, EPERM in sandbox |
| `AgentError` | high | true | General agent lifecycle failure |
| `PlannerError` | high | false | Planner could not produce a valid plan |
| `ExecutorError` | medium | true | Task execution failure |
| `BuildError` | medium | true | Vite/tsc compilation error |
| `VerificationError` | medium | true | Verifier phase returned errors |

> *`LLMError` is recoverable unless the cause is a missing API key (`ConfigurationError` subclass), which is immediately unrecoverable.

---

## Layer 1 — Global Safety Net

**File:** `server/shared/errors/global-handlers.ts`  
**Installed by:** `installGlobalHandlers()` in `main.ts` before anything else boots

Catches process-level exceptions that escape all other handlers:

```typescript
process.on('uncaughtException', (err) => {
  logError(err);
  if (isFatal(err)) process.exit(1);  // e.g. EADDRINUSE
  // else: log and continue — server stays alive
});

process.on('unhandledRejection', (reason) => {
  logError(reason);
  // never crashes the process on rejection alone
});
```

Fatal conditions that still trigger `process.exit(1)`:
- `EADDRINUSE` — port already bound, server cannot start
- OOM / heap exhaustion signals

---

## Layer 2 — Express Error Middleware

**File:** `server/shared/errors/express-error-middleware.ts`  
**Mounted by:** `app.use(expressErrorMiddleware)` — last middleware in `registerRoutes()`

Catches all unhandled route-level errors and serialises them into a consistent API envelope:

```typescript
// Every unhandled route error becomes:
{
  ok: false,
  error: {
    code: "TOOL_ERROR",
    message: "readFile failed: ENOENT /sandbox/missing.ts",
    severity: "medium",
    requestId: "req_abc123"
  }
}
```

HTTP status mapping:
| Error class | HTTP status |
|---|---|
| `ValidationError` | 400 |
| `ToolNotFoundError` | 404 |
| `LLMError` | 502 |
| Everything else | 500 |

---

## Layer 3 — Orchestration Retry Manager

**File:** `server/orchestration/execution/retry-manager.ts`

Handles retry decisions at the orchestration phase level (not individual tool calls). Called after each wave of execution completes.

**Default config:**
```
maxAttempts: 3
backoff: 500ms exponential (500 → 1000 → 2000ms)
```

**Decision function — `buildRetryDecision(failure, attempt, context)`:**

| Condition | Decision |
|---|---|
| `recoverable: false` | `abort` |
| `workflowCritical: true` + retries exhausted | `abort` |
| Phase is optional + non-critical failure | `skip` |
| Retries remaining | `retry` |
| Default | `continue` (log and move on) |

---

## Layer 4 — Agent Self-Healing Loop

**File:** `server/agents/executor/recovery/self-healing-loop.ts`

The deepest recovery layer. When a task fails inside an agent run, the self-healing loop kicks in before surfacing the error to the user.

### Cycle limit

```
MAX_HEAL_CYCLES = 3
```

After 3 failed heal cycles, state transitions to `ESCALATED`.

### Heal cycle flow

```
Task Fails
    │
    ▼
1. Create Checkpoint          ← snapshot files + memory state
    │
    ▼
2. Analyze Failure            ← RecoveryEngine classifies failure type
    │
    ▼
3. Build RecoveryPlan         ← choose repair strategy
    │
    ▼
4. Execute Repair             ← apply fix or rollback
    │
    ▼
5. Re-execute Task            ← try original task again
    │
    ├── Success → continue run
    └── Failure → loop (up to MAX_HEAL_CYCLES), then ESCALATED
```

### Recovery Engine

**File:** `server/agents/executor/recovery/recovery-engine.ts`

Classifies the failure and selects a repair strategy:

| Failure type detected | Recovery strategy |
|---|---|
| TypeScript compile errors | `patch-recovery` — CoderX re-runs with error context |
| Missing npm package | `install-recovery` — Terminal agent runs `npm install` |
| Playwright / browser crash | `browser-restart` — Browser agent relaunches |
| File not found (ENOENT) | `scaffold-recovery` — Filesystem agent creates missing paths |
| LLM parse error (bad JSON) | `prompt-retry` — Retry with correction appended |
| Unknown / unclassified | `rollback` — Revert to last checkpoint |

### Rollback Manager

**File:** `server/agents/executor/recovery/rollback-manager.ts`

Before every heal cycle, a checkpoint is created:
- Modified files are snapshotted to a temp location inside `sandboxRoot`
- In-memory working state is captured

On rollback:
1. All files modified since the checkpoint are reverted
2. Working memory is restored to checkpoint state
3. A `recovery.rollback` event is emitted to the EventBus (visible in the UI)

---

## Layer 5 — Escalation

When `MAX_HEAL_CYCLES` is exhausted or a failure is classified as unrecoverable:

1. Run state transitions to `ESCALATED`
2. A structured error summary is built (what failed, what was tried, last error)
3. The summary is streamed to the frontend via SSE
4. The user sees a clear explanation with the last known error and suggested next steps

Escalation never crashes the server — only the individual agent run is terminated.

---

## Execution State Machine

The self-healing loop cannot attempt recovery if the run is already in a terminal state:

```
PENDING → RUNNING → COMPLETED
                  → FAILED → (self-healing) → RUNNING
                                            → ESCALATED
                  → CANCELLED  (terminal, no recovery)
```

Attempting `healCycle()` when state is `CANCELLED` or `COMPLETED` is a no-op with a warning log.

---

## Key Files Reference

| File | Role |
|---|---|
| `server/shared/errors/base-app-error.ts` | Base error class |
| `server/shared/errors/error-types.ts` | All error subclasses |
| `server/shared/errors/global-handlers.ts` | Process-level safety net |
| `server/shared/errors/express-error-middleware.ts` | HTTP error serialisation |
| `server/orchestration/execution/retry-manager.ts` | Phase-level retry decisions |
| `server/agents/executor/recovery/self-healing-loop.ts` | Autonomous repair loop |
| `server/agents/executor/recovery/recovery-engine.ts` | Failure classification + repair plans |
| `server/agents/executor/recovery/rollback-manager.ts` | Checkpoint + file revert |
