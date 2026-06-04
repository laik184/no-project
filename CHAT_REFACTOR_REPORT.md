# CHAT_REFACTOR_REPORT.md
## Phase 4 — Refactor Completion Report
**Date:** 2026-06-04  
**Status:** ✅ COMPLETE — Server boots, all imports resolved  
**Files created:** 78 in `server/chat/`

---

## 1. What Was Done

### Problem
`server/chat/` did not exist. `main.ts` imported `chatOrchestrator` from `./server/chat/index.ts`, causing `ERR_MODULE_NOT_FOUND` on every startup. All 8 service files in `server/services/chat/` had broken imports pointing into the missing directory. The API server would not start.

### Solution
Created the complete `server/chat/` module from scratch in 8 parallel write batches, building from the innermost leaf modules outward to avoid dependency violations.

---

## 2. Files Created by Layer

### Layer 0 — Types (6 files)
Foundation type contracts. No internal imports — safe to load first.

| File | Exports |
|---|---|
| `types/chat.types.ts` | `ChatSession`, `ChatTurn`, `Conversation`, `ConversationStatus`, `TurnStatus`, `SessionStatus` |
| `types/run.types.ts` | `ChatRun`, `RunStartPayload`, `RunCancelResult`, `RunMode`, `RunStatus` |
| `types/message.types.ts` | `ChatMessageRecord`, `AssistantMessagePayload`, `UserMessagePayload`, `SystemMessagePayload`, `ToolCallRecord` |
| `types/checkpoint.types.ts` | `ChatCheckpoint`, `CheckpointTrigger`, `RollbackResult`, `SnapshotDiff` |
| `types/event.types.ts` | `ChatEventType`, `ChatEvent`, `StreamStartedEvent`, `StreamTokenEvent`, `StreamEndedEvent`, `RunStartedEvent`, `RunCompletedEvent`, `RunFailedEvent` |
| `types/question.types.ts` | `ChatQuestion`, `AskQuestionPayload`, `AnswerPayload`, `QuestionStatus`, `QuestionKind` |

### Layer 1 — Constants (3 files)

| File | Key Exports |
|---|---|
| `constants/chat.constants.ts` | `MAX_MESSAGE_LENGTH`, `MAX_ATTACHMENT_BYTES`, `UPLOAD_DIR`, `ACCEPTED_*_MIME_TYPES` |
| `constants/event.constants.ts` | `CHAT_EVENT`, `BUS_EVENT`, `CHAT_TOPIC` |
| `constants/stream.constants.ts` | `SSE_HEARTBEAT_MS`, `MAX_STREAM_DURATION_MS`, `ANSWER_POLL_MS`, `ANSWER_WAIT_TIMEOUT_MS`, `WS_PING_INTERVAL_MS` |

### Layer 2 — Events (6 files)
Event factory functions — stateless, pure.

| File | Produces |
|---|---|
| `events/run.events.ts` | `makeRunStartedEvent`, `makeRunCompletedEvent`, `makeRunFailedEvent` |
| `events/stream.events.ts` | `makeStreamStartedEvent`, `makeStreamTokenEvent`, `makeStreamEndedEvent` |
| `events/checkpoint.events.ts` | `makeCheckpointCreatedPayload`, `makeCheckpointRollbackPayload`, `makeCheckpointDeletedEvent` |
| `events/question.events.ts` | `makeQuestionAskedEvent`, `makeQuestionAnsweredEvent` |
| `events/chat.events.ts` | `makeMessageCreatedEvent`, `makeMessageUpdatedEvent` |
| `events/timeline.events.ts` | `makeTimelineEvent` |

### Layer 3 — Schemas (4 files) + Streams (1 file)

| File | Purpose |
|---|---|
| `schemas/run.schema.ts` | Zod: cancelRun, runId param, run context |
| `schemas/chat.schema.ts` | Zod: sendMessage, feedback, startRun |
| `schemas/question.schema.ts` | Zod: answer submission, questionId param |
| `schemas/attachment.schema.ts` | Zod: upload params |
| `streams/sse-utils.ts` | SSE frame serialization (writeSseEvent, writeSseComment, flushSse) |

