# Chat System Architecture Report

> Generated from live code scan — no assumptions, no guesses.
> All file paths, function names, and flow traces are based on actual source.

---

## 1. Folder Structure

```
server/chat/
├── api/
│   ├── attachment.routes.ts       # POST /api/chat/attachments/*
│   ├── chat.routes.ts             # POST /api/chat/message, GET /api/chat/conversations
│   ├── checkpoint.routes.ts       # GET/POST /api/checkpoints/*
│   ├── history.routes.ts          # GET /api/chat/history
│   ├── question.routes.ts         # POST /api/chat/questions/:id/answer
│   ├── run.routes.ts              # GET /api/chat/runs/*, GET /api/chat/runs/active
│   └── run-start.router.ts        # POST /api/run, POST /api/run/:id/cancel  ← PRIMARY RUN ENTRY
├── attachments/
│   ├── attachment-manager.ts
│   ├── attachment-validator.ts
│   ├── file-processor.ts
│   ├── image-processor.ts
│   └── upload-handler.ts
├── constants/
│   ├── chat.constants.ts
│   ├── event.constants.ts
│   └── stream.constants.ts
├── context/
│   ├── context-builder.ts         # Assembles LLM context window
│   ├── context-cache.ts           # Per-run context cache (Map)
│   ├── context-loader.ts          # Loads messages for a run; invalidate()
│   └── context-window.ts
├── controllers/
│   ├── attachment-controller.ts
│   ├── chat-controller.ts         # sendMessage, setFeedback, listConversations
│   ├── checkpoint-controller.ts
│   ├── history-controller.ts
│   ├── question-controller.ts
│   └── run-controller.ts          # listActive, listByProject, getStatus, cancel
├── events/
│   ├── chat.events.ts
│   ├── checkpoint.events.ts       # makeCheckpointCreatedPayload()
│   ├── question.events.ts
│   ├── run.events.ts              # makeRunStartedEvent, makeRunCompletedEvent, makeRunFailedEvent
│   ├── stream.events.ts
│   └── timeline.events.ts
├── intent/
│   └── intent-router.ts           # routeIntent() — deterministic keyword scorer; no LLM
├── llm/
│   └── chat-responder.ts          # streamRunSummary() — post-run LLM summary streamer
├── messages/
│   ├── assistant-message.ts       # buildAssistantPayload()
│   ├── message-builder.ts         # buildUser(), buildSystem(), buildAssistant()
│   ├── message-validator.ts
│   ├── system-message.ts          # buildBaseSystemPayload()
│   └── user-message.ts            # buildUserPayload()
├── orchestration/
│   ├── chat-orchestrator.ts       # startRun(), completeRun(), failRun(), cancelRun()
│   ├── conversation-manager.ts    # create(), get(), listByProject(), onMessageAdded()
│   ├── session-manager.ts         # open(), close()
│   ├── stream-manager.ts          # open(), isActive(), append(), close()
│   └── turn-manager.ts            # start(), complete(), fail(), cancel(), getByRun()
├── persistence/
│   ├── attachment-store.ts
│   ├── chat-store.ts
│   ├── checkpoint-store.ts        # chatCheckpointStore — createForRun(), rollback(), diff
│   ├── conversation-store.ts
│   ├── message-store.ts           # insertUser(), setFeedback() — legacy wrapper
│   ├── run-store.ts               # thin delegate → runRepository (kept for compat)
│   ├── run-writer.ts              # create(), setStatus() — direct DB writes
│   └── workspace-scanner.ts      # captureWorkspaceSnapshot() for manual checkpoints
├── questions/
│   ├── ambiguity-detector.ts
│   ├── answer-manager.ts
│   ├── clarification-manager.ts   # maybeAskClarification() — non-blocking
│   └── question-manager.ts        # cancelByRun() — called on cleanup
├── realtime/
│   ├── connection-registry.ts
│   ├── event-publisher.ts         # publish() → bus.emit('agent.event')
│   ├── heartbeat-manager.ts       # start() — ping loop
│   ├── sse-manager.ts             # delegates to infraSseManager
│   └── websocket-manager.ts       # register() — /ws/chat per projectId
├── run/
│   └── registry.ts                # unregisterRun() — cleanup coordinator (not a registry)
├── schemas/
│   ├── attachment.schema.ts
│   ├── chat.schema.ts             # sendMessageSchema, feedbackSchema
│   ├── question.schema.ts
│   └── run.schema.ts              # cancelRunSchema, runIdParamSchema, runStatusQuerySchema
├── streams/
│   └── sse-utils.ts
├── timeline/
│   ├── event-timeline.ts          # clear() per runId
│   ├── run-timeline.ts            # recordStarted/Completed/Failed/Cancelled()
│   ├── timeline-manager.ts        # clear()
│   ├── timeline-publisher.ts
│   └── tool-timeline.ts
├── types/
│   ├── chat.types.ts              # Conversation, ChatSession, ChatTurn
│   ├── checkpoint.types.ts        # ChatCheckpoint, CheckpointTrigger, RollbackResult
│   ├── event.types.ts             # RunStartedEvent, StreamTokenEvent, etc.
│   ├── message.types.ts           # ChatMessageRecord, MessageRole, StreamChunk
│   ├── question.types.ts          # ChatQuestion, AskQuestionPayload, AnswerPayload
│   └── run.types.ts               # ChatRun, RunStartPayload, RunStatus, RunCancelResult
└── index.ts                       # Module bootstrap + public API + chatOrchestrator facade

client/src/components/chat/
├── cards/
│   ├── ActionCardRegistry.tsx     # Maps tool names → card components
│   ├── ActionSummaryBar.tsx
│   ├── ActionTimeline.tsx
│   ├── DatabaseCard.tsx
│   ├── DeployCard.tsx
│   ├── DiffAcceptRejectBar.tsx
│   ├── FileOpenCard.tsx
│   ├── FileWriteCard.tsx
│   ├── GitCard.tsx
│   ├── index.ts
│   ├── PackageCard.tsx
│   ├── PlanningCard.tsx
│   ├── ScreenshotCard.tsx
│   └── TerminalCard.tsx
├── checkpoints/
│   ├── CheckpointChangesPanel.tsx
│   ├── CheckpointDetailsPanel.tsx
│   ├── CheckpointRollbackDialog.tsx
│   ├── CheckpointTimelineItem.tsx
│   ├── CheckpointUtils.ts
│   └── index.ts
├── handlers/
│   ├── message-handler.ts         # Q&A, agent.message, run lifecycle SSE events
│   ├── plan-handler.ts            # recovery, plan, phase, file, diff SSE events
│   ├── stream-handler.ts          # streaming tokens, thinking, retry, replanning
│   └── tool-handler.ts            # tool_call, shell.output, tool.completed/error
├── ActionGroup.tsx
├── agent-event-handler.ts         # Dispatcher → routes SSE events to 4 sub-handlers
├── AgentModeMenu.tsx              # Power / Lite / Auto mode selector
├── buildSubscriptions.ts          # buildCheckpointSubscription, buildLifecycleSubscription
├── ChatHeader.tsx                 # Toolbar + ChatHistoryPanel
├── ChatInput.tsx                  # Textarea + AgentModeMenu + UploadPopup + stop btn
├── ChatMessages.tsx               # Message list renderer
├── index.tsx                      # ChatPanel — root component, owns layout
├── LiveActionBar.tsx
├── QuestionCard.tsx               # Renders agent clarification Q + answer input
├── submitRun.ts                   # Pure fetch: POST /api/run → returns runId
├── tool-animations.ts
├── tool-helpers.ts                # fetchFileContent, fetchChatHistory, fetchChatPrompts
├── ToolGroupLine.tsx
├── tool-icons.ts
├── tool-maps.ts
├── types.ts                       # ChatMessage union type
├── TypingIndicator.tsx
├── UploadPopup.tsx
├── useAgentRunner.ts              # Core hook — run lifecycle coordinator
└── UserMessageBubble.tsx
```

