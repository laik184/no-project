# Chat Module Entrypoint Audit

**Date:** 2026-05-31
**Target:** `server/chat/index.ts` → single public entrypoint
**Auditor:** Senior Backend Architecture Refactoring Engineer

---

## 1. Dependency Graph (Before)

```
main.ts
 ├── import { chatOrchestrator }   from './server/chat/index.ts'   ← partial ✅
 └── import { runStartRouter }     from './server/chat/index.ts'   ← leaked name ⚠️

  chatOrchestrator.buildChatRouter()  → mounts  /api/chat/*          (line 41)
  runStartRouter                      → mounts  /api/run/*           (line 56) ⚠️ separate call
  chatOrchestrator.attachWebSocket(server)                            (line 63)
  chatOrchestrator.startPersistence()                                 (line 68)
```

`main.ts` knows about 3 distinct chat lifecycle steps AND the internal route shape (`/api/run`). That is the violation to fix.

---

## 2. server/chat/index.ts — Export Inventory

### Facade (consumed by main.ts)
| Export | Used externally | Notes |
|---|---|---|
| `chatOrchestrator.buildChatRouter()` | main.ts line 41 | Returns pre-built router |
| `chatOrchestrator.attachWebSocket(server)` | main.ts line 63 | Registers WS upgrade handler |
| `chatOrchestrator.startPersistence()` | main.ts line 68 | Starts heartbeat |
| `runStartRouter` (named export) | main.ts line 56 | Leaked internal path `/api/run` |

### Managers (re-exported for other modules)
`conversationManager`, `sessionManager`, `turnManager`, `streamManager`,
`messageBuilder`, `questionManager`, `answerManager`, `clarificationManager`,
`attachmentManager`, `timelineManager`, `chatStore`, `eventPublisher`

### Types
`ChatRun`, `RunStartPayload`, `RunStatus`, `ChatMessageRecord`, `MessageRole`,
`StreamChunk`, `ChatQuestion`, `AskQuestionPayload`, `AnswerPayload`,
`Conversation`, `ChatSession`, `ChatTurn`, `ChatEventType`, `ChatEvent`,
`TimelineEntry`, `TimelineEntryKind`

---

## 3. Audit Findings

### ✅ Already Correct
- Zero files outside `server/chat/**` import any internal subpath
- All 14 managers and 16 types are exported through `chat/index.ts`
- No circular dependency: no chat sub-module imports from `chat/index.ts`
- Internal cross-module calls (`→ orchestration/index.ts`, `→ memory/index.ts`) go via those modules' own public indexes

### ⚠️ Violations (Phase 2 targets)

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | `runStartRouter` imported by name in `main.ts` — main.ts must know the symbol AND call `app.use('/api/run', ...)` separately | `main.ts:12,56` | Medium |
| 2 | `chatOrchestrator` has 3 separate lifecycle methods: `buildChatRouter()`, `attachWebSocket()`, `startPersistence()` — main.ts must orchestrate all 3 in the correct order | `main.ts:41,63,68` | Medium |
| 3 | Mount path `/api/run` encoded in `main.ts` — the chat module should own its own mount paths | `main.ts:56` | Low |

---

## 4. Can chat/index.ts become the single public entrypoint?

**YES — with two additive changes to `chatOrchestrator`:**

1. Add `mountRoutes(app: Application)` — mounts `/api/chat/*` AND `/api/run/*` on the given Express app. Removes the need for main.ts to know route paths or import `runStartRouter` by name.

2. Add `bootstrap(server: Server)` — combines `attachWebSocket(server)` + `startPersistence()`. Collapses 2 lifecycle calls into 1.

Existing methods (`buildChatRouter`, `attachWebSocket`, `startPersistence`) are kept for backward compatibility — no deletions, only additions.

---

## 5. Lifecycle Ordering Analysis

```
Current order in main.ts:
  1. app.use('/api/chat',  chatOrchestrator.buildChatRouter())  ← route registration
  2. app.use('/api/run',   runStartRouter)                      ← route registration
  3. server = http.createServer(app)                            ← server creation
  4. chatOrchestrator.attachWebSocket(server)                   ← needs server
  5. chatOrchestrator.startPersistence()                        ← independent

After refactor:
  1. chatOrchestrator.mountRoutes(app)     ← routes registered before server created ✅
  2. server = http.createServer(app)       ← unchanged
  3. chatOrchestrator.bootstrap(server)    ← WS + heartbeat after server ✅

Ordering constraint satisfied: mountRoutes(app) is called before createServer(app).
No startup ordering risk.
```

---

## 6. Circular Dependency Risk

**None.** The two new methods only use values already imported at the top of `chat/index.ts`:
- `chatRouter` (already built at module scope)
- `runStartRouter` (already re-exported from `./api/run-start.router.ts`)
- `websocketManager`, `heartbeatManager` (already imported)

No new imports required.

---

## 7. Will any lifecycle break?

No. The refactor is purely additive on the `chat/index.ts` side, and the only `main.ts` change is replacing 3 calls with 2. All internal behavior is identical.

---

## 8. Recommendation

**Safe to proceed.** Minimum changes:
- `server/chat/index.ts`: add `mountRoutes` + `bootstrap` to `chatOrchestrator`
- `main.ts`: use `mountRoutes(app)` + `bootstrap(server)`, remove `runStartRouter` from import list
