# CHAT_ARCHITECTURE_AUDIT.md
## Phase 1 — Pre-Refactor Scan
**Date:** 2026-06-04  
**Audited by:** Agent Deep-Scan  
**Scope:** All chat-related source code in the repository before `server/chat/` was created.

---

## 1. Executive Summary

`server/chat/index.ts` was missing entirely. `main.ts` imported `chatOrchestrator` from `./server/chat/index.ts`, causing `ERR_MODULE_NOT_FOUND` on every boot. The API server could not start.

Chat logic was fragmented across **four scattered locations**:

| Location | Files | Role |
|---|---|---|
| `server/services/chat/` | 10 | Service layer: orchestration, session, turn, stream, intent, clarification, responder, context, checkpoint |
| `server/repositories/chat/` | 5 | DB repository layer: message, run, attachment, checkpoint, index barrel |
| `server/agents/chat/` | 1 | LLM-facing chat agent (conversation/explain intents) |
| `server/replit_integrations/chat/` | 3 | Replit Integration routes (conversations CRUD + streaming) |

**Total pre-refactor chat files:** 19  
**Files missing that services depended on:** 50+ (all of `server/chat/`)

---

## 2. File-by-File Inventory

### 2.1 `server/services/chat/` — 10 files

| File | Responsibility | Imports from `../../chat/*` |
|---|---|---|
| `chat.service.ts` | Main lifecycle coordinator — `startRun`, `cancelRun` | conversation-manager, message-builder, user-message, system-message, context-loader, context-builder, run-writer, event-publisher, run.events, checkpoint.events, types/run.types |
| `session.service.ts` | Ephemeral session lifecycle (in-memory) | types/chat.types |
| `turn.service.ts` | Turn lifecycle (in-memory) | types/chat.types |
| `stream.service.ts` | Token stream open/append/close + timeout | events/stream.events, realtime/event-publisher, constants/stream.constants |
| `intent.service.ts` | Keyword-based intent classifier (pure logic) | — (no server/chat imports) |
| `clarification.service.ts` | Ambiguity detection + Q&A workflow | questions/ambiguity-detector, questions/question-manager, realtime/event-publisher, events/question.events, constants/stream.constants |
| `responder.service.ts` | LLM summary streamer for run completion | stream.service (local) |
| `context.service.ts` | Context building coordination facade | context/context-builder, context/context-loader, types/message.types |
| `checkpoint.service.ts` | Business facade over checkpoint-store | persistence/checkpoint-store, types/checkpoint.types |
| `index.ts` | Public barrel for `@services/chat` alias | re-exports from all above |

### 2.2 `server/repositories/chat/` — 5 files

| File | Table | Key Methods |
|---|---|---|
| `message.repository.ts` | `chat_messages` | insertUser, insertAssistant, insertSystem, listByProject, listByRun, setFeedback |
| `run.repository.ts` | `agent_runs` | create, setStatus, findById, findActiveByProject, listByProject, isActive |
| `attachment.repository.ts` | `chat_uploads` | insert, listByProject, listByRun, findById, countByRun |
| `checkpoint.repository.ts` | `checkpoints`, `rollback_history` | findById, findRowById, list, delete, markRolledBack, insertRollbackHistory |
| `index.ts` | — | Barrel: attachmentRepository, messageRepository, runRepository |

### 2.3 `server/agents/chat/chat-agent.ts` — 1 file

Pure LLM agent for `conversation` and `explain` intent modes. Injected `StreamWriter` interface. No `server/chat/` imports (by design — architecture contract in file header).

### 2.4 `server/replit_integrations/chat/` — 3 files

| File | Role |
|---|---|
| `routes.ts` | OpenRouter-based conversation CRUD + streaming (`/api/conversations/*`) |
| `storage.ts` | Drizzle facade over `conversations` + `messages` tables |
| `index.ts` | Barrel re-exporting `registerChatRoutes`, `chatStorage` |

These routes use a **separate** conversations/messages schema from the core agent-run system. They are a standalone integration layer, not wired into the main chat orchestrator.

---

## 3. Dependency Graph (Pre-Refactor)