---

## 2. File Responsibilities

### Backend — Key Files

| File | Actual Role | Public Functions |
|------|-------------|-----------------|
| `index.ts` | Bootstrap + facade + re-exports | `chatOrchestrator.mountRoutes()`, `.bootstrap()` |
| `orchestration/chat-orchestrator.ts` | **Workflow owner** — all run lifecycle stages | `startRun()`, `completeRun()`, `failRun()`, `cancelRun()` |
| `orchestration/conversation-manager.ts` | In-memory conversation CRUD | `create()`, `get()`, `listByProject()`, `onMessageAdded()` |
| `orchestration/session-manager.ts` | Session open/close tracking | `open()`, `close()` |
| `orchestration/turn-manager.ts` | Per-turn state machine | `start()`, `complete()`, `fail()`, `cancel()`, `getByRun()`, `clearCompleted()` |
| `orchestration/stream-manager.ts` | In-memory token accumulator | `open()`, `isActive()`, `append()`, `close()` |
| `intent/intent-router.ts` | Keyword-scored intent classifier | `routeIntent()`, `isChatMode()` |
| `llm/chat-responder.ts` | Post-run LLM summary streamer | `streamRunSummary()` |
| `persistence/checkpoint-store.ts` | Full checkpoint CRUD + rollback | `createForRun()`, `createManual()`, `rollback()`, `diffCheckpoints()`, `deleteCheckpoint()` |
| `persistence/run-writer.ts` | Writes `agent_runs` rows to DB | `create()`, `setStatus()` |
| `persistence/run-store.ts` | Read-only delegate → `runRepository` | `findById()`, `listByProject()`, `isActive()` |
| `persistence/message-store.ts` | Legacy wrapper — delegates to repo | `insertUser()`, `setFeedback()` |
| `realtime/event-publisher.ts` | Thin bus adapter | `publish()`, `publishRaw()` — both emit to `bus('agent.event')` |
| `realtime/sse-manager.ts` | Delegates to infra SSE hub | `register()` |
| `realtime/websocket-manager.ts` | Per-project WS connections | `register()` |
| `realtime/heartbeat-manager.ts` | Keep-alive ping loop | `start()` |
| `run/registry.ts` | Run cleanup coordinator | `unregisterRun()` — calls 5 sub-systems |
| `api/run-start.router.ts` | **Primary run entry point** | `POST /api/run`, `POST /api/run/:id/cancel` |
| `api/run.routes.ts` | Secondary run read routes | `GET /api/chat/runs/active`, `/runs/:id`, `/runs` |

