# REPLIT PARITY ARCHITECTURE AUDIT

**Date:** 2026-06-01  
**Scope:** Full deep scan — server/chat, server/orchestration, server/agents, server/infrastructure, client/src/components/chat, client/src/realtime  
**Status:** Audit only — zero code changes made

---

## 1. FILES SCANNED

### Server
| Area | Files / Directories |
|---|---|
| Chat entrypoint | `server/chat/index.ts` |
| Chat routes | `server/chat/api/chat.routes.ts`, `run-start.router.ts`, `history.routes.ts`, `attachment.routes.ts`, `checkpoint.routes.ts` |
| Chat orchestration | `server/chat/orchestration/chat-orchestrator.ts`, `stream-manager.ts`, `session-manager.ts` |
| Chat events | `server/chat/realtime/event-publisher.ts` |
| Chat questions | `server/chat/questions/ambiguity-detector.ts`, `clarification-manager.ts` |
| Orchestration core | `server/orchestration/orchestrator.ts`, `execution/orchestration-loop.ts`, `execution/workflow-runner.ts`, `execution/phase-runner.ts` |
| Orchestration planning | `server/orchestration/planning/workflow-planner.ts`, `planning/phase-planner.ts` |
| Orchestration coordination | `server/orchestration/coordination/agent-coordinator.ts` |
| Orchestration events | `server/orchestration/events/event-publisher.ts` |
| Agents | `server/agents/planner/`, `server/agents/executor/`, `server/agents/verifier/`, `server/agents/supervisor/` |
| LLM | `server/shared/llm-client.ts` |
| Infrastructure events | `server/infrastructure/events/bus.ts`, `file-change-emitter.ts` |
| Infrastructure realtime | `server/infrastructure/realtime/sse-manager.ts`, `stream-topics.ts` |

### Frontend
| Area | Files |
|---|---|
| Chat UI | `client/src/components/chat/ChatMessages.tsx` |
| Event handling | `client/src/components/chat/agent-event-handler.ts`, `useAgentRunner.ts` |
| Action rendering | `client/src/components/chat/ActionGroup.tsx` |
| Cards | `FileOpenCard`, `FileWriteCard`, `TerminalCard`, `ScreenshotCard`, `DeployCard`, `GitCard`, `PlanningCard` |
| Realtime | `client/src/realtime/realtime-provider.tsx`, `useRunRecovery.ts`, `useRunReattach.ts` |

---

## 2. ARCHITECTURE MAP

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND                        │
│  RealtimeProvider (SSE /api/realtime, all topics)   │
│  useAgentRunner → agent-event-handler               │
│  ChatMessages (renders 8 message roles)             │
│  ActionGroup → ActionCardRegistry (all real)        │
└──────────────┬──────────────────────────────────────┘
               │  POST /api/run
               ▼
┌─────────────────────────────────────────────────────┐
│              server/chat/ (Entry Layer)             │
│  chat.routes.ts   run-start.router.ts               │
│  history.routes   attachment.routes                 │
│  checkpoint.routes                                  │
│  ChatOrchestrator.startRun()                        │
│    → ambiguity-detector (heuristic only)            │
│    → contextLoader + contextBuilder                 │
│    → memoryEngine.recall()                          │
│    → orchestrate() [ASYNC, fire-and-forget]         │
│    → returns ChatRun immediately                    │
└──────────────┬──────────────────────────────────────┘
               │ always
               ▼
┌─────────────────────────────────────────────────────┐
│          server/orchestration/ (Engine Layer)       │
│  orchestrator.ts → OrchestrationContext             │
│  orchestration-loop.ts → ExecutionPlanBuilder       │
│  workflow-planner.ts → WorkflowIntent classifier   │
│  phase-planner.ts → Planner→Executor→Verifier chain│
│  workflow-runner.ts → topological wave execution    │
│  phase-runner.ts → retry logic                      │
│  agent-coordinator.ts → planTaskToExecutionTask     │
└──────┬───────────┬──────────────┬───────────────────┘
       │           │              │
       ▼           ▼              ▼
  Planner      Executor       Verifier
  Agent        Agent          Agent
  (plan)       (execute)      (verify)
       │           │              │
       └───────────┴──────────────┘
                   │
                   ▼
        Supervisor Agent
        (multi-agent coordination,
         filesystem / terminal /
         browser routing)
```

---

## 3. EXECUTION FLOW MAP

```
User sends message ("build me a CRM")
    │
    ▼
