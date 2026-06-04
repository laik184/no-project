# server/chat/ — Full Blueprint

> Auto-generated deep scan of every file in `server/chat/`.
> Date: 2026-06-04 | Files: 77 | Folders: 19

---

## Directory Tree

```
server/chat/
├── index.ts                          ← Module bootstrap & public API
│
├── api/                              ← Express route registrations (7 files)
│   ├── chat.routes.ts
│   ├── run.routes.ts
│   ├── run-start.router.ts
│   ├── question.routes.ts
│   ├── checkpoint.routes.ts
│   ├── attachment.routes.ts
│   └── history.routes.ts
│
├── attachments/                      ← File upload pipeline (5 files)
│   ├── attachment-manager.ts
│   ├── attachment-validator.ts
│   ├── file-processor.ts
│   ├── image-processor.ts
│   └── upload-handler.ts
│
├── constants/                        ← Configuration values (3 files)
│   ├── chat.constants.ts
│   ├── event.constants.ts
│   └── stream.constants.ts
│
├── context/                          ← LLM context window logic (4 files)
│   ├── context-builder.ts
│   ├── context-cache.ts
│   ├── context-loader.ts
│   └── context-window.ts
│
├── controllers/                      ← HTTP request handlers (6 files)
│   ├── attachment-controller.ts
│   ├── chat-controller.ts
│   ├── checkpoint-controller.ts
│   ├── history-controller.ts
│   ├── question-controller.ts
│   └── run-controller.ts
│
├── events/                           ← Typed SSE event factories (6 files)
│   ├── chat.events.ts
│   ├── checkpoint.events.ts
│   ├── question.events.ts
│   ├── run.events.ts
│   ├── stream.events.ts
│   └── timeline.events.ts
│
├── intent/                           ← Goal classification shim (1 file)
│   └── intent-router.ts
│
├── llm/                              ← LLM responder shim (1 file)
│   └── chat-responder.ts
│
├── messages/                         ← Message construction (5 files)
│   ├── assistant-message.ts
│   ├── message-builder.ts
│   ├── message-validator.ts
│   ├── system-message.ts
│   └── user-message.ts
│
├── orchestration/                    ← Run coordination (5 files — mostly shims)
│   ├── chat-orchestrator.ts          ← SHIM → @services/chat
│   ├── conversation-manager.ts
│   ├── session-manager.ts            ← SHIM → @services/chat
│   ├── stream-manager.ts             ← SHIM → @services/chat
│   └── turn-manager.ts               ← SHIM → @services/chat
│
├── persistence/                      ← DB / in-memory stores (8 files)
│   ├── attachment-store.ts
│   ├── chat-store.ts
│   ├── checkpoint-store.ts
│   ├── conversation-store.ts
│   ├── message-store.ts
│   ├── run-store.ts
│   ├── run-writer.ts
│   └── workspace-scanner.ts
│
├── questions/                        ← Q&A lifecycle (4 files)
│   ├── ambiguity-detector.ts
│   ├── answer-manager.ts
│   ├── clarification-manager.ts      ← SHIM → @services/chat
│   └── question-manager.ts
│
├── realtime/                         ← SSE / WebSocket layer (5 files)
│   ├── connection-registry.ts
│   ├── event-publisher.ts
│   ├── heartbeat-manager.ts
│   ├── sse-manager.ts
│   └── websocket-manager.ts
│
├── run/                              ← Run cleanup registry (1 file)
│   └── registry.ts
│
├── schemas/                          ← Zod validation schemas (4 files)
│   ├── attachment.schema.ts
│   ├── chat.schema.ts
│   ├── question.schema.ts
│   └── run.schema.ts
│
├── streams/                          ← SSE frame primitives (1 file)
│   └── sse-utils.ts
│
├── timeline/                         ← Run event timeline (5 files)
│   ├── event-timeline.ts
│   ├── run-timeline.ts
│   ├── timeline-manager.ts
│   ├── timeline-publisher.ts
│   └── tool-timeline.ts
│
└── types/                            ← TypeScript interfaces (6 files)
    ├── chat.types.ts
    ├── checkpoint.types.ts
    ├── event.types.ts
    ├── message.types.ts
    ├── question.types.ts
    └── run.types.ts
```

---

## Module Entry Point

### `server/chat/index.ts`
**Purpose:** Chat module bootstrap & public API. Mounts all Express routes, bootstraps WebSocket + heartbeat, exports the `chatOrchestrator` facade consumed by `main.ts`.

**Mounts:**
- `GET/POST /api/chat/*` → chatRouter
- `POST /api/run/*` → runStartRouter
- `GET/POST /api/checkpoints/*` → checkpointRoutes
- `GET /api/chat/stream` → SSE endpoint (inline handler)

**Key Exports:**
```ts
chatOrchestrator.mountRoutes(app)   // called by main.ts before server creation
chatOrchestrator.bootstrap(server)  // called by main.ts after server creation
chatRouter                          // Express router for /api/chat/*
```

**Imports from:** `./api/*`, `./realtime/heartbeat-manager`, `./realtime/websocket-manager`, `../infrastructure`

**Imported by:** `server/main.ts`

---

## 1. `api/` — Route Layer (7 files)

> Pure Express routing. Each file: import controller → register route methods. Zero business logic.

### `api/run-start.router.ts`
**Purpose:** Dedicated router for the top-level `/api/run` endpoints. The frontend's primary surface for run lifecycle actions.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `POST` | `/api/run` | Start new agent run → `chatOrchestrator.startRun()` |
| `POST` | `/api/run/:runId/cancel` | Cancel active run → `chatOrchestrator.cancelRun()` |
| `GET` | `/api/run/active` | List active run IDs → `runController.listActive()` |