### Layer 4 — Realtime (5 files)

| File | Responsibility |
|---|---|
| `realtime/event-publisher.ts` | Thin bus wrapper — `eventPublisher.publish(event)` → `bus.emit('agent.event', event)` |
| `realtime/sse-manager.ts` | Facade over `infraSseManager` for chat-specific stats |
| `realtime/connection-registry.ts` | In-memory registry of SSE connections by connId + projectId |
| `realtime/heartbeat-manager.ts` | SSE heartbeat ping tracker with stale-connection detection |
| `realtime/websocket-manager.ts` | WebSocket client registry, broadcast, typing indicators, WS ping loop |

### Layer 5 — Persistence (8 files)

| File | Wraps | Adds |
|---|---|---|
| `persistence/run-writer.ts` | `runRepository.create`, `setStatus` | Thin facade for write-only hot path |
| `persistence/run-store.ts` | `runRepository` | Read-only query facade |
| `persistence/message-store.ts` | `messageRepository` | Full CRUD facade |
| `persistence/attachment-store.ts` | `attachmentRepository` | Full CRUD facade |
| `persistence/conversation-store.ts` | In-memory Map | Conversation lifecycle, title derivation, message count tracking |
| `persistence/workspace-scanner.ts` | `fs.readdirSync` | Recursive workspace file scanner (skips binary, node_modules, .git) |
| `persistence/checkpoint-store.ts` | `checkpointRepository` + filesystem | Full checkpoint business logic: snapshot capture, rollback, diff, delete |
| `persistence/chat-store.ts` | `messageStore` + `runStore` | Unified history query facade |

**Key design decision — `checkpoint-store.ts`:**  
Snapshot file contents stored on disk at `.sandbox/.checkpoints/<checkpointId>.json`. DB stores only metadata (file counts, names, git SHA). Rollback reads the JSON snapshot and overwrites workspace files. This avoids bloating the DB with file content.

### Layer 6 — Messages (5 files)

| File | Responsibility |
|---|---|
| `messages/message-validator.ts` | Content sanitization + length validation |
| `messages/user-message.ts` | `buildUserPayload()` — validates + sanitizes user content |
| `messages/assistant-message.ts` | `buildAssistantPayload()` — assembles assistant message payload |
| `messages/system-message.ts` | `buildBaseSystemPayload()`, `buildContextInjectionPayload()` |
| `messages/message-builder.ts` | `messageBuilder` — persists messages + publishes chat.message.created events |

### Layer 7 — Questions (4 files)

| File | Responsibility |
|---|---|
| `questions/ambiguity-detector.ts` | Pattern-based goal ambiguity analysis (pure logic, no I/O) |
| `questions/question-manager.ts` | In-memory question lifecycle: create, answer, cancel, TTL expiry |
| `questions/answer-manager.ts` | `answerManager.submit()` — validates answer, calls questionManager, publishes event |
| `questions/clarification-manager.ts` | **Shim** → re-exports `clarificationManager` from `@services/chat` |

### Layer 8 — Context (4 files)

| File | Responsibility |
|---|---|
| `context/context-window.ts` | Sliding window and token budget trim for message lists |
| `context/context-cache.ts` | 30-second TTL cache for loaded contexts keyed by runId |
| `context/context-loader.ts` | Loads messages + run from DB, applies cache |
| `context/context-builder.ts` | `buildContext()` → applies sliding window, returns `BuiltContext`; `serializeContext()` for logging |

### Layer 9 — Timeline (5 files)

| File | Responsibility |
|---|---|
| `timeline/event-timeline.ts` | Core in-memory timeline store per runId with updateStatus |
| `timeline/timeline-publisher.ts` | Publishes timeline entries to event bus via eventPublisher |
| `timeline/timeline-manager.ts` | Combined append + publish for callers |
| `timeline/run-timeline.ts` | Phase start/end + recovery + lifecycle helpers |
| `timeline/tool-timeline.ts` | Tool call start/succeed/fail + file write recording |