POST /api/run  (run-start.router.ts)
    │
    ▼
chatOrchestrator.startRun()
    │
    ├─ persist user message (messageBuilder.buildUser)
    ├─ build LLM context (contextLoader + contextBuilder)
    ├─ enrich from memory (memoryEngine.recall)
    ├─ check ambiguity (ambiguity-detector → maybeAskClarification)
    │
    ├─ return ChatRun to client immediately ◄──────── client sees run ID
    │
    └─ orchestrate() [async, no await]
          │
          ▼
       orchestrator.ts
          │
          ▼
       orchestration-loop.ts
          │
          ▼
       workflow-planner.ts  ← classifies intent (build_feature / fix_bug /
          │                    refactor / generate_ui / add_api /
          │                    verify_runtime / general)
          ▼
       phase-planner.ts  ← builds phase chain for intent
          │                 build_feature → [Planner, Executor, Verifier*]
          │                 fix_bug       → [Planner, Executor, Verifier]
          │                 verify_runtime → [Verifier, Supervisor]
          │                 (*optional = true for some intents)
          ▼
       workflow-runner.ts  ← executes phases in topological waves
          │                  injects Planner output → Executor input
          │                  injects Executor output → Verifier input
          ▼
       phase-runner.ts  ← per-phase retry + lifecycle
          │
          ▼
       agent-coordinator.ts
          │
          ├─ planTaskToExecutionTask (normalisation)
          ├─ invokeAgent(agentType) → routes to:
          │     planner → runPlannerCycle()
          │     executor → runExecutorAgent()
          │     verifier → runVerification()
          │     supervisor → supervisor-agent
          │
          └─ synthetic fallback plan if planner fails/skipped
                (allows agent to respond even without formal plan)
          │
          ▼
       chatOrchestrator.completeRun()
          │
          ├─ LLM summary streamed via streamManager
          └─ run closed, final message persisted
```

---

## 4. EVENT FLOW MAP

```
Agent Activity
    │
    ▼
server/orchestration/events/event-publisher.ts
    │  emits → bus.emit('agent.event', payload)
    │  emits → bus.emit('run.lifecycle', payload)
    │  emits → bus.emit('checkpoint', payload)
    │
    ▼
server/infrastructure/events/bus.ts  (TypedEventBus / Node EventEmitter)
    │  synchronous delivery, no retry, no persistence
    │
    ▼
server/infrastructure/realtime/sse-manager.ts
    │  maps bus events → SSE topics (TOPIC.AGENT, TOPIC.LIFECYCLE, etc.)
    │  filters by projectId + runId
    │  sends as named SSE events: "event: agent\ndata: {...}\n\n"
    │
    ▼
GET /api/realtime  (single unified SSE connection)
    │
    ▼
client/src/realtime/realtime-provider.tsx
    │  EventSource → addEventListener(topic, handler)
    │  exponential backoff reconnect (1s → 30s cap)
    │  tracks lastEventId, appends ?lastEventId=... on reconnect
    │
    ▼
useAgentRunner.ts + agent-event-handler.ts
    │  dispatches events to message state
    │  deduplicates handlers via Set
    │  accumulates inflight tool updates before flushing
    │
    ▼
ChatMessages.tsx  (renders final UI)
```

### Chat-Specific Stream (token streaming)
```
chatOrchestrator → streamManager.open(runId)
                 → streamManager.append(runId, token)
                 → eventPublisher.emit(agent.token)
                 → bus → sse-manager → client
                 → streamManager.close(runId)
```

---

## 5. AGENT ROUTING MAP

```
agent-coordinator.ts  invokeAgent(agentType)
    │
    ├── agentType = 'planner'    → runPlannerCycle()
    │       planning-loop.ts
    │       goal analysis → task-planner → dependency resolution
    │       → phase planning → ExecutionPlan {tasks: PlanTask[]}
    │
    ├── agentType = 'executor'   → runExecutorAgent()
    │       execution-loop.ts
    │       iterates ExecutionTask[] → coordinateTask()
    │           → terminal tools
    │           → filesystem tools
    │           → coding tools
    │           → verify tools
    │           → browser tools
    │
    ├── agentType = 'verifier'   → runVerification()
    │       verification-loop.ts
    │       phases: typecheck → build → runtime
    │       real checks: run_build, run_typecheck, run_tests,
    │                    check_server_health
    │       consecutiveFailures guard (limit: 4)
    │
    ├── agentType = 'supervisor' → supervisor-agent
    │       supervision-routing.ts
    │       routes sub-tasks to: planner / executor / verifier /
    │                            browser / filesystem / terminal
    │
    └── SYNTHETIC FALLBACK (if planner fails or skipped)
            agent-coordinator provides minimal plan
            allows conversational goal to still get a response
