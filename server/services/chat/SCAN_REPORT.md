# server/services/chat/ — Deep Scan Report

**Generated:** 2026-06-04  
**Total Files:** 8 (1 barrel + 7 service modules)  
**Entry Point:** `server/services/chat/index.ts` (alias: `@services/chat`)

---

## Directory Overview

```
server/services/chat/
├── index.ts                    ← Public barrel (single entry point)
├── chat-orchestrator.service.ts ← Chat run lifecycle coordinator
├── chat-responder.service.ts   ← LLM summary streamer
├── clarification.service.ts    ← Ambiguity detection & Q&A
├── intent.service.ts           ← User intent classifier
├── session.service.ts          ← Browser session manager
├── stream.service.ts           ← Token stream lifecycle
└── turn.service.ts             ← Turn lifecycle tracker
```

---

## Dependency Graph

```
index.ts (barrel)
  ├── chat-orchestrator.service.ts
  │     ├── intent.service.ts
  │     ├── session.service.ts
  │     ├── turn.service.ts
  │     ├── stream.service.ts
  │     ├── clarification.service.ts
  │     └── chat-responder.service.ts
  ├── chat-responder.service.ts
  │     └── stream.service.ts
  ├── clarification.service.ts   (no internal deps)
  ├── intent.service.ts          (no deps at all)
  ├── session.service.ts         (no internal deps)
  ├── stream.service.ts          (no internal deps)
  └── turn.service.ts            (no internal deps)
```

---

## File-by-File Breakdown

---

### 1. `index.ts` — Public Barrel (Entry Point)

**Kya karta hai:**  
Poore `server/services/chat/` ka ek aur sirf ek export surface. Bahar ka koi bhi module seedha sub-files import nahi karta — sab `@services/chat` alias se aata hai.

**Kya import karta hai (internally):**

| Import | Source File |
|--------|-------------|
| `chatOrchestrator`, `chatOrchestratorService`, `ChatOrchestratorError` | `./chat-orchestrator.service.ts` |
| `sessionManager`, `sessionService` | `./session.service.ts` |
| `turnManager`, `turnService`, `TurnError` | `./turn.service.ts` |
| `streamManager`, `streamService`, `StreamError` | `./stream.service.ts` |
| `routeIntent`, `isChatMode`, `intentService`, `IntentMode`, `IntentResult` | `./intent.service.ts` |
| `clarificationManager`, `clarificationService` | `./clarification.service.ts` |
| `streamRunSummary`, `chatResponderService` | `./chat-responder.service.ts` |

**Kaun import karta hai ise (consumers):**

| File | Kya use karta hai |
|------|-------------------|
| `server/chat/api/run-start.router.ts` | `chatOrchestrator` |
| `server/chat/controllers/run-controller.ts` | `chatOrchestrator` |
| `server/chat/run/registry.ts` | `turnManager`, `streamManager` |
| `server/chat/orchestration/chat-orchestrator.ts` *(shim)* | re-exports sab |
| `server/chat/orchestration/session-manager.ts` *(shim)* | re-exports `sessionManager`, `sessionService` |
| `server/chat/orchestration/stream-manager.ts` *(shim)* | re-exports `streamManager`, `streamService`, `StreamError` |
| `server/chat/orchestration/turn-manager.ts` *(shim)* | re-exports `turnManager`, `turnService`, `TurnError` |
| `server/chat/llm/chat-responder.ts` *(shim)* | re-exports `streamRunSummary`, `chatResponderService` |
| `server/chat/intent/intent-router.ts` *(shim)* | re-exports intent exports |
| `server/chat/questions/clarification-manager.ts` *(shim)* | re-exports clarification exports |

---

### 2. `chat-orchestrator.service.ts` — Chat Run Lifecycle Coordinator