**Imports from:** `@services/chat` (chatOrchestrator), `../controllers/run-controller`
**Imported by:** `../index.ts`

---

### `api/chat.routes.ts`
**Purpose:** Routes for standalone messages, feedback, and conversation listing.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `POST` | `/api/chat/message` | Persist a user message outside a run |
| `POST` | `/api/chat/feedback/:messageId` | Submit thumbs up/down |
| `GET` | `/api/chat/conversations/:projectId` | List conversations |

**Imports from:** `../controllers/chat-controller`
**Imported by:** `../index.ts`

---

### `api/run.routes.ts`
**Purpose:** Routes for run status queries under `/api/chat/runs/*`.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `GET` | `/api/chat/runs` | List runs for project |
| `GET` | `/api/chat/runs/:runId` | Get run status |
| `POST` | `/api/chat/runs/:runId/cancel` | Cancel via runController |

**Imports from:** `../controllers/run-controller`
**Imported by:** `../index.ts`

---

### `api/history.routes.ts`
**Purpose:** Routes for project history (paginated messages + runs).

**Routes:**
| Method | Path | Action |
|---|---|---|
| `GET` | `/api/chat/history/:projectId` | Paginated history |
| `GET` | `/api/chat/history/:projectId/runs/:runId/messages` | Messages for a run |

**Imports from:** `../controllers/history-controller`
**Imported by:** `../index.ts`

---

### `api/question.routes.ts`
**Purpose:** Routes for agent-asked questions.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `GET` | `/api/chat/questions/:runId` | List pending questions |
| `POST` | `/api/chat/questions/:questionId/answer` | Submit answer |

**Imports from:** `../controllers/question-controller`
**Imported by:** `../index.ts`

---

### `api/checkpoint.routes.ts`
**Purpose:** Routes for workspace checkpoint management.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `GET` | `/api/checkpoints/:projectId` | List checkpoints |
| `GET` | `/api/checkpoints/:projectId/:id` | Get checkpoint |
| `POST` | `/api/checkpoints/:projectId` | Manual checkpoint |
| `POST` | `/api/checkpoints/:projectId/:id/rollback` | Rollback |
| `DELETE` | `/api/checkpoints/:projectId/:id` | Delete |
| `GET` | `/api/checkpoints/:projectId/:id/diff` | File diff |

**Imports from:** `../controllers/checkpoint-controller`
**Imported by:** `../index.ts`

---

### `api/attachment.routes.ts`
**Purpose:** File/image upload endpoints.

**Routes:**
| Method | Path | Action |
|---|---|---|
| `POST` | `/api/chat/attachments/upload` | Upload file or image |
| `GET` | `/api/chat/attachments/:projectId` | List by project |
| `GET` | `/api/chat/attachments/:projectId/:id` | Get metadata |
| `DELETE` | `/api/chat/attachments/:id` | Delete |

**Imports from:** `../controllers/attachment-controller`
**Imported by:** `../index.ts`

---

## 2. `attachments/` — Upload Pipeline (5 files)

### `attachments/attachment-manager.ts`
**Purpose:** Orchestrates the full upload pipeline: validate → store file on disk → extract metadata → persist DB record → publish SSE event.

**Key Exports:**
```ts
attachmentManager.upload(input: UploadInput): Promise<AttachmentRecord>
attachmentManager.listByProject(projectId): Promise<AttachmentRecord[]>
attachmentManager.delete(attachmentId): Promise<boolean>
class AttachmentError extends Error { code: string }
```

**Imports from:** `./attachment-validator`, `./upload-handler`, `./image-processor`, `./file-processor`, `../persistence/attachment-store`, `../realtime/event-publisher`, `../constants/event.constants`, `../constants/chat.constants`

---

### `attachments/attachment-validator.ts`
**Purpose:** Validates file size, MIME type, and filename safety before upload. Throws on invalid files.

**Key Exports:**
```ts
validateAttachment(filename, mimeType, size): ValidationResult
sanitizeFilename(filename): string
```

---

### `attachments/upload-handler.ts`
**Purpose:** Writes uploaded buffer to `UPLOAD_DIR` on disk. Returns the stored file path.

**Key Exports:**
```ts
storeUpload(filename, data: Buffer): Promise<string>
```

---

### `attachments/image-processor.ts`
**Purpose:** Extracts image metadata (dimensions, format) from image buffers.

**Key Exports:**
```ts
extractImageMetadata(data: Buffer, mimeType): Promise<ImageMeta>
```

---

### `attachments/file-processor.ts`
**Purpose:** Processes non-image files — extracts text content for context injection, validates document formats.

**Key Exports:**
```ts
processFileAttachment(data: Buffer, mimeType): Promise<FileProcessResult>
```

---

## 3. `constants/` — Configuration (3 files)

### `constants/chat.constants.ts`
**Purpose:** All business-level limits and defaults for the chat module.

**Key Values:**
| Constant | Value | Purpose |
|---|---|---|
| `MAX_MESSAGE_LENGTH` | 32,000 chars | User message length cap |
| `MAX_ATTACHMENT_BYTES` | 20 MB | Upload size limit |
| `MAX_ATTACHMENTS_PER_RUN` | 10 | Per-run attachment cap |
| `UPLOAD_DIR` | `.sandbox/uploads` | File storage path |
| `DEFAULT_RUN_MODE` | `'planned'` | Default agent mode |
| `MAX_TITLE_LENGTH` | 80 chars | Auto-title truncation |
| `DEFAULT_CONTEXT_WINDOW` | 40 messages | LLM context budget |
| `MAX_CONTEXT_WINDOW` | 120 messages | Hard context ceiling |
| `HISTORY_PAGE_SIZE` | 20 | Pagination default |