```

---

## 6. INTENT ROUTING AUDIT

### Critical Finding: **No Conversation vs. Build Decision Gate**

```
CURRENT FLOW:
    User message → POST /api/run → orchestrate() → workflow-planner (intent classification)
                                                  → ALWAYS Planner→Executor→Verifier

REPLIT-STYLE EXPECTED:
    User message → Intent Router → "chat"?  → Chat Agent (LLM reply only)
                                 → "build"? → Planner → Executor → Verifier
```

### Intent Classification (workflow-planner.ts) — keyword-based only
| Keyword(s) in goal | WorkflowIntent | Phases |
|---|---|---|
| build, create, implement | `build_feature` | Planner → Executor → Verifier* |
| fix, bug, error | `fix_bug` | Planner → Executor → Verifier |
| refactor, clean, move | `refactor` | Planner → Executor → Verifier* |
| component, ui, page | `generate_ui` | Planner → Executor → Verifier* |
| api, endpoint, route | `add_api` | Planner → Executor → Verifier* |
| test, verify, check | `verify_runtime` | Verifier → Supervisor |
| (none match) | `general` | Planner → Executor → Verifier* |

*optional = true (workflow can succeed without verification passing)

### Ambiguity Detection (ambiguity-detector.ts)
- Detects vague terms ("make it better", "fix it", "optimize") via regex
- Non-blocking: orchestration starts anyway, agent waits for clarification
- **Not** an intent router — it only flags vague requests, does not route to a chat-only path

### What's MISSING
- No `intent === "chat"` branch
- No conversational response path that bypasses the Planner
- "Hello" or "how are you" would still trigger `workflow-planner` → `general` → full P→E→V chain
- The synthetic fallback in `agent-coordinator` provides a partial safety net (if planner produces nothing, a thin response can still emerge), but this is not a designed chat mode

---

## 7. FRONTEND AUDIT

### Message Roles Rendered (ChatMessages.tsx)
| Role | Renderer | Status |
|---|---|---|
| `user` | Chat bubble (right) | ✅ Real |
| `agent` | AgentMarkdown bubble (left) | ✅ Real |
| `plan` | PlanningCard (timeline + progress) | ✅ Real |
| `tool_group` | ActionGroup → card registry | ✅ Real |
| `checkpoint` | CheckpointCard | ✅ Real |
| `diff` | FileDiffCard | ✅ Real |
| `question` | QuestionCard (interactive) | ✅ Real |
| `completion` | CompletionCard (run summary) | ✅ Real |

**Missing role:** No `assistant` role (Replit uses `assistant`; this system uses `agent`)

### SSE Events Handled vs Ignored (agent-event-handler.ts / useAgentRunner.ts)

#### Handled ✅
| Event | Action |
|---|---|
| `agent.stream.start` | Opens streaming state |
| `agent.token` | Appends token to live bubble |
| `agent.stream.end` | Closes streaming state |
| `agent.thinking` | Shows thinking bubble |
| `agent.retry` | Shows retry indicator |
| `agent.replanning` | Shows replanning state |
| `plan.created` | Creates plan message |
| `plan.step.update` | Updates plan progress |
| `plan.progress` | Updates plan progress bar |
| `agent.tool_call` | Creates tool_group message |
| `tool.completed` | Updates tool card result |
| `tool.error` | Shows error in tool card |
| `shell.output` | Feeds TerminalCard |
| `phase.started` | Updates phase status |
| `phase.completed` | Marks phase done |
| `phase.failed` | Marks phase failed |
| `file.written` | Creates FileWriteCard |
| `diff.queued` / `file.diff` | Creates diff card (patch.queue) |
| `agent.question` | Creates QuestionCard |
| `agent.question.answered` | Resolves QuestionCard |
| `recovery.started/completed/failed` | Shows recovery state |
| `agent.message` | Creates final agent message |
| `agent.continuation` | Handles multi-turn context |
| `agent.context_compressed` | Context compression notice |

#### NOT Handled / Missing ✅→❌
| Expected Event | Status |
|---|---|
| `run.started` | ❌ Not mapped in event handler |
| `run.completed` | ❌ Not mapped in event handler |
| `run.failed` | ❌ Not mapped in event handler |
| `checkpoint.created` | ❌ Not mapped (CheckpointCard only shown if role=checkpoint in history) |
| `chat.response` | ❌ Does not exist — system uses `agent.token` instead |
| `assistant.reply` | ❌ Does not exist |

### Action Cards Audit
| Card | Data Source | Real/Mock |
|---|---|---|
| `FileOpenCard` | File path/meta from event | ✅ Real |
| `FileWriteCard` | Diff from event; Accept/Reject → `/api/agent/diff-queue/apply` | ✅ Real |
| `TerminalCard` | stdout from `shell.output` events; Replay + Copy | ✅ Real |
| `ScreenshotCard` | base64 `imageData` or `imageUrl` from browser agent | ✅ Real |
| `DeployCard` | Deployment URL + environment from event | ✅ Real |
| `GitCard` | Branch, hash, commit message from event | ✅ Real |
| `PlanningCard` | Live step progress from `plan.*` events | ✅ Real |

**All cards are real — 0% mock/placeholder UI**

---

## 8. REALTIME AUDIT

### Client (client/src/realtime/)
| Feature | Status | Detail |
|---|---|---|
| Reconnect | ✅ Implemented | Exponential backoff: 1s → doubles → 30s cap |
| Event replay | ✅ Partial | Tracks `lastEventId`, sends on reconnect; depends on server support |
| Deduplication | ✅ Implemented | Handler dedup via Set; message dedup in useAgentRunner |
| Stale recovery | ✅ Implemented | `useRunRecovery` queries `/api/run/active` on mount; `useRunReattach` rehydrates |
| In-flight accumulation | ✅ Implemented | Tool updates batched before flushing to prevent UI thrashing |

### Server Event Bus (server/infrastructure/events/bus.ts)
| Feature | Status | Detail |
|---|---|---|
| Ordering guarantee | ⚠️ Partial | Synchronous delivery in listener registration order within a process |
| Retry mechanism | ❌ None | No retry on listener failure; error propagates or is swallowed |
| Persistence | ❌ None | Purely in-memory; restart loses all in-flight events |
| Event replay | ❌ None | Once emitted with no listener, event is gone |
| Drop protection | ❌ None | If socket closed, event is dropped (caught by try/catch in sse-manager) |

### Server SSE (server/infrastructure/realtime/sse-manager.ts)
| Feature | Status | Detail |
|---|---|---|
| Topic routing | ✅ Implemented | Named SSE events per TOPIC constant |
| projectId scoping | ✅ Implemented | Prevents cross-project leakage |
| runId scoping | ✅ Implemented | Client can filter to specific run |
| Last-Event-ID server support | ❌ Missing | Client sends `?lastEventId=` but server does not replay missed events |
| Backpressure | ⚠️ Partial | `sse-utils.ts` handles backpressure; individual socket closes handled |

### Topics Defined (stream-topics.ts)
| Topic Constant | Purpose |
|---|---|
| `TOPIC.AGENT` | Agent lifecycle and action events |
| `TOPIC.LIFECYCLE` | Run started/completed/failed |
| `TOPIC.CHECKPOINT` | Checkpoint creation events |
| `TOPIC.CONSOLE` | Runtime console log capture |
| `TOPIC.FILE` | Workspace file system changes |
| `TOPIC.RUNTIME_VERIFIED` | Verifier loop signals |
| `TOPIC.RUNTIME_OBSERVATION` | Verifier observations |
| `TOPIC.DIFF` | Patch/diff application events |
| `TOPIC.PREVIEW_LIFECYCLE` | Web preview state machine |
| `TOPIC.BROWSER_SESSION` | Browser automation session events |
| `TOPIC.TOOL_EXECUTION` | Individual tool start/success/error |

---

## 9. REPLIT PARITY SCORE

| Capability | Replit Agent | This System | Score |
|---|---|---|---|
| Chat naturally like a chatbot | ✅ Dedicated chat path | ❌ Full P→E→V triggered for all messages | 2/10 |
| Build apps from ideas | ✅ Yes | ✅ Yes (P→E→V chain works) | 8/10 |
| Route messages: chat vs build | ✅ Intent router decides | ❌ No routing — all go to orchestration | 1/10 |
| Stream progress and actions | ✅ Yes | ✅ Yes (SSE + token streaming) | 8/10 |
| Decide chat vs execute | ✅ Supervisor decides | ❌ No decision — always executes | 1/10 |
| Explain code | ✅ Chat agent handles | ❌ Would trigger orchestration | 2/10 |
| Modify project | ✅ Yes | ✅ Yes | 8/10 |
| Agent routing (multi-agent) | ✅ Yes | ✅ Yes (coordinator + supervisor) | 7/10 |
| Clarification questions | ✅ Yes | ✅ Yes (QuestionCard + ambiguity detector) | 7/10 |
| Run recovery on refresh | ✅ Yes | ✅ Yes (useRunRecovery) | 8/10 |
| SSE stability | ✅ Yes | ✅ Yes (reconnect + backoff) | 7/10 |
| Real action cards | ✅ Yes | ✅ Yes (all 7 cards real) | 9/10 |
| Checkpoint/rollback | ✅ Yes | ✅ Yes | 8/10 |

**Overall Parity Score: 5.8/10**

The infrastructure, execution, and rendering layers score very high. The dominant gap is the missing **intent routing layer** — the single architectural decision that separates Replit-style behavior from the current system.

---

## 10. CRITICAL BLOCKERS

### BLOCKER 1 — No Chat vs. Build Decision Gate (SEVERITY: CRITICAL)
**The primary architecture bug.**

Every user message, regardless of content, is routed to `orchestrate()` which invokes the full Planner → Executor → Verifier chain. There is no path for a message like "hello", "what is React?", or "explain this code" to receive a simple LLM reply without triggering the full agent stack.

- "Hello" → `general` intent → Planner → Executor → Verifier (slow, expensive, wrong)
- "What does this file do?" → `general` intent → full orchestration (wrong)
- "Build me a login page" → `build_feature` → P→E→V ✅ (correct)

### BLOCKER 2 — No Chat Agent (SEVERITY: CRITICAL)
There is no `ChatAgent` or `ConversationAgent`. The supervisor routes to `planner`, `executor`, `verifier`, `browser`, `filesystem`, and `terminal` — but never to a "just reply" agent. The synthetic fallback in `agent-coordinator` is a partial workaround, not a designed solution.

### BLOCKER 3 — Server-Side Last-Event-ID Replay Missing (SEVERITY: MEDIUM)
The client correctly sends `?lastEventId=...` on reconnect. The server ignores it. Missed events during a disconnect are permanently lost. A page refresh during an active run causes partial event loss (mitigated but not eliminated by `useRunReattach`).

### BLOCKER 4 — `run.started` / `run.completed` / `run.failed` Not Mapped on Frontend (SEVERITY: LOW-MEDIUM)
The server emits these on `TOPIC.LIFECYCLE` but `agent-event-handler.ts` does not handle them. Run state changes are not surfaced in the UI beyond what the streaming tokens imply.

### BLOCKER 5 — Event Bus Has No Retry or Persistence (SEVERITY: LOW)
If the server crashes mid-run, all in-flight events are lost. The system has no queue (BullMQ is referenced in package.json but not wired into the event path). For long-running agent builds, this creates reliability risk.

---

## 11. RECOMMENDED FIXES

### Fix 1 — Add Intent Router (addresses Blockers 1 & 2)
Create `server/chat/intent/intent-router.ts` that classifies user messages **before** calling `orchestrate()`:

```
"hello" / "explain X" / "what is Y"
    → intent = "conversation"
    → ChatAgent (single LLM call, stream reply, no planner)