---

## 3. Service Detection Report

| File Path | Current Role | Actual Role | Should Move? | Reason |
|-----------|-------------|-------------|-------------|--------|
| `orchestration/chat-orchestrator.ts` | "Orchestrator" | **Application Service** — owns the full run workflow | No | Correctly placed; it's the chat module's single coordinator |
| `orchestration/conversation-manager.ts` | "Manager" | **In-memory repository** — CRUD over a Map, no business logic | No | Fine where it is; it's chat-scoped state |
| `orchestration/turn-manager.ts` | "Manager" | **State machine service** — transitions: start→complete/fail/cancel | No | Turn lifecycle is intrinsically chat-domain |
| `orchestration/stream-manager.ts` | "Manager" | **Buffer/accumulator service** — holds live token strings | No | Correctly scoped to chat module |
| `intent/intent-router.ts` | "Router" | **Domain service** — pure classification logic | No | Well-isolated, correctly placed |
| `llm/chat-responder.ts` | "Responder" | **LLM service** — streaming summary generation | No | Correctly lives in chat/llm/ |
| `persistence/checkpoint-store.ts` | "Store" | **Repository + Domain Service** — contains rollback business logic | Consider splitting | The rollback logic (file I/O, audit trail) is business logic mixed into persistence |
| `persistence/run-store.ts` | "Store" | **Thin delegate** — only proxies `runRepository` | No — but redundant | Kept only for backward compatibility; `runRepository` should be imported directly in new code |
| `persistence/message-store.ts` | "Store" | **Legacy wrapper** — proxies repository | No — but redundant | Same situation as `run-store.ts` |
| `realtime/event-publisher.ts` | "Publisher" | **Infrastructure adapter** — just wraps `bus.emit` | No | Correct abstraction boundary |

