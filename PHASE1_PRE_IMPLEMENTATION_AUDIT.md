# PHASE 1 PRE-IMPLEMENTATION AUDIT

**Date:** 2026-06-01  
**Status:** Audit complete — zero code changes made

---

## Files Scanned

| File | Purpose |
|---|---|
| `server/chat/orchestration/chat-orchestrator.ts` | Main entry — `startRun()` triggers all paths |
| `server/chat/index.ts` | Route barrel + chatOrchestrator facade |
| `server/chat/api/run-start.router.ts` | `POST /api/run` handler |
| `server/chat/llm/chat-responder.ts` | LLM streaming wrapper (post-orchestration) |
| `server/chat/orchestration/stream-manager.ts` | Token stream lifecycle |
| `server/chat/realtime/event-publisher.ts` | Bus emission wrapper |
| `server/chat/events/run.events.ts` | Run lifecycle event factories |
| `server/chat/types/message.types.ts` | Backend message types |
| `server/chat/messages/assistant-message.ts` | Assistant payload builder |
| `server/shared/llm-client.ts` | LLM singleton + key resolution |
| `client/src/components/chat/types.ts` | Frontend ChatMessage union |
| `client/src/components/chat/ChatMessages.tsx` | Message renderer |
| `client/src/components/chat/agent-event-handler.ts` | SSE event dispatch handler |

---

## Architecture Map (Current)

```
POST /api/run
    │
    ▼
run-start.router.ts
    │ calls chatOrchestrator.startRun(payload)
    ▼
chat-orchestrator.ts :: startRun()
    │
    ├─ [1] create/get conversation
    ├─ [2] register run (runManager + runWriter)
    ├─ [3] open session
    ├─ [4] start turn
    ├─ [5] persist user message
    ├─ [6] emit run.started event
    ├─ [7] persist system message
    ├─ [8] clarification check (non-blocking)
    ├─ [9] recall memory context
    ├─ [10] build context (contextLoader + contextBuilder)
    │
    └─ [11] void orchestrate({...}).then(async result => {
                 streamManager.open(runId, projectId)
                 streamRunSummary(runId, goal, result)   ← LLM summary
                 completeRun() or failRun()
             })
    │
    ▼ HTTP returns ChatRun immediately (non-blocking)
```

---

## Execution Flow Map

```
Every message regardless of content:

"Hello"         → orchestrate() → Planner → Executor → Verifier (WRONG)
"What is React" → orchestrate() → Planner → Executor → Verifier (WRONG)
"Build a CRM"   → orchestrate() → Planner → Executor → Verifier (correct)
"Fix auth bug"  → orchestrate() → Planner → Executor → Verifier (correct)
```

---

## Where orchestrate() Is Called

**Single location:** `server/chat/orchestration/chat-orchestrator.ts`, line 127  
```ts
void orchestrate({
  orchestrationId: crypto.randomUUID(),
  runId,
  projectId: String(projectId),
  sandboxRoot,
  goal,
}).then(async (result) => { ... })
```
This is the **only** call site. All changes go here.

---

## SSE Token Flow

```
chat-responder.ts
    streamManager.append(runId, token)
        │
        ▼
    eventPublisher.publish(makeStreamTokenEvent(runId, projectId, token))
        │
        ▼
    bus.emit('agent.event', { eventType: 'agent.token', payload: { token }, runId, ... })
        │
        ▼
    sse-manager → TOPIC.AGENT → client EventSource
        │
        ▼
    realtime-provider addEventListener('agent', handler)
        │
        ▼
    useAgentRunner → buildAgentHandler → case 'agent.token' → pushToken(token)
```

**Key insight:** `streamManager` uses `eventPublisher.publish(makeStreamTokenEvent)` which emits events with `eventType` field. The frontend handler reads `e.eventType` in the switch statement.

---

## Chat-Only Path Audit

**Finding:** No chat-only path exists.  
- No `intent === "chat"` branch
- No `ChatAgent` class/function
- No conversational bypass of `orchestrate()`
- The `ambiguity-detector.ts` only flags vague goals — it does NOT route differently

---

## Assistant Role Audit

**Backend** (`server/chat/types/message.types.ts`):  
`MessageRole = 'user' | 'assistant' | 'system' | 'tool'` — ✅ `assistant` exists

**Frontend** (`client/src/components/chat/types.ts`):  
```ts
type ChatMessage =
  | { role: "user";       content: string; ... }
  | { role: "agent";      content: string; ... }  ← used for all bot messages
  | { role: "tool_group"; ... }
  | { role: "diff"; ... }
  | { role: "checkpoint"; ... }
  | { role: "question"; ... }
  | { role: "plan"; ... }
  | { role: "completion"; ... }
```
❌ `assistant` role does NOT exist in the frontend union.

**Frontend renderer** (`ChatMessages.tsx` line 162-190):  
Catch-all checks `msg.role === "agent"` for AgentMarkdown. A message with `role: "assistant"` would fall through incorrectly (no matching branch).

---

## Existing LLM Wrappers

| File | Function | Usage |
|---|---|---|
| `server/shared/llm-client.ts` | `getLLMClient()` | Returns singleton OpenAI-compatible client |
| `server/shared/llm-client.ts` | `hasLLMKey()` | Guards LLM calls |
| `server/shared/llm-client.ts` | `getDefaultModel()` | `LLM_MODEL` env or `meta-llama/llama-3.3-70b-instruct` |
| `server/chat/llm/chat-responder.ts` | `streamRunSummary()` | Post-orchestration streaming — **reusable pattern** |

`chat-responder.ts` is the reference pattern for the new ChatAgent: `getLLMClient()` → streaming create → `streamManager.append()` per token.

---

## streamManager API

```ts
streamManager.open(runId, projectId)     // emits agent.stream.start
streamManager.append(runId, token)        // emits agent.token
streamManager.close(runId): string        // emits agent.stream.end, returns content
streamManager.isActive(runId): boolean
```

---

## Blockers Found

| # | Blocker | Severity |
|---|---|---|
| 1 | No intent router — all messages hit `orchestrate()` | Critical |
| 2 | No ChatAgent — no conversational bypass path | Critical |
| 3 | `assistant` role missing from frontend `ChatMessage` union | Medium |
| 4 | `run.started/completed/failed` not handled in `agent-event-handler.ts` | Low-Medium |

---

## Insertion Points

| Change | File | Location |
|---|---|---|
| Import intent router + chat agent | `chat-orchestrator.ts` | Top of file |
| Branch before `orchestrate()` | `chat-orchestrator.ts` | Line 127 (step 11) |
| Create intent router | `server/chat/intent/intent-router.ts` | New file |
| Create chat agent | `server/agents/chat/chat-agent.ts` | New file |
| Add `assistant` to ChatMessage union | `client/src/components/chat/types.ts` | Line 39 |
| Render `assistant` in catch-all | `client/src/components/chat/ChatMessages.tsx` | Line 162-190 |
| Handle lifecycle events | `client/src/components/chat/agent-event-handler.ts` | Add cases to switch |