### Layer 10 — Intent + LLM shims (2 files)

| File | What it shims |
|---|---|
| `intent/intent-router.ts` | Re-exports `routeIntent`, `isChatMode`, `intentService`, `IntentMode`, `IntentResult` from `@services/chat` |
| `llm/chat-responder.ts` | Re-exports `streamRunSummary`, `chatResponderService`, `responderService` from `@services/chat` |

### Layer 11 — Orchestration (5 files)

| File | Pattern |
|---|---|
| `orchestration/conversation-manager.ts` | **Real implementation** — delegates to `conversationStore` (in-memory) |
| `orchestration/chat-orchestrator.ts` | **Shim** → `@services/chat` (`chatOrchestrator`, `chatOrchestratorService`, `ChatOrchestratorError`) |
| `orchestration/session-manager.ts` | **Shim** → `@services/chat` (`sessionManager`, `sessionService`, `SessionError`) |
| `orchestration/turn-manager.ts` | **Shim** → `@services/chat` (`turnManager`, `turnService`, `TurnError`) |
| `orchestration/stream-manager.ts` | **Shim** → `@services/chat` (`streamManager`, `streamService`, `StreamError`) |

`conversation-manager.ts` is a **real implementation** (not a shim) because `chat.service.ts` calls `conversationManager.create()` and `get()` from this file directly, and those methods needed actual logic backed by the `conversationStore`.

### Layer 12 — Run Registry (1 file)

| File | Responsibility |
|---|---|
| `run/registry.ts` | `unregisterRun(runId)` — cleans up questions, context cache, timeline, stream, and stale turns |

### Layer 13 — Controllers (6 files)

| File | Routes handled |
|---|---|
| `controllers/run-controller.ts` | start, cancel, status, listByProject |
| `controllers/checkpoint-controller.ts` | list, get, create, rollback, diff, delete |
| `controllers/chat-controller.ts` | sendMessage, feedback, listConversations |
| `controllers/history-controller.ts` | getHistory, getMessagesByProject, getMessagesByRun |
| `controllers/question-controller.ts` | listPending, answer, cancel |
| `controllers/attachment-controller.ts` | listByProject, listByRun, getById |

### Layer 14 — Attachments (5 files)

| File | Responsibility |
|---|---|
| `attachments/attachment-validator.ts` | MIME type + size validation against allow-lists |
| `attachments/upload-handler.ts` | Validate → count check → write to disk → persist to DB |
| `attachments/image-processor.ts` | Image info extraction + base64 encoding |
| `attachments/file-processor.ts` | Safe disk read/delete/sanitize filename |
| `attachments/attachment-manager.ts` | Orchestrates upload + SSE event publish |

### Layer 15 — API Routes (7 files)

| File | Mounted at |
|---|---|
| `api/run-start.router.ts` | `/api/run` |
| `api/run.routes.ts` | `/api/runs` |
| `api/chat.routes.ts` | `/api/chat` |
| `api/question.routes.ts` | `/api/questions` |
| `api/checkpoint.routes.ts` | `/api/checkpoints` |
| `api/attachment.routes.ts` | `/api/attachments` |
| `api/history.routes.ts` | `/api/history` |

### Layer 16 — Index (1 file)

`server/chat/index.ts` exports the `chatOrchestrator` facade with:
- `startRun` / `cancelRun` — delegates to `@services/chat`
- `mountRoutes(app)` — registers all 7 routers
- `bootstrap(server)` — initializes WebSocket manager + heartbeat

---

## 3. Dependency Architecture (Post-Refactor)