---

## 4. Frontend Component Map

```
ChatPanel (index.tsx)                          ← root; owns layout + state orchestration
│   State: chatInput, showNewChatScreen, showHistoryPanel
│   Hooks: useAgentRunner, useQuery (history, prompts)
│   API: GET /api/chat/history, GET /api/chat/prompts
│
├── ChatHeader (ChatHeader.tsx)
│   Props: showHistoryPanel, onToggleHistory, onNewChat, chatHistory
│   Events: toggle history, new chat
│
├── ChatHistoryPanel (ChatHeader.tsx)          ← rendered by ChatPanel conditionally
│   Props: chatHistory, onClose
│
├── ChatMessages (ChatMessages.tsx)
│   Props: messages, isAgentThinking, isAgentTyping, activeAction,
│          showNewChatScreen, suggestedPrompts, onOpenFile, onAnswer, onSelectPrompt
│   Children:
│   ├── UserMessageBubble        — renders user messages
│   ├── TypingIndicator          — streaming dots
│   ├── QuestionCard             — agent clarification Q + inline answer input
│   ├── PlanningCard (cards/)    — planning phase visualization
│   ├── ActionGroup              — groups tool cards
│   │   └── [ActionCardRegistry] — maps tool name → card:
│   │       FileWriteCard, FileOpenCard, TerminalCard, DatabaseCard,
│   │       DeployCard, GitCard, PackageCard, ScreenshotCard
│   ├── CheckpointTimelineItem   — checkpoint bubble in message stream
│   └── LiveActionBar            — live running action display
│
└── ChatInput (ChatInput.tsx)
    Props: chatInput, setChatInput, chatInputRef, isAgentThinking,
           isAgentTyping, onSend, onStop
    Children:
    ├── AgentModeMenu            — Power / Lite / Auto selector
    └── UploadPopup              — file attachment picker
```

### Hook Ecosystem

| Hook | File | Responsibility |
|------|------|----------------|
| `useAgentRunner` | `useAgentRunner.ts` | Run lifecycle coordinator — owns all SSE subscriptions |
| `useTokenStream` | `@/hooks/useTokenStream` | RAF-buffered streaming token state |
| `useRunReattach` | `@/hooks/useRunReattach` | Re-attaches to in-flight run on page refresh |
| `useRunRecovery` | `@/realtime/useRunRecovery` | Polls for `activeRunId` in project |
| `useRealtime` | `@/realtime/realtime-provider` | SSE `subscribe(topic, handler)` context |
| `useAgentMode` | `@/hooks/useAgentMode` | Returns power/lite/auto mode from localStorage |

---

## 5. Frontend ↔ Backend Flow Map

### Send Message / Start Run
```
ChatPanel.handleSend()
  → useAgentRunner.runAgent(msg)
    → submitRun.ts: POST /api/run  { projectId, goal, mode }
      → run-start.router.ts
        → run-controller.ts (or inline handler)
          → chatOrchestrator.startRun(payload)
            → conversationManager.create()        [in-memory]
            → runManager.register(runId)           [infra in-memory]
            → runWriter.create(runId)              [DB: agent_runs INSERT]
            → sessionManager.open()
            → turnManager.start()
            → messageBuilder.buildUser()           [DB: chat_messages INSERT]
            → eventPublisher.publish(run.started)  [bus → SSE fan-out]
            → clarificationManager.maybeAskClarification()  [non-blocking]
            → memoryEngine.store()                 [fire-and-forget]
            → contextLoader.loadForRun()
            → routeIntent(goal)                    [deterministic]
            → orchestrate({runId, projectId, goal})  [async fire-and-forget]
          ← returns ChatRun immediately (HTTP 200)
    ← runId
  → subscribe("agent", buildAgentHandler)
  → subscribe("checkpoint", buildCheckpointSubscription)
  → subscribe("lifecycle", buildLifecycleSubscription)
```