```
main.ts
  ├── ./server/chat/index.ts  ← MISSING (ERR_MODULE_NOT_FOUND)
  └── ...

server/services/chat/chat.service.ts
  ├── ../../chat/orchestration/conversation-manager.ts  ← MISSING
  ├── ../../chat/messages/message-builder.ts            ← MISSING
  ├── ../../chat/messages/user-message.ts               ← MISSING
  ├── ../../chat/messages/system-message.ts             ← MISSING
  ├── ../../chat/context/context-loader.ts              ← MISSING
  ├── ../../chat/context/context-builder.ts             ← MISSING
  ├── ../../chat/persistence/run-writer.ts              ← MISSING
  ├── ../../chat/realtime/event-publisher.ts            ← MISSING
  ├── ../../chat/events/run.events.ts                   ← MISSING
  ├── ../../chat/events/checkpoint.events.ts            ← MISSING
  └── ../../chat/types/run.types.ts                     ← MISSING

server/services/chat/stream.service.ts
  ├── ../../chat/events/stream.events.ts                ← MISSING
  ├── ../../chat/realtime/event-publisher.ts            ← MISSING
  └── ../../chat/constants/stream.constants.ts          ← MISSING

server/services/chat/clarification.service.ts
  ├── ../../chat/questions/ambiguity-detector.ts        ← MISSING
  ├── ../../chat/questions/question-manager.ts          ← MISSING
  ├── ../../chat/realtime/event-publisher.ts            ← MISSING
  ├── ../../chat/events/question.events.ts              ← MISSING
  └── ../../chat/constants/stream.constants.ts          ← MISSING

server/services/chat/checkpoint.service.ts
  ├── ../../chat/persistence/checkpoint-store.ts        ← MISSING
  └── ../../chat/types/checkpoint.types.ts              ← MISSING

server/services/chat/context.service.ts
  ├── ../../chat/context/context-builder.ts             ← MISSING
  ├── ../../chat/context/context-loader.ts              ← MISSING
  └── ../../chat/types/message.types.ts                 ← MISSING

server/services/chat/session.service.ts
  └── ../../chat/types/chat.types.ts                    ← MISSING

server/services/chat/turn.service.ts
  └── ../../chat/types/chat.types.ts                    ← MISSING
```

**Total missing import targets:** 17 unique paths → expanded into 78 files to implement.

---

## 4. DB Schema Used by Chat

| Table | Purpose |
|---|---|
| `agent_runs` | Run lifecycle records (id = runId, projectId, goal, status, startedAt, endedAt, result) |
| `chat_messages` | Persisted messages (role, content, projectId, runId, tokensUsed, toolCalls, feedback) |
| `chat_uploads` | File attachment metadata (filename, mimeType, storedPath, sizeBytes, projectId, runId) |
| `checkpoints` | Snapshot records (checkpointId, projectId, runId, fileCount, createdFiles, modifiedFiles, deletedFiles, trigger, status, label, description, gitCommitSha) |
| `rollback_history` | Rollback audit log (checkpointId, projectId, runId, scope, status, restoredFiles, triggeredAt) |
| `conversations` | Replit integration conversations (separate from agent runs) |
| `messages` | Replit integration messages (separate from chat_messages) |

---

## 5. Identified Root Causes

1. **`server/chat/` directory never created** — all service imports were broken
2. **No entry facade** — `main.ts` expected `chatOrchestrator.mountRoutes()` and `chatOrchestrator.bootstrap()` but no file defined them
3. **Scoped services depended on an absent module layer** — 8 of 10 service files had ≥1 missing import
4. **No centralised types** — types (`ChatRun`, `ChatSession`, etc.) referenced but never defined
5. **Circular-safe architecture not implemented** — shim layer (`server/chat/orchestration/*`) was planned but not written

---

## 6. Target Structure (Phase 2 Plan)

```
server/chat/
├── api/           ← Express routers (7 files)
├── attachments/   ← Upload handling (5 files)
├── constants/     ← Shared constants (3 files)
├── context/       ← LLM context building (4 files)
├── controllers/   ← Route handlers (6 files)
├── events/        ← Event factory functions (6 files)
├── intent/        ← Intent routing shim (1 file)
├── llm/           ← LLM responder shim (1 file)
├── messages/      ← Message building (5 files)
├── orchestration/ ← Conversation/session/turn/stream shims + real conversation-manager (5 files)
├── persistence/   ← Store facades over repositories (8 files)
├── questions/     ← Ambiguity + Q&A + clarification (4 files)
├── realtime/      ← SSE/WS/heartbeat infrastructure (5 files)
├── run/           ← Run registry/cleanup (1 file)
├── schemas/       ← Zod validation schemas (4 files)
├── streams/       ← SSE frame utilities (1 file)
├── timeline/      ← Run event timeline (5 files)
├── types/         ← TypeScript type contracts (6 files)
└── index.ts       ← Public facade: mountRoutes + bootstrap
```

**Total: 78 files across 19 directories**