---

### `constants/event.constants.ts`
**Purpose:** Canonical string constants for all SSE event types and bus keys.

**Key Exports:**
```ts
CHAT_EVENT = {
  MESSAGE_CREATED, MESSAGE_UPDATED,
  STREAM_STARTED, STREAM_TOKEN, STREAM_ENDED,
  RUN_STARTED, RUN_COMPLETED, RUN_FAILED, RUN_CANCELLED,
  QUESTION_ASKED, QUESTION_ANSWERED,
  ATTACHMENT_UPLOADED, TIMELINE_EVENT,
  TURN_STARTED, TURN_COMPLETED,
  CHECKPOINT_CREATED, CHECKPOINT_UPDATED, CHECKPOINT_ROLLBACK,
}

BUS_EVENT   = { AGENT_EVENT, RUN_LIFECYCLE, CHECKPOINT }
CHAT_TOPIC  = { AGENT, LIFECYCLE, CHECKPOINT }
```

---

### `constants/stream.constants.ts`
**Purpose:** All timing constants for SSE, WebSocket, and Q&A polling.

**Key Values:**
| Constant | Value | Purpose |
|---|---|---|
| `SSE_HEARTBEAT_MS` | 25,000 ms | Keep-alive interval |
| `STREAM_TOKEN_TIMEOUT_MS` | 30,000 ms | Token stall timeout |
| `MAX_STREAM_DURATION_MS` | 5 min | Hard stream cap |
| `TOKEN_BUFFER_SIZE` | 1 | Flush threshold |
| `QUESTION_TTL_MS` | 10 min | Auto-expire questions |
| `ANSWER_POLL_MS` | 250 ms | Polling interval |
| `ANSWER_WAIT_TIMEOUT_MS` | 10 min | Max wait for answer |
| `WS_PING_INTERVAL_MS` | 30,000 ms | WebSocket keepalive |

---

## 4. `context/` — LLM Context Window (4 files)

### `context/context-builder.ts`
**Purpose:** Assembles the LLM prompt context by applying a sliding window to message history and prepending the system prompt.

**Key Exports:**
```ts
interface BuiltContext { entries: ChatMessageRecord[]; systemPrompt?: string; tokenEstimate: number }
buildContext(messages, systemPrompt?, maxMessages?): BuiltContext
serializeContext(ctx: BuiltContext): string
```

**Imports from:** `./context-window`, `../types/message.types`

---

### `context/context-cache.ts`
**Purpose:** Short-lived (30 s TTL) in-memory cache for loaded context. Prevents redundant DB reads within a single turn.

**Key Exports:**
```ts
contextCache.get(key): LoadedContext | null
contextCache.set(key, value): void
contextCache.delete(key): void
contextCache.clear(): void
```

**Imported by:** `context-loader.ts`, `run/registry.ts`

---

### `context/context-loader.ts`
**Purpose:** Loads the raw messages + run metadata needed by context-builder, with cache-first lookup.

**Key Exports:**
```ts
interface LoadedContext { messages: ChatMessageRecord[]; run: ChatRun | null }
contextLoader.loadForRun(runId): Promise<LoadedContext>
contextLoader.loadForProject(projectId, limit?): Promise<ChatMessageRecord[]>
contextLoader.invalidate(runId): void
```

**Imports from:** `../persistence/message-store`, `../persistence/run-store`, `./context-cache`

---

### `context/context-window.ts`
**Purpose:** Pure sliding-window truncation algorithm. Keeps system message + newest N messages within token budget.

**Key Exports:**
```ts
contextWindow.apply(messages, maxMessages?): ChatMessageRecord[]
contextWindow.estimateTokens(messages): number
contextWindow.trimToTokenBudget(messages, maxTokens): ChatMessageRecord[]
```

---

## 5. `controllers/` — HTTP Request Handlers (6 files)

> Pattern: parse → validate with Zod → call service/store → respond. No business logic.

### `controllers/run-controller.ts`
**Purpose:** Handles `/api/chat/runs/*` — run status queries and cancellation.

**Methods:**
```ts
runController.getStatus(req, res)       // GET /api/chat/runs/:runId
runController.cancel(req, res)          // POST /api/chat/runs/:runId/cancel
runController.listByProject(req, res)   // GET /api/chat/runs?projectId=N
runController.listActive(req, res)      // GET /api/run/active
```

**Imports from:** `../../orchestration/core/run-manager`, `@services/chat` (chatOrchestrator), `../persistence/run-store`, `../schemas/run.schema`

---

### `controllers/checkpoint-controller.ts`
**Purpose:** Handles all `/api/checkpoints/*` operations.

**Methods:**
```ts
checkpointController.list(req, res)         // GET list by projectId
checkpointController.get(req, res)          // GET single by ID
checkpointController.create(req, res)       // POST manual checkpoint
checkpointController.rollback(req, res)     // POST rollback
checkpointController.delete(req, res)       // DELETE
checkpointController.diff(req, res)         // GET file diff
checkpointController.diagnostics(req, res)  // GET recovery diagnostics stub
checkpointController.resetRecovery(req, res)// POST recovery reset stub
```

**Imports from:** `../persistence/checkpoint-store`, `../events/checkpoint.events`, `../../infrastructure`, `../types/checkpoint.types`

---

### `controllers/chat-controller.ts`
**Purpose:** Handles standalone message creation, feedback, and conversation listing.

**Methods:**
```ts
chatController.sendMessage(req, res)          // POST /api/chat/message
chatController.submitFeedback(req, res)       // POST /api/chat/feedback/:id
chatController.listConversations(req, res)    // GET /api/chat/conversations/:projectId
```