```
main.ts
  └── server/chat/index.ts (chatOrchestrator facade)
        ├── mountRoutes(app) → api/*.routes.ts → controllers/* → persistence/*
        └── bootstrap(server) → realtime/websocket-manager + realtime/heartbeat-manager

@services/chat (server/services/chat/index.ts)
  └── *.service.ts
        └── ../../chat/* (leaf modules only — types, constants, events, persistence, realtime, questions, context, orchestration/conversation-manager)

server/chat shims (orchestration/*, intent/*, llm/*)
  └── @services/chat (one-way, no cycle)
```

**Circular dependency analysis:** NONE detected.  
The shims (`orchestration/chat-orchestrator.ts` → `@services/chat`) only appear in code paths initiated by **consumers of `server/chat/`**, not during module initialization of the files that `@services/chat` depends on.

---

## 4. Phase 3 — Import Validation Results

| Check | Result |
|---|---|
| `server/chat/` files count | 78 files across 19 directories ✅ |
| Server boot | `[server] API server listening on port 3001` ✅ |
| TypeScript errors in `server/chat/` | **0** ✅ |
| TypeScript errors in `server/services/chat/` | 0 (pre-existing client errors unrelated) ✅ |
| `ERR_MODULE_NOT_FOUND` | Resolved — `server/chat/index.ts` now exists ✅ |
| `chatOrchestrator.mountRoutes` | Implemented — 7 routers mounted ✅ |
| `chatOrchestrator.bootstrap` | Implemented — WS + heartbeat initialized ✅ |
| Circular dependencies | None ✅ |

---

## 5. Route Surface Added

```
POST   /api/run/start
POST   /api/run/cancel/:runId
GET    /api/runs
GET    /api/runs/:runId
POST   /api/runs/:runId/cancel

GET    /api/chat/conversations
POST   /api/chat/messages
PATCH  /api/chat/messages/:id/feedback
GET    /api/chat/messages
GET    /api/chat/runs/:runId/messages

GET    /api/runs/:runId/questions
POST   /api/questions/:questionId/answer
DELETE /api/questions/:questionId

GET    /api/checkpoints
POST   /api/checkpoints
GET    /api/checkpoints/:checkpointId
DELETE /api/checkpoints/:checkpointId
POST   /api/checkpoints/:checkpointId/rollback
GET    /api/checkpoints/:checkpointId/diff

GET    /api/attachments
GET    /api/attachments/:id
GET    /api/attachments/run/:runId
POST   /api/attachments/upload

GET    /api/history
GET    /api/history/messages
GET    /api/history/runs/:runId/messages
```

---

## 6. Files NOT Moved or Modified

Per the audit, the following pre-existing files were **left untouched**:

| File | Reason |
|---|---|
| `server/services/chat/*.ts` | Still the real business logic layer — only their import targets were created |
| `server/repositories/chat/*.ts` | Repository layer is correct as-is, now wrapped by `persistence/*.ts` |
| `server/agents/chat/chat-agent.ts` | No `server/chat/` imports by design (architecture contract in header) |
| `server/replit_integrations/chat/*.ts` | Standalone OpenRouter integration — separate conversation schema |
| `main.ts` | Unchanged — only needed `server/chat/index.ts` to exist |

---

## 7. Design Decisions

| Decision | Rationale |
|---|---|
| Shims in `orchestration/`, `intent/`, `llm/` re-export from `@services/chat` | Avoids duplicating business logic; keeps services as source of truth |
| `conversation-manager.ts` is a real implementation (not a shim) | `chat.service.ts` calls `conversationManager.create()` at run start — must be fully initialized before services start importing |
| Checkpoint snapshots stored on disk (not in DB) | File contents can be MB-scale; JSON columns would bloat the DB. Disk storage in `.sandbox/.checkpoints/` is faster to write/read for rollback |
| `context-cache.ts` uses 30s TTL | Balances freshness (new messages invalidate context) vs. DB load during high-turn-rate runs |
| `heartbeat-manager.ts` uses setInterval (not WS ping-pong) | SSE connections don't support ping frames; heartbeat tracks client-side liveness via comment frames |
| `unregisterRun()` cleans 5 in-memory stores | Prevents memory leak on long-running processes with many completed runs |