"build X" / "fix Y" / "create Z"
    → intent = "build" | "fix" | etc.
    → orchestrate() as today
```

This is the **single highest-impact change** in the entire codebase. It transforms the system from "always builds" to "Replit-style agent".

Implementation scope:
- New file: `server/chat/intent/intent-router.ts`
- New file: `server/agents/chat/chat-agent.ts` (simple LLM streaming agent)
- Modify: `server/chat/orchestration/chat-orchestrator.ts` → branch on intent before calling `orchestrate()`
- No changes to orchestration engine, agents, or frontend required

### Fix 2 — Wire `run.started` / `run.completed` / `run.failed` to Frontend (addresses Blocker 4)
- Modify: `client/src/components/chat/agent-event-handler.ts`
- Add handlers for lifecycle events from `TOPIC.LIFECYCLE`
- Show run status in UI (started spinner, completed tick, failed badge)

### Fix 3 — Implement Server-Side Last-Event-ID Replay (addresses Blocker 3)
- Modify: `server/infrastructure/realtime/sse-manager.ts`
- Add a ring buffer (last N events per topic per projectId)
- On new SSE registration with `lastEventId`, replay buffered events newer than that ID

### Fix 4 — Add BullMQ Queue for Durable Event Delivery (addresses Blocker 5)
- Wire the existing BullMQ dependency into the orchestration event path
- Jobs survive server restarts; consumers replay on reconnect
- Scope: medium — only needed for production reliability

---

## 12. EXACT FILES TO MODIFY

| File | Change | Priority |
|---|---|---|
| `server/chat/orchestration/chat-orchestrator.ts` | Add intent branch before `orchestrate()` call | 🔴 Critical |
| `server/chat/intent/intent-router.ts` | **CREATE NEW** — intent classification logic | 🔴 Critical |
| `server/agents/chat/chat-agent.ts` | **CREATE NEW** — conversational LLM agent | 🔴 Critical |
| `client/src/components/chat/agent-event-handler.ts` | Add `run.started/completed/failed` handlers | 🟡 Medium |
| `server/infrastructure/realtime/sse-manager.ts` | Add Last-Event-ID ring buffer replay | 🟡 Medium |

---

## 13. EXACT FILES NOT TO MODIFY

| File | Reason |
|---|---|
| `server/orchestration/orchestrator.ts` | Core engine is correct — intent router sits above it |
| `server/orchestration/execution/orchestration-loop.ts` | Correct — no change needed |
| `server/orchestration/execution/workflow-runner.ts` | Correct — phase/wave execution works |
| `server/orchestration/coordination/agent-coordinator.ts` | Correct — task routing works |
| `server/orchestration/planning/workflow-planner.ts` | Correct — intent types can be reused |
| `server/orchestration/planning/phase-planner.ts` | Correct — P→E→V chain is right for build tasks |
| `server/agents/planner/` | Correct — no changes needed |
| `server/agents/executor/` | Correct — no changes needed |
| `server/agents/verifier/` | Correct — real verification, no changes needed |
| `server/agents/supervisor/` | Correct — routing logic works |
| `server/shared/llm-client.ts` | Correct — OpenRouter integration complete |
| `server/infrastructure/events/bus.ts` | Leave unless adding BullMQ |
| `client/src/realtime/realtime-provider.tsx` | Correct — SSE architecture is solid |
| `client/src/components/chat/ChatMessages.tsx` | Correct — all 8 roles rendered |
| All card components | Correct — all real data, no mocks |
| `vite.config.ts` | Do not touch |
| `main.ts` | Do not touch |
| `shared/schema.ts` | Do not touch |

---

## 14. FINAL CONCLUSION

### The Single Most Important Question

> **When a user sends a message, does the system FIRST decide: Conversation OR Build Request?**

### Answer: **NO**

Every message goes directly into the orchestration engine. The `workflow-planner.ts` does classify the *type* of build task (feature/bug/refactor/etc.), but there is no upstream gate that asks "should this be a conversation or an orchestration?"

"Hello" triggers a full Planner → Executor → Verifier cycle. This is the **primary architecture bug**.

### What Works Extremely Well
- The Planner → Executor → Verifier chain is **correctly implemented** and production-ready
- The Supervisor agent **exists** and routes sub-tasks correctly
- **All frontend cards are real** — zero mock UI
- **SSE infrastructure is solid** — reconnect, backoff, dedup, run recovery all implemented
- **Memory platform is integrated** — agents recall past context
- **LLM client is correct** — OpenRouter with Replit integration fallback
- **Checkpointing exists** — rollback capability is real

### What's Missing
1. An **intent router** that gates conversation vs. build (one new file + one new agent + one branch)
2. A **chat agent** for conversational replies (simple LLM streaming, no planner)
3. **Frontend lifecycle event handlers** for `run.started/completed/failed`
4. **Server-side SSE replay** for Last-Event-ID

### Path to Full Replit Parity

The gap is **narrower than it appears**. The system has a complete, correctly-wired execution engine. The missing piece is a **routing layer above the engine** — approximately 3 new files and 1 branch in `chat-orchestrator.ts`. Once the intent router exists:

```
"Hello"           → Chat Agent   → streamed reply in ~1 second
"Explain X"       → Chat Agent   → streamed reply in ~1 second  
"Build me a CRM"  → Orchestrate  → P→E→V → real app built
"Fix the login"   → Orchestrate  → fix_bug plan → real fix
```

That is Replit-style behavior. The infrastructure to deliver it already exists.

**Estimated implementation scope:** 3 new files (~300 LOC total) + 1 modified file (~20 LOC change)