**Imports from:** `../orchestration/conversation-manager`, `../persistence/message-store`, `../schemas/chat.schema`

---

### `controllers/history-controller.ts`
**Purpose:** Retrieves paginated project history (runs + messages).

**Methods:**
```ts
historyController.getHistory(req, res)       // GET paginated history
historyController.getRunMessages(req, res)   // GET messages for a run
```

**Imports from:** `../persistence/chat-store`

---

### `controllers/question-controller.ts`
**Purpose:** Handles question listing and answer submission.

**Methods:**
```ts
questionController.listPending(req, res)    // GET /api/chat/questions/:runId
questionController.submitAnswer(req, res)   // POST /api/chat/questions/:id/answer
```

**Imports from:** `../questions/answer-manager`, `../questions/question-manager`, `../schemas/question.schema`

---

### `controllers/attachment-controller.ts`
**Purpose:** Handles file upload requests (multipart form-data) and attachment queries.

**Methods:**
```ts
attachmentController.upload(req, res)         // POST upload
attachmentController.listByProject(req, res)  // GET list
attachmentController.getById(req, res)        // GET single
attachmentController.delete(req, res)         // DELETE
```

**Imports from:** `../attachments/attachment-manager`, `../schemas/attachment.schema`

---

## 6. `events/` — SSE Event Factories (6 files)

> Pure functions — no I/O, no side effects. Each file builds typed event payloads.

### `events/run.events.ts`
**Purpose:** Run lifecycle event factories (`run.started`, `run.completed`, `run.failed`).

**Key Exports:**
```ts
makeRunStartedEvent(runId, projectId, goal, mode): RunStartedEvent
makeRunCompletedEvent(runId, projectId, durationMs): RunCompletedEvent
makeRunFailedEvent(runId, projectId, error): RunFailedEvent
isTerminalStatus(status): boolean
```

---

### `events/stream.events.ts`
**Purpose:** Token stream event factories with monotonic sequence counter.

**Key Exports:**
```ts
makeStreamStartedEvent(runId, projectId): StreamStartedEvent
makeStreamTokenEvent(runId, projectId, token): StreamTokenEvent
makeStreamEndedEvent(runId, projectId, totalTokens, durationMs): StreamEndedEvent
nextSeq(): number   // monotonic counter for token ordering
```

---

### `events/checkpoint.events.ts`
**Purpose:** Checkpoint SSE payload factories.

**Key Exports:**
```ts
makeCheckpointCreatedPayload(cp): CheckpointSSEPayload
makeCheckpointRollbackPayload(checkpointId, runId, projectId): CheckpointSSEPayload
makeCheckpointDeletedEvent(checkpointId, projectId): CheckpointDeleteEvent
```

---

### `events/question.events.ts`
**Purpose:** Q&A event factories.

**Key Exports:**
```ts
makeQuestionAskedEvent(question: ChatQuestion): QuestionAskedEvent
makeQuestionAnsweredEvent(questionId, runId, projectId, answer): QuestionAnsweredEvent
```

---

### `events/chat.events.ts`
**Purpose:** Generic message-created event factory.

**Key Exports:**
```ts
makeMessageCreatedEvent(projectId, messageId, role, runId?): AnyChatEvent
type AnyChatEvent
```

---

### `events/timeline.events.ts`
**Purpose:** Timeline entry event factory for SSE publication.

**Key Exports:**
```ts
makeTimelineEvent(runId, projectId, entry): TimelinePublishedEvent
type TimelinePublishedEvent
```

---

## 7. `intent/` — Goal Classification Shim (1 file)

### `intent/intent-router.ts`
**Status:** COMPATIBILITY SHIM — re-exports from `@services/chat`

**Re-exports:**
```ts
export { routeIntent, isChatMode, intentService } from '@services/chat';
export type { IntentMode, IntentResult } from '@services/chat';
```

**Actual implementation:** `server/services/chat/intent.service.ts`

---

## 8. `llm/` — LLM Responder Shim (1 file)

### `llm/chat-responder.ts`
**Status:** COMPATIBILITY SHIM — re-exports from `@services/chat`

**Re-exports:**
```ts
export { streamRunSummary, chatResponderService } from '@services/chat';
```

**Actual implementation:** `server/services/chat/responder.service.ts`

---

## 9. `messages/` — Message Construction (5 files)

### `messages/message-builder.ts`
**Purpose:** Factory coordinator — builds and persists chat messages, emits SSE events on creation.

**Key Exports:**
```ts
messageBuilder.buildUser(payload: UserMessagePayload): Promise<ChatMessageRecord>
messageBuilder.buildAssistant(payload: AssistantMessagePayload): Promise<ChatMessageRecord>
messageBuilder.buildSystem(payload: SystemMessagePayload): Promise<ChatMessageRecord>
```

**Imports from:** `../persistence/message-store`, `../realtime/event-publisher`, `../events/chat.events`

---

### `messages/user-message.ts`
**Purpose:** Builds validated `UserMessagePayload`. Trims, sanitizes, and checks content length.

**Key Exports:**
```ts
buildUserPayload(projectId: number, rawContent: string, runId?: string): UserMessagePayload
isDuplicateUserMessage(lastContent, newContent): boolean
class UserMessageError extends Error
```

---

### `messages/assistant-message.ts`
**Purpose:** Builds `AssistantMessagePayload`. Handles tool-call embedding.

**Key Exports:**
```ts
buildAssistantPayload(projectId, content, runId?, toolCalls?, tokensUsed?): AssistantMessagePayload
```

---

### `messages/system-message.ts`
**Purpose:** Builds system message payloads for LLM context injection.