### Streaming Response (SSE)
```
orchestrate() completes
  → streamRunSummary(runId, goal, result)         [LLM stream or fallback]
    → streamManager.append(runId, token)          [in-memory buffer]
    → eventPublisher.publish(stream.token)        [bus → SSE fan-out]
      → client SSE: topic="agent", eventType="stream.token"
        → stream-handler.ts: pushToken(token)
          → useTokenStream: RAF-buffered setState

→ chatOrchestrator.completeRun()
  → streamManager.close(runId)
  → messageBuilder.buildAssistant()              [DB INSERT]
  → runWriter.setStatus("completed")             [DB UPDATE]
  → eventPublisher.publish(run.completed)        [bus → SSE: topic="agent"]
  → bus.emit("run.lifecycle", {completed})       [SSE: topic="lifecycle"]
  → chatCheckpointStore.createForRun()           [DB INSERT: checkpoints]
    → bus.emit("checkpoint", payload)            [SSE: topic="checkpoint"]

client SSE lifecycle handler:
  → buildLifecycleSubscription: status="completed"
    → finalizeStream(), flushGroup()
    → setMessages([...completionMsg, checkpointMsg])
    → setIsAgentThinking(false)
```

### Checkpoint Creation
```
chatOrchestrator.completeRun()
  → chatCheckpointStore.createForRun(runId, projectId, goal)
    → db.select(agentRuns)                       [get run start time]
    → db.select(diffQueue)                       [files changed in window]
    → db.select(toolExecutions)                  [write_file calls]
    → captureGitSha(SANDBOX)
    → db.insert(checkpoints)                     [snapshots stored as JSONB]
  → bus.emit("checkpoint", makeCheckpointCreatedPayload(cp))
    → SSE fan-out: topic="checkpoint"
      → buildCheckpointSubscription on client
        → setMessages([...checkpointMsg])
```

### Checkpoint Rollback
```
CheckpointRollbackDialog → POST /api/checkpoints/:id/rollback
  → checkpoint-controller.ts
    → chatCheckpointStore.rollback(checkpointId)
      → db.select(checkpoints)                  [get fileSnapshots JSONB]
      → for each file: safeWriteFile or safeDeleteFile
      → db.update(checkpoints, status="rolled_back")
      → db.insert(rollbackHistory)              [audit trail]
      ← RollbackResult { ok, filesRestored, rollbackId }
```

### Cancel Run
```
ChatInput stop button → useAgentRunner.stopAgent()
  → finalizeStream()
  → agentStreamRef.current.close()            [unsubscribe all SSE handlers]
  → fetch POST /api/run/:runId/cancel
    → run-start.router.ts → runController.cancel()
      → chatOrchestrator.cancelRun(runId)
        → streamManager.close(runId)
        → turnManager.cancel(turnId)
        → runManager.setStatus("cancelled")
        → runWriter.setStatus("cancelled")    [DB UPDATE]
        → bus.emit("run.lifecycle", {cancelled})
```

### Agent Q&A
```
agent emits agent.question SSE event
  → message-handler.ts on client
    → setMessages([...QuestionCard])

user answers in QuestionCard
  → useAgentRunner.handleAnswer(questionId, runId, answer)
    → POST /api/chat/answer { runId, questionId, answer }
      → question-controller.ts
        → answer-manager.answerQuestion()
          → bus.emit to unblock orchestration engine
    → setMessages: marks question as answered locally
```

### File Attachments
```
UploadPopup → selects file
  → POST /api/chat/attachments  (multipart)
    → attachment-controller.ts
      → upload-handler.ts → file-processor.ts / image-processor.ts
        → attachment-store.ts → db INSERT
      ← attachmentId
→ included in next POST /api/run payload
```

---

## 6. Lifecycle Audit

