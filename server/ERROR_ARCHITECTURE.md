# ERROR_ARCHITECTURE.md
**Generated:** 2026-06-05

---

## Design Goals

1. **No raw exception reaches the user** — every error is translated to a user-friendly message.
2. **Every error has an errorId** — for correlation between frontend display and server logs.
3. **Structured fields** — `title`, `message`, `recoverySuggestion` on every error.
4. **Layer-appropriate visibility** — technical details logged server-side; user-safe subset sent to client.
5. **Additive, not disruptive** — existing `{ ok: false, error: string }` patterns are preserved; new wrapper adds structure.

---

## Error Category Taxonomy

```
AppErrorType
├── ValidationError         — bad input, missing fields
├── AuthenticationError     — not signed in
├── AuthorizationError      — insufficient permissions
├── LLMError                — AI model unavailable or failed
├── ToolError               — tool execution failed
├── ToolNotFoundError       — tool not registered
├── FilesystemError         — ENOENT, EPERM, EACCES
├── BuildError              — compile/build failure
├── VerificationError       — agent verification failed
├── DeploymentError         — deployment failure
├── TimeoutError            — operation timeout
├── AgentError              — agent-level failure
├── PlannerError            — plan generation failure
├── ExecutorError           — executor task failure
├── DispatcherError         — tool dispatch failure
└── UnknownError            — any unclassified error
```

---

## Class Hierarchy

```
Error (built-in)
└── BaseAppError
    ├── ValidationError
    ├── AuthenticationError
    ├── AuthorizationError
    ├── LLMError
    ├── ToolError
    ├── ToolNotFoundError
    ├── FilesystemError
    ├── BuildError
    ├── VerificationError
    ├── DeploymentError
    ├── AppTimeoutError
    ├── AgentError
    ├── PlannerError
    ├── ExecutorError
    ├── DispatcherError
    └── UnknownError
```

---

## Fields on Every Error

```typescript
interface AppErrorFields {
  errorId:             string;   // UUID — for log correlation
  type:                AppErrorType;
  title:               string;   // User-facing, short (~5 words)
  message:             string;   // User-facing, one sentence
  technicalReason?:    string;   // Internal, never sent to client
  userReason?:         string;   // User-facing, more detail
  recoverySuggestion?: string;   // Action user can take
  severity:            'low' | 'medium' | 'high' | 'critical';
  timestamp:           string;   // ISO 8601
  context?:            Record<string, unknown>;  // Additional data
}
```

---

## Infrastructure Components

| File | Role |
|---|---|
| `server/shared/errors/base-app-error.ts` | BaseAppError class + AppErrorFields interface |
| `server/shared/errors/error-types.ts` | 15 typed subclasses |
| `server/shared/errors/error-factory.ts` | `ErrorFactory.wrap(err)` + typed constructors |
| `server/shared/errors/error-serializer.ts` | `serialize()`, `toUserFacingError()`, `toApiErrorBody()`, `logError()` |
| `server/shared/errors/global-handlers.ts` | `installGlobalHandlers()` — process.on uncaught/unhandled |
| `server/shared/errors/express-error-middleware.ts` | 4-arg Express error handler |
| `server/shared/errors/index.ts` | Public barrel — all consumers import from here |

---

## Error Flow (After Implementation)

```
Exception thrown anywhere in server code
  → ErrorFactory.wrap(err)         → BaseAppError (typed)
    → logError(err, context)       → stderr (with errorId + technicalReason)
      → toApiErrorBody(err)        → { ok: false, error: UserFacingError }
        → res.status(N).json(...)  → structured JSON to client

Client receives:
{
  ok: false,
  error: {
    errorId: "abc-123",
    type: "LLMError",
    title: "AI Provider Not Configured",
    message: "The system cannot reach an AI model...",
    recoverySuggestion: "Add OPENROUTER_API_KEY...",
    severity: "high",
    timestamp: "2026-06-05T..."
  }
}

Frontend:
  → reads error.title + error.message + error.recoverySuggestion
  → displays in toast (non-blocking) with errorId reference
  → no alert(), no raw JSON.stringify, no stack trace
```

---

## Frontend Components

| Component | Role |
|---|---|
| `client/src/components/ui/error-boundary.tsx` | React Error Boundary — prevents blank screen on render crash |
| `client/src/lib/app-error.ts` | `toastError(toast, err)` — converts API error to toast |

---

## Architecture Rules

```
tools/ → services/              ALLOWED  (tools call services)
services/ → repositories/       ALLOWED  (services call repos)
agents/ → tools/                ALLOWED  (agents dispatch tools)
shared/errors/ → (nothing)      ALLOWED  (no deps — pure utils)
anything → shared/errors/       ALLOWED  (errors are shared)
repositories/ → agents/         FORBIDDEN
tools/ → agents/                FORBIDDEN
services/ → orchestration/      FORBIDDEN
```