**Key Exports:**
```ts
buildBaseSystemPayload(projectId, content, runId?): SystemMessagePayload
buildContextInjectionPayload(projectId, contextStr, runId?): SystemMessagePayload
```

---

### `messages/message-validator.ts`
**Purpose:** Sanitizes content (strips nulls, trims) and validates length/format.

**Key Exports:**
```ts
sanitizeContent(raw: string): string
validateMessageContent(content): { valid: boolean; errors: string[] }
```

---

## 10. `orchestration/` — Run Coordination (5 files)

### `orchestration/chat-orchestrator.ts`
**Status:** COMPATIBILITY SHIM — re-exports from `@services/chat`

**Re-exports:**
```ts
export { chatOrchestrator, chatOrchestratorService, ChatOrchestratorError } from '@services/chat';
```

**Actual implementation:** `server/services/chat/chat.service.ts`

---

### `orchestration/conversation-manager.ts`
**Purpose:** Creates, fetches, archives conversations (logical groupings of runs per project). Real implementation — not a shim.

**Key Exports:**
```ts
conversationManager.create(projectId, goal): Conversation
conversationManager.get(conversationId): Conversation | null
conversationManager.getOrThrow(conversationId): Conversation
conversationManager.listByProject(projectId): ConversationSummary[]
conversationManager.onMessageAdded(conversationId): void
conversationManager.setStatus(conversationId, status): void
class ConversationError extends Error { code: string }
```

**Imports from:** `../persistence/conversation-store`

---

### `orchestration/session-manager.ts`
**Status:** COMPATIBILITY SHIM → `@services/chat`

**Re-exports:**
```ts
export { sessionManager, sessionService } from '@services/chat';
```

**Actual implementation:** `server/services/chat/session.service.ts`

---

### `orchestration/stream-manager.ts`
**Status:** COMPATIBILITY SHIM → `@services/chat`

**Re-exports:**
```ts
export { streamManager, streamService, StreamError } from '@services/chat';
```

**Actual implementation:** `server/services/chat/stream.service.ts`

---

### `orchestration/turn-manager.ts`
**Status:** COMPATIBILITY SHIM → `@services/chat`

**Re-exports:**
```ts
export { turnManager, turnService, TurnError } from '@services/chat';
```

**Actual implementation:** `server/services/chat/turn.service.ts`

---

## 11. `persistence/` — Data Layer (8 files)

### `persistence/chat-store.ts`
**Purpose:** Aggregate read-only facade combining `message-store` + `run-store` for convenience queries. Paginated history, active run lookup.

**Key Exports:**
```ts
interface ChatHistory { runs, messages, total, page, limit }
chatStore.getHistory(projectId, page?, limit?): Promise<ChatHistory>
chatStore.getRunMessages(runId): Promise<ChatMessageRecord[]>
chatStore.getActiveRun(projectId): Promise<ChatRun | null>
```

**Imports from:** `./message-store`, `./run-store`, `../constants/chat.constants`

---

### `persistence/run-store.ts`
**Purpose:** Read-only run queries. Delegates to `runRepository`. Kept for backward-compat.

**Key Exports:**
```ts
runStore.findById(runId): Promise<ChatRun | null>
runStore.findActiveByProject(projectId): Promise<ChatRun | null>
runStore.listByProject(projectId, limit?): Promise<ChatRun[]>
runStore.isActive(runId): Promise<boolean>
```

**Imports from:** `../../repositories/chat/run.repository`

---

### `persistence/run-writer.ts`
**Purpose:** Write operations for runs. Delegates to `runRepository`.

**Key Exports:**
```ts
runWriter.create(runId, projectId, goal): Promise<void>
runWriter.setStatus(runId, status, result?): Promise<void>
```

**Imports from:** `../../repositories/chat/run.repository`

---

### `persistence/message-store.ts`
**Purpose:** CRUD for chat messages. Delegates to `messageRepository`.

**Key Exports:**
```ts
messageStore.insertUser(payload): Promise<ChatMessageRecord>
messageStore.insertAssistant(payload): Promise<ChatMessageRecord>
messageStore.insertSystem(payload): Promise<ChatMessageRecord>
messageStore.listByProject(projectId, limit?): Promise<ChatMessageRecord[]>
messageStore.listByRun(runId): Promise<ChatMessageRecord[]>
```

**Imports from:** `../../repositories/chat/message.repository`

---

### `persistence/conversation-store.ts`
**Purpose:** In-memory conversation state (no DB table yet — Map-backed with UUID keys).

**Key Exports:**
```ts
conversationStore.create(projectId, goal): Conversation
conversationStore.get(conversationId): Conversation | null
conversationStore.listByProject(projectId): ConversationSummary[]    // sorted newest-first
conversationStore.incrementMessageCount(conversationId): void
conversationStore.setStatus(conversationId, status): void
conversationStore.delete(conversationId): void
```

---

### `persistence/checkpoint-store.ts`
**Purpose:** Captures workspace file snapshots and enables rollback. Heavy — queries `diffQueue` + `toolExecutions` tables plus filesystem scan.

**Key Exports:**
```ts
chatCheckpointStore.createForRun(runId, projectId, goal, trigger): Promise<ChatCheckpoint>
chatCheckpointStore.createManual(projectId, label): Promise<ChatCheckpoint>
chatCheckpointStore.listByProject(projectId, limit?): Promise<ChatCheckpoint[]>
chatCheckpointStore.findById(id): Promise<ChatCheckpoint | null>
chatCheckpointStore.rollback(checkpointId): Promise<RollbackResult>
chatCheckpointStore.diffCheckpoints(id1, id2): Promise<SnapshotDiff>
chatCheckpointStore.deleteCheckpoint(id): Promise<boolean>
```

