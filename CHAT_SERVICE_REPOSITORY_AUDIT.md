# Chat Service Repository Audit

**Scope:** `server/services/chat/*.ts` → `server/repositories/chat/index.ts`

**Date:** 2026-06-04

---

## Summary

No service in `server/services/chat/` should directly import from `server/repositories/chat/`.

All persistence in this layer is already correctly routed through intermediate persistence facades:

| Facade | Used by | Wraps |
|---|---|---|
| `runWriter` (`chat/persistence/run-writer.ts`) | `chat.service.ts` | `runRepository` |
| `messageBuilder` (`chat/messages/message-builder.ts`) | `chat.service.ts` | `messageRepository` |
| `chatCheckpointStore` (`chat/persistence/checkpoint-store.ts`) | `checkpoint.service.ts` | disk / file-based store |
| `contextLoader` (`chat/context/context-loader.ts`) | `context.service.ts` | `messageRepository` (indirectly) |

The repository layer sits **below** the persistence facades, not below the services.

---

## Per-File Audit

---

### `chat.service.ts`

**Reads data?** NO (direct)
**Writes data?** YES — `runWriter.create()`, `runWriter.setStatus()`, `messageBuilder.buildUser()`
**Updates data?** YES — `runWriter.setStatus()` (status transitions)
**Deletes data?** NO
**Requires repository access?** NO

**Reason:** Persistence is correctly delegated to `runWriter` (run records) and `messageBuilder` (user messages). Both are purpose-built facades over the repository layer. Importing `runRepository` or `messageRepository` directly here would bypass the persistence contract and duplicate the routing logic.

**Needs Repository:** NO
**Repositories Required:** None (persistence already handled by `runWriter` + `messageBuilder`)

---

### `checkpoint.service.ts`

**Reads data?** YES — `chatCheckpointStore.listByProject()`, `chatCheckpointStore.findById()`
**Writes data?** YES — `chatCheckpointStore.createForRun()`, `chatCheckpointStore.createManual()`
**Updates data?** NO
**Deletes data?** YES — `chatCheckpointStore.deleteCheckpoint()`
**Requires repository access?** NO

**Reason:** This service is a pure pass-through facade over `chatCheckpointStore`. The store owns checkpoint serialisation and disk I/O; no DB-level repository is involved. All persistence is handled one layer below via the store.

**Needs Repository:** NO
**Repositories Required:** None (persistence delegated to `chatCheckpointStore`)

---

### `context.service.ts`

**Reads data?** YES — `contextLoader.loadForRun()`, `contextLoader.loadForProject()`
**Writes data?** NO
**Updates data?** NO
**Deletes data?** NO (cache invalidation only via `contextLoader.invalidate()`)
**Requires repository access?** NO

**Reason:** All data loading is delegated to `contextLoader`. The loader internally queries `messageRepository` and related tables; the service itself has no DB surface. Adding a direct `messageRepository` import here would duplicate the loader's concern.

**Needs Repository:** NO
**Repositories Required:** None (reads delegated to `contextLoader`)

---

### `intent.service.ts`

**Reads data?** NO
**Writes data?** NO
**Updates data?** NO
**Deletes data?** NO
**Requires repository access?** NO

**Reason:** Pure deterministic keyword-scoring logic with no I/O of any kind. Input is a goal string; output is an `IntentResult`. No side effects.

**Needs Repository:** NO
**Repositories Required:** None

---

### `session.service.ts`

**Reads data?** NO (in-memory Map only)
**Writes data?** NO (in-memory Map only)
**Updates data?** NO (in-memory Map only)
**Deletes data?** NO (eviction from in-memory Map)
**Requires repository access?** NO

**Reason:** Explicitly documented as "not persisted". Maintains an ephemeral `Map<string, ChatSession>` for the lifetime of the process. Session data is intentionally transient — browser sessions do not need to survive restarts.

**Needs Repository:** NO
**Repositories Required:** None

---

### `turn.service.ts`

**Reads data?** NO (in-memory Map only)
**Writes data?** NO (in-memory Map only)
**Updates data?** NO (in-memory Map only)
**Deletes data?** NO (eviction from in-memory Map)
**Requires repository access?** NO

**Reason:** Explicitly documented as "not persisted". Maintains an ephemeral `Map<string, ChatTurn>`. Turn duration and status are tracked in-process only; durable run state lives in `agentRuns` via `runWriter`, not here.

**Needs Repository:** NO
**Repositories Required:** None

---

### `stream.service.ts`

**Reads data?** NO
**Writes data?** NO
**Updates data?** NO
**Deletes data?** NO
**Requires repository access?** NO

**Reason:** Manages an in-memory `Map<string, StreamState>` and emits SSE token events via `eventPublisher`. No persistence concern whatsoever — stream state is ephemeral by definition.

**Needs Repository:** NO
**Repositories Required:** None

---

### `responder.service.ts`

**Reads data?** NO
**Writes data?** NO
**Updates data?** NO
**Deletes data?** NO
**Requires repository access?** NO

**Reason:** Calls the LLM to generate a run summary then streams tokens via `streamManager`. No storage of any kind. The LLM response is streamed to the client and not persisted.

**Needs Repository:** NO
**Repositories Required:** None

---

### `clarification.service.ts`

**Reads data?** NO
**Writes data?** NO
**Updates data?** NO
**Deletes data?** NO
**Requires repository access?** NO

**Reason:** Runs ambiguity analysis (pure logic), creates an in-memory question via `questionManager`, emits a `QuestionAsked` SSE event, then polls for an answer. Entirely event-driven with no storage layer involved.

**Needs Repository:** NO
**Repositories Required:** None

---

## Services That Need Repositories

**None.** All persistence is handled through the correct intermediate facades.

---

## Services That Do NOT Need Repositories

| Service | Why Not |
|---|---|
| `chat.service.ts` | Persistence delegated to `runWriter` + `messageBuilder` |
| `checkpoint.service.ts` | Persistence delegated to `chatCheckpointStore` |
| `context.service.ts` | Reads delegated to `contextLoader` |
| `intent.service.ts` | Pure logic — no I/O |
| `session.service.ts` | In-memory only — intentionally ephemeral |
| `turn.service.ts` | In-memory only — intentionally ephemeral |
| `stream.service.ts` | In-memory + SSE events only |
| `responder.service.ts` | LLM generation + stream events only |
| `clarification.service.ts` | Logic + SSE events only |

---

## Imports Added

None. No service requires a new repository import.

---

## Unused Repository Imports Removed

None. No service currently imports from `repositories/chat/` — the slate is clean.

---

## Bug Found and Fixed

**File:** `server/repositories/chat/index.ts`
**Issue:** Stray `m` character before the opening JSDoc comment on line 1 (`m/**` instead of `/**`). Syntactically harmless in JS but semantically incorrect and misleading.
**Fix:** Removed the stray character.

---

## Final Dependency Graph

```
server/chat/*                          ← orchestration, controllers, API layer
      ↓
server/services/chat/*                 ← business facades (NO repository imports here)
      ↓
server/chat/persistence/*              ← runWriter, messageBuilder, chatCheckpointStore
server/chat/context/*                  ← contextLoader
      ↓
server/repositories/chat/index.ts      ← messageRepository, runRepository, attachmentRepository
      ↓
server/infrastructure/index.ts         ← db (Drizzle), shared/schema.ts
```

No service skips a layer. No service imports repositories directly.
The dependency direction is strictly top-down with no cycles.
