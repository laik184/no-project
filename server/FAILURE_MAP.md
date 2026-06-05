# FAILURE_MAP.md
**Generated:** 2026-06-05  
**Scope:** server/agents, server/tools, server/chat, server/orchestration, server/services, server/repositories, server/infrastructure

---

## Summary

| Category | Count |
|---|---|
| `throw new Error(...)` (raw) | 165 |
| `console.error` only (no user message) | 76 |
| `.catch(() => {})` silent swallows | 4 |
| Isolated error classes (no common base) | 17 |
| Global uncaught exception handler | ❌ None |
| Express error middleware | ❌ None |
| React Error Boundary | ❌ None |

---

## 1. Silent `.catch(() => {})` swallows

These failures are permanently lost — no log, no user notification.

| File | Line | Context |
|---|---|---|
| `server/chat/orchestration/chat-orchestrator.ts` | 77 | `runWriter.setStatus(..., 'completed').catch(() => {})` |
| `server/chat/orchestration/chat-orchestrator.ts` | 95 | `runWriter.setStatus(..., 'failed').catch(() => {})` |
| `server/chat/orchestration/chat-orchestrator.ts` | 171 | `_completeRun(run, turn.turnId).catch(() => {})` |
| `server/tools/browser/session/browser-engine.ts` | 68 | `live.browser.close().catch(() => {})` |

**Risk:** Run status may never be set to 'failed'. UI shows run as stuck-running forever.

---

## 2. Catch-and-log only (no user-facing message)

These failures are logged to stderr but the user receives no explanation.

| File | Pattern |
|---|---|
| `server/agents/chat/chat-agent.ts:140` | `catch (err) → console.error('[chat-agent] LLM call failed:', message)` |
| `server/agents/browser/browser-agent.ts:115` | `.catch(console.error)` on session cleanup |
| `server/agents/executor/executor-agent.ts:87,146,207` | Three separate catch blocks, each logs only |
| `server/agents/coderx/coderx-agent.ts:145` | Catch logs then re-throws (raw Error) |
| `server/agents/browser/events/browser-event-publisher.ts:24` | `catch { /* Never let publish errors propagate */ }` |

---

## 3. Raw `throw new Error(...)` (165 total)

Most `throw new Error(...)` calls expose internal Node.js error messages directly to the caller with no user-friendly wrapper, no errorId, and no recovery guidance.

**Key hotspots:**

| File | Pattern |
|---|---|
| `server/orchestration/core/orchestration-context.ts:69-72` | 4 structural throws with internal names |
| `server/agents/executor/planning/execution-planner.ts:18` | `PlannerError extends Error` — no errorId, no recovery |
| `server/tools/filesystem/write/write-file.ts` | `throw new Error(result.error ?? 'Failed to write file')` |
| `server/tools/browser/session/browser-session-tools.ts` | `throw new Error(result.error ?? 'Failed to launch browser session')` |
| `server/chat/attachments/file-processor.ts:12` | `throw new Error('File not found: ' + filePath)` |

---

## 4. Isolated error classes (17) with no shared base

Every module invented its own error class independently. None share fields like `errorId`, `recoverySuggestion`, or `severity`.

```
CoderXContextError       CodingValidationError    IntegrityValidationError (×3 duplicates)
ResponseValidationError  ExecutorContextError      PlannerError (executor)
StateMachineError        ExecutionValidationError  ToolValidationError
FilesystemContextError   OperationValidationError  PathValidationError
UserMessageError         ConversationError         ChatOrchestratorError
AnswerError              ToolNotFoundError (registry)
```

**Problem:** Callers must `instanceof`-check each type individually. There is no `.toJSON()` or `.toUserMessage()` method. Stack traces reach API responses unfiltered.

---

## 5. Missing global process handlers

No `process.on('uncaughtException', ...)` or `process.on('unhandledRejection', ...)` in `main.ts`.  
Any unhandled async rejection or synchronous throw outside a route handler will crash the process with no structured log.

---

## 6. Missing Express error middleware

No 4-argument `(err, req, res, next)` middleware registered in `main.ts`.  
Any error thrown inside a route handler that is not caught manually will:
- In Express 4: produce an empty HTTP 500 with no body
- Potentially expose a raw stack trace if the default error handler runs

---

## 7. Orchestration `.catch(() => {})` in fire-and-forget paths

`server/chat/orchestration/chat-orchestrator.ts` uses fire-and-forget patterns on run-lifecycle operations. If `runWriter.setStatus` fails, the run remains "running" in the DB indefinitely.