**Imports from:** `drizzle-orm`, `fs`, `crypto`, `shared/schema`, `./workspace-scanner`, `../../infrastructure`

---

### `persistence/attachment-store.ts`
**Purpose:** DB CRUD for attachment metadata (not the file data itself — that's on disk).

**Imports from:** `../../repositories/chat/attachment.repository`

---

### `persistence/workspace-scanner.ts`
**Purpose:** Recursively scans the `.sandbox/` directory and captures file contents. Skips `node_modules`, binary files, and files >500 KB.

**Key Exports:**
```ts
scanWorkspace(rootPath: string): Promise<FileSnapshot[]>
interface FileSnapshot { path: string; content: string; sizeBytes: number }
```

**Imported by:** `persistence/checkpoint-store.ts`

---

## 12. `questions/` — Q&A Lifecycle (4 files)

### `questions/question-manager.ts`
**Purpose:** In-memory registry for pending questions. Owns create, get, answer, cancel, expire.

**Key Exports:**
```ts
questionManager.create(payload: AskQuestionPayload): ChatQuestion
questionManager.get(questionId): ChatQuestion | null
questionManager.answer(questionId, answer): ChatQuestion | null
questionManager.cancel(questionId): boolean
questionManager.cancelByRun(runId): number        // cancels all pending for run
questionManager.listPendingByRun(runId): ChatQuestion[]
```

---

### `questions/answer-manager.ts`
**Purpose:** Processes user answers: validates (question exists, is pending, answer in options), records answer, publishes `question.answered` event.

**Key Exports:**
```ts
answerManager.submit(payload: SubmitPayload): ChatQuestion   // throws AnswerError on failure
class AnswerError extends Error { code: 'NOT_FOUND' | 'NOT_PENDING' | 'INVALID_OPTION' }
```

---

### `questions/ambiguity-detector.ts`
**Purpose:** Pure heuristic analysis of user goal text. Detects vague phrasing, under-specified targets.

**Key Exports:**
```ts
interface AmbiguityAnalysis { isAmbiguous: boolean; ambiguities: string[]; confidence: number }
analyzeAmbiguity(goal: string): AmbiguityAnalysis
buildClarificationText(ambiguities: string[]): string
```

---

### `questions/clarification-manager.ts`
**Status:** COMPATIBILITY SHIM → `@services/chat`

**Re-exports:**
```ts
export { clarificationManager, clarificationService } from '@services/chat';
```

**Actual implementation:** `server/services/chat/clarification.service.ts`

---

## 13. `realtime/` — SSE / WebSocket Layer (5 files)

### `realtime/event-publisher.ts`
**Purpose:** Publishes typed chat domain events to the infrastructure event bus. Single wrapper around `bus.emit('agent.event', ...)`.

**Key Exports:**
```ts
eventPublisher.publish(event: PublishableEvent): void
eventPublisher.publishRaw(payload: Record<string, unknown>): void
```

**Imports from:** `../../infrastructure` (bus)
**Imported by:** `message-builder`, `answer-manager`, `stream.service`, `clarification.service`, `chat.service`

---

### `realtime/sse-manager.ts`
**Purpose:** Chat-scoped SSE facade for diagnostics. Delegates all actual connection management to `infrastructure/sse-manager`.

**Key Exports:**
```ts
sseChatManager.getConnectionCount(): number
sseChatManager.getTopicStats(): TopicStats
```

**Imports from:** `../../infrastructure` (sseManager)

---

### `realtime/heartbeat-manager.ts`
**Purpose:** Chat-level heartbeat tracker — monitors missed pings and logs stale connections. Infrastructure handles the actual pings.

**Key Exports:**
```ts
heartbeatManager.start(): void          // starts interval
heartbeatManager.stop(): void
heartbeatManager.register(connId, projectId): void
heartbeatManager.unregister(connId): void
```

**Imports from:** `../constants/stream.constants`
**Imported by:** `../index.ts`

---

### `realtime/websocket-manager.ts`
**Purpose:** Chat WebSocket facade for chat-specific events (typing indicators). Owns the per-project WS client map.

**Key Exports:**
```ts
websocketManager.register(projectId, ws): void
websocketManager.sendTyping(projectId, runId?, isTyping): void
websocketManager.broadcast(projectId, payload): void
```

**Imports from:** `ws`, `../constants/stream.constants`
**Imported by:** `../index.ts`

---

### `realtime/connection-registry.ts`
**Purpose:** Tracks active SSE/WS client connections per project. Used for connection-count health checks.

**Key Exports:**
```ts
connectionRegistry.register(connId, projectId): void
connectionRegistry.unregister(connId): void
connectionRegistry.countByProject(projectId): number
connectionRegistry.total(): number
```

---

## 14. `run/` — Run Cleanup Registry (1 file)

### `run/registry.ts`
**Purpose:** Coordinates per-run in-memory cleanup when a run's replay TTL expires. Called by `server/infrastructure/memory/run-cleanup-manager.ts`. Coordinates across all chat sub-systems without owning any state itself.

**Key Exports:**
```ts
unregisterRun(runId: string): void
// Calls: questionManager.cancelByRun(), contextCache.delete(),
//        eventTimeline.clear(), streamManager.close(), turnManager.clearCompleted()
```

**Imports from:** `../questions/question-manager`, `../context/context-cache`, `../timeline/event-timeline`, `@services/chat` (turnManager, streamManager)

**Imported by:** `server/infrastructure/memory/run-cleanup-manager.ts`

---

## 15. `schemas/` — Zod Validation Schemas (4 files)

> Used by controllers to validate request bodies/params before business logic.

### `schemas/run.schema.ts`
```ts
cancelRunSchema       → { runId: string }
runIdParamSchema      → { runId: string }
runStatusQuerySchema  → { projectId?: number }
runContextSchema      → { maxSteps?, maxContinuations?, timeoutMs? }
```

### `schemas/chat.schema.ts`
```ts
sendMessageSchema   → { projectId: number; content: string; runId?: string }
feedbackSchema      → { feedback: 'up' | 'down' }
```

### `schemas/question.schema.ts`
```ts
answerSchema        → { answer: string; runId: string }
```

### `schemas/attachment.schema.ts`
```ts
uploadSchema        → { projectId: number; runId?: string }
```

---

## 16. `streams/` — SSE Primitives (1 file)

### `streams/sse-utils.ts`
**Purpose:** Low-level SSE frame serialization for Express responses. Writes `id:`, `event:`, `data:`, and blank-line separators per spec.

**Key Exports:**
```ts
writeSseEvent(res: Response, topic: string, data: unknown, seqId: number): void
writeSseComment(res: Response, comment: string): void
flushSse(res: Response): void
```

**Imported by:** `server/infrastructure/backpressure.ts`

---

## 17. `timeline/` — Run Event Timeline (5 files)

### `timeline/event-timeline.ts`
**Purpose:** In-memory ordered event log per run. Auto-incrementing IDs, per-run Map.

**Key Exports:**
```ts
type TimelineEntryKind = 'phase' | 'tool_call' | 'file_write' | 'stream' | 'question' | 'recovery' | 'checkpoint' | 'lifecycle'

interface TimelineEntry { id, runId, kind, label, status, phase?, tool?, filePath?, error?, meta?, ts }

eventTimeline.append(runId, entry): TimelineEntry
eventTimeline.list(runId): TimelineEntry[]
eventTimeline.last(runId): TimelineEntry | null
eventTimeline.clear(runId): void
eventTimeline.updateStatus(runId, id, status, error?): void
```

---

### `timeline/timeline-manager.ts`
**Purpose:** Single external entry point for all timeline operations. Appends + publishes to SSE.

**Key Exports:**
```ts
timelineManager.append(runId, projectId, kind, label, status, extra?): TimelineEntry
timelineManager.getEntries(runId): TimelineEntry[]
timelineManager.clear(runId): void
```

**Imports from:** `./event-timeline`, `./timeline-publisher`

---

### `timeline/timeline-publisher.ts`
**Purpose:** Publishes a `TimelineEntry` to the infrastructure bus as a `chat.timeline.event` SSE event.

**Key Exports:**
```ts
timelinePublisher.publish(runId, projectId, entry: TimelineEntry): void
```

**Imports from:** `../events/timeline.events`, `../realtime/event-publisher`

---

### `timeline/run-timeline.ts`
**Purpose:** Convenience helpers for run lifecycle timeline entries (phase-start, phase-end, recovery).

**Key Exports:**
```ts
runTimeline.startPhase(runId, projectId, phase): TimelineEntry
runTimeline.endPhase(runId, projectId, phase, status): void
runTimeline.recordRecovery(runId, projectId, label): TimelineEntry
```

**Imports from:** `./timeline-manager`

---

### `timeline/tool-timeline.ts`
**Purpose:** Convenience helpers for tool-execution timeline entries (start, success, error).

**Key Exports:**
```ts
toolTimeline.start(runId, projectId, tool, label?): TimelineEntry
toolTimeline.succeed(runId, projectId, id, label?): void
toolTimeline.fail(runId, projectId, id, error): void
toolTimeline.fileWrite(runId, projectId, filePath): TimelineEntry
```

**Imports from:** `./timeline-manager`

---

## 18. `types/` — TypeScript Interfaces (6 files)

### `types/run.types.ts`
```ts
type RunMode   = 'planned' | 'direct' | 'auto'
type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

interface ChatRun         { runId, projectId, conversationId?, goal, mode, status, startedAt, completedAt?, durationMs?, result?, error? }
interface RunStartPayload { projectId, goal, mode?, conversationId?, context? }
interface RunCancelResult { runId, cancelled, reason? }
interface RunStatusResult { runId, status, startedAt, completedAt?, durationMs? }
```

---

### `types/chat.types.ts`
```ts
type ConversationStatus = 'active' | 'archived' | 'deleted'
type TurnStatus         = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
type SessionStatus      = 'open' | 'closing' | 'closed'

interface Conversation        { conversationId, projectId, status, title, messageCount, createdAt, updatedAt, lastMessageAt? }
interface ConversationSummary { conversationId, projectId, title, status, messageCount, lastMessageAt?, createdAt }
interface ChatSession         { sessionId, conversationId, projectId, status, openedAt, closedAt? }
interface ChatTurn            { turnId, runId, conversationId, projectId, goal, status, startedAt, completedAt?, durationMs? }
```

---

### `types/message.types.ts`
```ts
type MessageRole   = 'user' | 'assistant' | 'system' | 'tool'
type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

interface ChatMessageRecord    { id, projectId, runId?, role, content, tokensUsed, toolCalls?, feedback?, createdAt }
interface ToolCallRecord       { tool, args, result?, status, durationMs? }
interface StreamChunk          { runId, projectId, token, seqIndex, ts }
interface AssistantMessagePayload { projectId, runId?, content, toolCalls?, tokensUsed? }
interface UserMessagePayload   { projectId, runId?, content }
interface SystemMessagePayload { projectId, content, runId? }
```

---

### `types/event.types.ts`
```ts
type ChatEventType = 'chat.message.created' | 'chat.stream.started' | 'chat.stream.token' |
                     'chat.stream.ended' | 'chat.run.started' | 'chat.run.completed' |
                     'chat.run.failed' | 'chat.question.asked' | ... (15 types)

interface ChatEvent        { type, projectId, runId?, ts, payload }
interface StreamStartedEvent  { eventType: 'agent.stream.start', runId, projectId, ts }
interface StreamTokenEvent    { eventType: 'agent.token', payload: {token}, runId, projectId, seqIndex, ts }
interface StreamEndedEvent    { eventType: 'agent.stream.end', runId, projectId, totalTokens, durationMs, ts }
interface RunStartedEvent     { type, runId, projectId, goal, mode, ts }
interface RunCompletedEvent   { type, runId, projectId, durationMs, ts }
interface RunFailedEvent      { type, runId, projectId, error, ts }
```

---

### `types/checkpoint.types.ts`
```ts
interface ChatCheckpoint   { id, runId, projectId, title, description, trigger, filesChanged, createdFiles[], modifiedFiles[], deletedFiles[], createdAt, gitCommitSha? }
type CheckpointTrigger     = 'run_complete' | 'files_threshold' | 'phase_complete' | 'loop_end' | 'manual'
interface CheckpointListItem  { id, runId, projectId, label, title, description, trigger, status, filesChanged, createdFiles[], modifiedFiles[], deletedFiles[], createdAt, gitCommitSha?, gitSha? }
interface RollbackResult   { ok, checkpointId, filesRestored, rollbackId?, error? }
interface SnapshotDiff     { added[], removed[], modified[], totalChanges }
```

---

### `types/question.types.ts`
```ts
type QuestionStatus = 'pending' | 'answered' | 'expired' | 'cancelled'
type QuestionKind   = 'clarification' | 'ambiguity' | 'confirmation'

interface ChatQuestion       { questionId, runId, projectId, kind, text, options[], status, askedAt, expiresAt?, answer?, answeredAt? }
interface AskQuestionPayload { runId, projectId, kind, text, options, ttlMs? }
interface AnswerPayload      { questionId, runId, answer }
interface ClarificationContext { originalGoal, clarifications[], refinedGoal }
```

---

## Cross-Cutting Architecture

### Request Flow (POST /api/run)
```
Frontend
  → POST /api/run
  → run-start.router.ts
  → chatOrchestrator.startRun(payload)          ← @services/chat/chat.service.ts
      ├── conversationManager.create()           ← orchestration/conversation-manager.ts
      ├── sessionManager.open()                  ← services/chat/session.service.ts
      ├── turnManager.start()                    ← services/chat/turn.service.ts
      ├── runWriter.create()                     ← persistence/run-writer.ts → repository
      ├── runManager.register()                  ← orchestration/core/run-manager.ts
      ├── clarificationManager.run()             ← services/chat/clarification.service.ts
      ├── eventPublisher.publish(RunStartedEvent)← realtime/event-publisher.ts → bus
      ├── messageBuilder.buildUser()             ← messages/message-builder.ts
      └── orchestrate() [async fire-and-forget]  ← orchestration/orchestrator.ts
            → on complete: streamRunSummary()    ← services/chat/responder.service.ts
                         + checkpointService.createForRun()
  → res.status(201).json({ ok: true, data: run })
```

### SSE Event Flow
```
Agent emits event
  → eventPublisher.publish(event)
  → bus.emit('agent.event', event)
  → infrastructure/events/hub → SSE fan-out
  → GET /api/chat/stream (SSE clients subscribed by projectId/runId/topic)
  → Frontend EventSource listener
```

### Run Cleanup Flow
```
Run completes / TTL expires
  → infrastructure/memory/run-cleanup-manager.ts
  → chat/run/registry.ts: unregisterRun(runId)
      ├── questionManager.cancelByRun(runId)
      ├── contextCache.delete(runId)
      ├── eventTimeline.clear(runId)
      ├── streamManager.close(runId)        [if active]
      └── turnManager.clearCompleted()
```

### Service Layer Shim Pattern
```
Old import path (backward compat):
  server/chat/orchestration/session-manager.ts
  → export { sessionManager } from '@services/chat'
  → server/services/chat/index.ts
  → server/services/chat/session.service.ts

New import path (preferred):
  import { sessionManager } from '@services/chat';
```

---

## Summary Stats

| Folder | Files | Type |
|---|---|---|
| `api/` | 7 | Route registration |
| `attachments/` | 5 | Upload pipeline |
| `constants/` | 3 | Configuration |
| `context/` | 4 | LLM context window |
| `controllers/` | 6 | HTTP handlers |
| `events/` | 6 | Event factories |
| `intent/` | 1 | Shim |
| `llm/` | 1 | Shim |
| `messages/` | 5 | Message construction |
| `orchestration/` | 5 | 4 shims + 1 real |
| `persistence/` | 8 | DB / in-memory stores |
| `questions/` | 4 | Q&A lifecycle |
| `realtime/` | 5 | SSE / WebSocket |
| `run/` | 1 | Cleanup coordinator |
| `schemas/` | 4 | Zod validation |
| `streams/` | 1 | SSE primitives |
| `timeline/` | 5 | Event history |
| `types/` | 6 | TypeScript interfaces |
| `index.ts` | 1 | Module entry point |
| **Total** | **78** | |

**Shims pointing to `@services/chat`:** 7 files
(`chat-orchestrator`, `session-manager`, `stream-manager`, `turn-manager`, `intent-router`, `chat-responder`, `clarification-manager`)

**Actual implementations in `server/services/chat/`:** 10 files
(`chat.service`, `session.service`, `turn.service`, `stream.service`, `intent.service`, `clarification.service`, `responder.service`, `context.service`, `checkpoint.service`, `index`)