| Stage | File | Function | Trigger | Next Stage |
|-------|------|----------|---------|-----------|
| **User Message** | `useAgentRunner.ts` | `runAgent(msg)` | User hits send | Request Validation |
| **Request Validation** | `run-start.router.ts` + `run.schema.ts` | `runStartSchema.safeParse()` | POST /api/run | Conversation Load |
| **Conversation Load** | `chat-orchestrator.ts` | `conversationManager.create/get()` | `startRun()` step 1 | Run Creation |
| **Run Creation** | `chat-orchestrator.ts` + `run-writer.ts` | `runManager.register()` + `runWriter.create()` | `startRun()` step 2 | Agent Execution |
| **Agent Execution** | `orchestration/index.ts` | `orchestrate()` | Fire-and-forget at step 11 | Tool Calls |
| **Tool Calls** | `server/agents/**` | Per-agent tool execution | Inside `orchestrate()` | Memory Update |
| **Memory Update** | `memory/index.ts` | `memoryEngine.store()` | `startRun()` (fire-and-forget) + agent events | Checkpoint Save |
| **Checkpoint Save** | `checkpoint-store.ts` | `chatCheckpointStore.createForRun()` | `completeRun()` after orchestration | Streaming Response |
| **Streaming Response** | `chat-responder.ts` + `stream-manager.ts` | `streamRunSummary()` + `streamManager.append()` | `orchestrate()` resolves | Completion |
| **Completion** | `chat-orchestrator.ts` | `completeRun()` or `failRun()` | orchestration `.then()` | Audit Logging |
| **Audit Logging** | `checkpoint-store.ts` + `run-writer.ts` | `db.insert(rollbackHistory)` + `runWriter.setStatus()` | Inside rollback / completeRun | — |

> **Missing stages:** None critical. `clarificationManager.maybeAskClarification()` is non-blocking and sits between Run Creation and Agent Execution, acting as an optional gating stage if the agent needs user input before proceeding.

---

## 7. Replit-Style Capability Audit

| Capability | Status | Evidence |
|------------|--------|---------|
| **Run lifecycle** (start → complete/fail/cancel) | ✅ Exists | `chat-orchestrator.ts`: `startRun`, `completeRun`, `failRun`, `cancelRun` |
| **Checkpoints** (auto + manual + rollback) | ✅ Exists | `checkpoint-store.ts`: `createForRun`, `createManual`, `rollback`, `diffCheckpoints` |
| **Memory** (store + recall) | ✅ Exists | `memoryEngine.store()` in `startRun`; `buildMemoryContextString()` for context enrichment |
| **Streaming tokens** | ✅ Exists | `stream-manager.ts` + `chat-responder.ts` → SSE token fan-out |
| **SSE** (multi-topic fan-out) | ✅ Exists | `index.ts` GET `/api/chat/stream`; topics: `agent`, `checkpoint`, `lifecycle` |
| **WebSocket** (per-project) | ✅ Exists | `websocket-manager.ts`; `bootstrap()` in `index.ts` handles `/ws/chat` upgrades |
| **Persistence** (runs, messages, checkpoints) | ✅ Exists | `run-writer.ts`, `message-builder.ts`, `checkpoint-store.ts` → Drizzle → PostgreSQL |
| **Recovery / reattach** | ✅ Exists | `useRunReattach` hook + `useRunRecovery` — re-subscribes SSE on page refresh |
| **Agent coordination** (multi-agent) | ✅ Exists | `server/agents/`: Planner, Executor, Verifier, Terminal, Filesystem, Supervisor, Browser |
| **Multi-step execution** (11 phases) | ✅ Exists | `server/orchestration/index.ts` — `orchestrate()` runs sequential phase pipeline |
| **Event bus** | ✅ Exists | `bus` from `infrastructure/index.ts`; keys: `agent.event`, `run.lifecycle`, `checkpoint` |
| **Intent classification** | ✅ Exists | `intent-router.ts`: 6 modes, deterministic keyword scoring, no LLM call |
| **Rollback audit trail** | ✅ Exists | `db.insert(rollbackHistory)` in `checkpoint-store.ts:rollback()` |
| **Graceful fallback (no API key)** | ✅ Exists | `chat-responder.ts`: `hasLLMKey()` guard → structured text fallback |

---

## 8. Dependency Graph