**Kya karta hai:**  
Poore chat "run" ka main coordinator. User ka message receive karte hi: session register karta hai, intent route karta hai, context build karta hai (messages + memory), orchestration engine trigger karta hai, aur run complete/fail karta hai. Sab services ka central joiner.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `orchestrate`, `runManager` | `../../orchestration/index.ts` |
| `routeIntent` | `./intent.service.ts` |
| `sessionManager` | `./session.service.ts` |
| `turnManager` | `./turn.service.ts` |
| `streamManager` | `./stream.service.ts` |
| `clarificationManager` | `./clarification.service.ts` |
| `streamRunSummary` | `./chat-responder.service.ts` |
| `conversationManager` | `../../chat/orchestration/conversation-manager.ts` |
| `messageBuilder` | `../../chat/messages/message-builder.ts` |
| `buildUserPayload`, `buildAssistantPayload`, `buildBaseSystemPayload` | `../../chat/messages/*.ts` |
| `contextLoader`, `buildContext` | `../../chat/context/*.ts` |
| `timelineManager`, `runTimeline` | `../../chat/timeline/*.ts` |
| `eventPublisher` | `../../chat/realtime/event-publisher.ts` |
| `makeRunStartedEvent`, `makeRunCompletedEvent`, `makeRunFailedEvent` | `../../chat/events/run.events.ts` |
| `makeCheckpointCreatedPayload` | `../../chat/events/checkpoint.events.ts` |
| `chatCheckpointStore` | `../../chat/persistence/checkpoint-store.ts` |
| `runWriter` | `../../chat/persistence/run-writer.ts` |
| `bus` | `../../infrastructure/index.ts` |
| `memoryEngine`, `buildMemoryContextString` | `../../memory/index.ts` |
| `RunStartPayload`, `RunCancelResult`, `ChatRun` *(types)* | `../../chat/types/run.types.ts` |

**Exports:** `chatOrchestrator` (object), `chatOrchestratorService` (alias), `ChatOrchestratorError`

**Kaun import karta hai:** Sirf `index.ts` barrel ke through.

---

### 3. `chat-responder.service.ts` — LLM Summary Streamer

**Kya karta hai:**  
Orchestration engine kaam khatam hone ke baad user ko LLM-generated summary stream karta hai. Agar LLM key nahi hai ya request fail ho, toh fallback text deta hai.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `getLLMClient`, `hasLLMKey` | `../../shared/llm-client.ts` |
| `streamManager` | `./stream.service.ts` |
| `OrchestrationResult` *(type)* | `../../orchestration/types/orchestration.types.ts` |

**Exports:** `streamRunSummary` (function), `chatResponderService` (object)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)

---

### 4. `clarification.service.ts` — Ambiguity Detector & Q&A Manager

**Kya karta hai:**  
Jab user ka goal ambiguous ho toh detect karta hai, UI mein question send karta hai, answer ka wait karta hai, aur refined goal return karta hai. Puri clarification loop yahan handle hoti hai.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `analyzeAmbiguity`, `buildClarificationText` | `../../chat/questions/ambiguity-detector.ts` |
| `questionManager` | `../../chat/questions/question-manager.ts` |
| `eventPublisher` | `../../chat/realtime/event-publisher.ts` |
| `makeQuestionAskedEvent` | `../../chat/events/question.events.ts` |
| `ANSWER_POLL_MS`, `ANSWER_WAIT_TIMEOUT_MS` | `../../chat/constants/stream.constants.ts` |
| `ClarificationContext`, `ChatQuestion` *(types)* | `../../chat/types/question.types.ts` |

**Exports:** `clarificationManager` (object), `clarificationService` (alias)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)

---

### 5. `intent.service.ts` — User Intent Classifier

**Kya karta hai:**  
User ka message parse karke intent classify karta hai: `conversation`, `build`, `fix`, `modify`, `debug`, `explain`. Deterministic keyword scoring use karta hai — koi LLM call nahi. Decide karta hai ke Chat Agent use ho ya Orchestration Engine.

**Kya import karta hai:** Kuch nahi — fully self-contained.

**Exports:** `IntentMode` (type), `IntentResult` (type), `routeIntent` (function), `isChatMode` (function), `intentService` (object)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)

---

### 6. `session.service.ts` — Browser Session Manager

**Kya karta hai:**  
Ephemeral (non-persistent) chat sessions manage karta hai — browser tabs ya client connections. Sab in-memory, koi DB nahi.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `crypto` | Node.js stdlib |
| `ChatSession`, `SessionStatus` *(types)* | `../../chat/types/chat.types.ts` |

**Exports:** `sessionManager` (object), `sessionService` (alias)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)

---

### 7. `stream.service.ts` — Token Stream Lifecycle Manager

**Kya karta hai:**  
Active chat run ke token streams manage karta hai. Stream open karna, tokens append karna (SSE events publish karna), aur stream close karna — timeout bhi handle karta hai.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `makeStreamStartedEvent`, `makeStreamTokenEvent`, `makeStreamEndedEvent` | `../../chat/events/stream.events.ts` |
| `eventPublisher` | `../../chat/realtime/event-publisher.ts` |
| `MAX_STREAM_DURATION_MS` | `../../chat/constants/stream.constants.ts` |

**Exports:** `StreamError`, `streamManager` (object), `streamService` (alias)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)  
- `chat-responder.service.ts` (direct internal use)

---

### 8. `turn.service.ts` — Turn Lifecycle Tracker

**Kya karta hai:**  
Ek "turn" (user message → agent response cycle) ka lifecycle track karta hai. Status manage karta hai: `running`, `completed`, `failed`, `cancelled`. Duration bhi calculate karta hai.

**Kya import karta hai:**

| Import | Source |
|--------|--------|
| `crypto` | Node.js stdlib |
| `ChatTurn`, `TurnStatus` *(types)* | `../../chat/types/chat.types.ts` |

**Exports:** `TurnError`, `turnManager` (object), `turnService` (alias)

**Kaun import karta hai:**  
- `index.ts` (barrel)  
- `chat-orchestrator.service.ts` (direct internal use)

---

## External Dependencies Summary

Poore `server/services/chat/` ke modules jo external (outside this directory) cheezein import karte hain:

| External Module | Kaun use karta hai |
|-----------------|-------------------|
| `../../orchestration/index.ts` | `chat-orchestrator.service.ts` |
| `../../infrastructure/index.ts` | `chat-orchestrator.service.ts` |
| `../../memory/index.ts` | `chat-orchestrator.service.ts` |
| `../../shared/llm-client.ts` | `chat-responder.service.ts` |
| `../../orchestration/types/orchestration.types.ts` | `chat-responder.service.ts` |
| `../../chat/questions/*` | `clarification.service.ts` |
| `../../chat/realtime/event-publisher.ts` | `clarification.service.ts`, `stream.service.ts`, `chat-orchestrator.service.ts` |
| `../../chat/events/*` | `clarification.service.ts`, `stream.service.ts`, `chat-orchestrator.service.ts` |
| `../../chat/constants/stream.constants.ts` | `clarification.service.ts`, `stream.service.ts` |
| `../../chat/types/chat.types.ts` | `session.service.ts`, `turn.service.ts` |
| `../../chat/types/run.types.ts` | `chat-orchestrator.service.ts` |
| `../../chat/orchestration/conversation-manager.ts` | `chat-orchestrator.service.ts` |
| `../../chat/messages/*` | `chat-orchestrator.service.ts` |
| `../../chat/context/*` | `chat-orchestrator.service.ts` |
| `../../chat/timeline/*` | `chat-orchestrator.service.ts` |
| `../../chat/persistence/*` | `chat-orchestrator.service.ts` |
| `node:crypto` | `session.service.ts`, `turn.service.ts`, `chat-orchestrator.service.ts` |

---

## Key Observations

1. **`intent.service.ts` sabse independent hai** — zero imports, pure logic.
2. **`chat-orchestrator.service.ts` sabse heavy hai** — 20+ imports, poora system ka coordinator.
3. **`stream.service.ts` aur `turn.service.ts`** — lightweight, focused, ek hi kaam karte hain.
4. **Sab consumer files shim pattern follow karte hain** — `server/chat/orchestration/*.ts` files sirf re-export karte hain, business logic nahi rakhte.
5. **`@services/chat` alias** — bahar ki koi bhi file directly sub-modules import nahi kar sakti, sab index.ts ke through aate hain.