```
main.ts
  └── server/chat/index.ts                      [chatOrchestrator.mountRoutes + .bootstrap]
        ├── api/run-start.router.ts             POST /api/run
        │     └── orchestration/chat-orchestrator.ts
        │           ├── orchestration/index.ts  [orchestrate()]         ← CORE ENGINE
        │           ├── intent/intent-router.ts [routeIntent()]
        │           ├── orchestration/conversation-manager.ts
        │           ├── orchestration/session-manager.ts
        │           ├── orchestration/turn-manager.ts
        │           ├── orchestration/stream-manager.ts
        │           ├── messages/message-builder.ts
        │           │     └── repositories/chat/message.repository.ts
        │           │           └── infrastructure/index.ts [db]
        │           ├── questions/clarification-manager.ts
        │           ├── context/context-loader.ts
        │           │     └── context/context-cache.ts
        │           ├── timeline/run-timeline.ts
        │           ├── realtime/event-publisher.ts → infrastructure/bus
        │           ├── persistence/checkpoint-store.ts
        │           │     ├── shared/schema.ts
        │           │     └── infrastructure/index.ts [db, safeWriteFile]
        │           ├── llm/chat-responder.ts
        │           │     └── shared/llm-client.ts [getLLMClient]
        │           └── memory/index.ts [memoryEngine, buildMemoryContextString]
        ├── api/chat.routes.ts → controllers/chat-controller.ts
        ├── api/run.routes.ts → controllers/run-controller.ts
        ├── api/checkpoint.routes.ts → controllers/checkpoint-controller.ts
        ├── api/history.routes.ts → controllers/history-controller.ts
        ├── api/question.routes.ts → controllers/question-controller.ts
        ├── api/attachment.routes.ts → controllers/attachment-controller.ts
        ├── realtime/heartbeat-manager.ts
        └── realtime/websocket-manager.ts

client/src/main.tsx
  └── App.tsx → Workspace.tsx
        └── ChatPanel (index.tsx)
              ├── useAgentRunner.ts
              │     ├── submitRun.ts                POST /api/run
              │     ├── agent-event-handler.ts      SSE dispatcher
              │     │     ├── handlers/stream-handler.ts
              │     │     ├── handlers/tool-handler.ts
              │     │     ├── handlers/plan-handler.ts
              │     │     └── handlers/message-handler.ts
              │     ├── buildSubscriptions.ts       checkpoint + lifecycle SSE handlers
              │     ├── @/hooks/useTokenStream      RAF token buffer
              │     ├── @/hooks/useRunReattach      page-refresh recovery
              │     └── @/realtime/realtime-provider [subscribe()]
              ├── ChatMessages.tsx
              │     ├── cards/ActionCardRegistry.tsx
              │     ├── checkpoints/CheckpointTimelineItem.tsx
              │     └── QuestionCard.tsx
              └── ChatInput.tsx
                    ├── AgentModeMenu.tsx
                    └── UploadPopup.tsx
```

> **⚠ Circular dependency risk:** `chat-orchestrator.ts` imports `orchestration/index.ts` (the engine), and the engine emits events via `bus` which are consumed by `event-publisher.ts` (also imported by chat-orchestrator). No true circular import — mediated by the event bus — but the logical coupling is tight.

> **Infrastructure bypass note:** `checkpoint-store.ts` imports `db` from `infrastructure/index.ts` directly (no repository layer). Intentional — the checkpoint domain is complex enough to warrant direct DB access — but it means there is no `checkpointRepository` for testability.

---

## 9. Dead Code & Unused Systems

| Item | Location | Evidence |
|------|----------|---------|
| `use-agent-stream.ts` | `client/src/hooks/` | Explicitly marked `DEPRECATED` in file — stub only |
| `persistence/run-store.ts` | `server/chat/` | File comment: "kept for backward-compat. Import runRepository directly for new code" |
| `persistence/message-store.ts` | `server/chat/` | Same pattern — legacy wrapper; new code should use repository directly |
| `run/registry.ts` (name misleading) | `server/chat/` | Named "registry" but is actually a cleanup coordinator — no registration API, only `unregisterRun()` |
| Legacy aliases in `index.ts` | `server/chat/index.ts:124-126` | `buildChatRouter()`, `attachWebSocket()`, `startPersistence()` — marked "Legacy aliases (kept for backward compatibility)" |

---

## 10. Architecture Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Separation of concerns** | 9/10 | Controllers, orchestrators, persistence, realtime all cleanly separated |
| **Type safety** | 9/10 | Zod schemas at HTTP boundary; typed event bus; typed SSE payloads |
| **Error handling** | 9/10 | `chat-responder.ts` never throws; `routeIntent` never throws; `failRun` always cleans up |
| **Observability** | 8/10 | Timeline system, `bus.emit`, console logs; no distributed tracing |
| **Testability** | 6/10 | `checkpoint-store` bypasses repository layer; `conversation-manager` is in-memory Map (not injectable) |
| **Recovery / resilience** | 8/10 | `useRunReattach`, `useRunRecovery`, fallback messages, stream fallback without API key |
| **Real-time architecture** | 9/10 | Three SSE topics + WS, heartbeat, RAF-buffered token streaming |
| **Dead code** | 8/10 | Minimal — 3 legacy wrappers, 1 deprecated hook, 3 alias methods |

---

## 11. Critical Risks

### Risk 1 — In-memory conversation state lost on restart
`conversation-manager.ts` is a pure in-memory Map. If the API server restarts, all active conversation state is lost. Conversations are not hydrated from the DB on startup — only `agent_runs` are. A user mid-conversation will lose context after a server restart.

### Risk 2 — Partial rollback with no compensation
`checkpoint-store.ts:rollback()` loops over file snapshots calling `safeWriteFile`/`safeDeleteFile`. If the DB `UPDATE` succeeds but a `safeWriteFile` fails mid-loop, the checkpoint is marked `rolled_back` but the filesystem is partially restored. No saga/compensation pattern exists to handle this.

### Risk 3 — Intent router can mis-classify edge cases
`routeIntent()` uses deterministic keyword sets with hardcoded weights — no LLM call. A goal like `"explain how to build a dashboard"` competes between `explain` and `build`. The margin guard (line 186–197 of `intent-router.ts`) defers to the code-action mode if the margin is < 1.3, which is intentional but can produce surprising behaviour on mixed-intent phrases.

### Risk 4 — No authentication on run endpoints
No request authentication is visible in any controller. Any client that can reach the server can `POST /api/run` and trigger a full orchestration cycle.

### Risk 5 — OPENROUTER_API_KEY not configured
The `hasLLMKey()` guard in `chat-responder.ts` fires the fallback path when the key is absent. Agents execute normally but post-run summaries are structured template text rather than natural language responses.

---

## 12. Missing Systems

| System | Impact | Notes |
|--------|--------|-------|
| **Conversation DB hydration on restart** | High | `conversationManager` is pure in-memory; lost on API restart |
| **Checkpoint repository layer** | Medium | Direct `db` access in `checkpoint-store.ts` — no injectable repository for unit testing |
| **Rate limiting on `/api/run`** | High | No throttle — user can flood the orchestration engine with concurrent runs |
| **Authentication / authorization** | High | No request authentication in any controller |
| **Distributed tracing** | Low | No trace IDs propagated across agent→orchestration→tool chain |

---

## 13. Recommended Future Chat Architecture

```
Recommended layering (for reference — no immediate changes required):

HTTP Layer          run-start.router.ts, api/*.routes.ts
      ↓
Middleware          auth.middleware.ts, rate-limiter.middleware.ts  ← ADD
      ↓
Controller Layer    controllers/*.ts  (Zod validation only)
      ↓
Application Layer   chat-orchestrator.ts  (workflow coordination only)
      ↓
Domain Services     intent-router, clarification-manager, stream-manager, turn-manager
      ↓
Repository Layer    repositories/chat/*.ts  (ALL DB access here — incl. checkpoints)  ← EXTEND
      ↓
Infrastructure      db, bus, sseManager, safeWriteFile

Key changes to reach this state:
  1. Extract checkpoint.repository.ts from checkpoint-store.ts
     (move DB ops out; keep rollback business logic in a CheckpointService)
  2. Add conversationRepository that persists to DB + hydrates Map on startup
  3. Add rate limiter middleware on POST /api/run (e.g. express-rate-limit)
  4. Add auth middleware (Replit Auth header check) to all /api/* routes
  5. Remove run-store.ts and message-store.ts; import runRepository/messageRepository directly
```
