# CENTRAL ORCHESTRATOR ARCHITECTURE AUDIT

**Scope:** `server/chat/` · `server/file-explorer/` · `server/orchestration/`  
**Method:** Static import tracing · call-graph tracing · cross-service dependency mapping  
**Policy:** Audit only — zero code changes

---

## 1. FILES SCANNED

### server/chat/
| File | Role |
|---|---|
| `index.ts` | Module mount — exports `chatRouter`, `chatOrchestrator` |
| `api/run-start.router.ts` | Route: `POST /api/run` |
| `api/chat.routes.ts` | Route: `POST /api/chat/message`, `GET /api/chat/stream` |
| `controllers/run-controller.ts` | Delegates run lifecycle to `chatOrchestrator` |
| `controllers/chat-controller.ts` | Delegates chat messages to `chatOrchestrator` |
| `orchestration/chat-orchestrator.ts` | **Bridge** — calls `orchestrate()` or `runChatAgent()` |
| `intent/intent-router.ts` | Deterministic keyword intent classifier |
| `realtime/event-publisher.ts` | Wraps `bus.emit('agent.event', ...)` |
| `realtime/sse-manager.ts` | SSE push facade over infra SSE manager |
| `realtime/connection-registry.ts` | Tracks open SSE connections by `runId` |
| `persistence/message-store.ts` | Drizzle writes to `chat_messages` |
| `persistence/run-store.ts` | Drizzle writes to `agent_runs` |
| `run/registry.ts` | In-memory active run registry |
| `messages/message-builder.ts` | Composes and persists messages |
| `llm/chat-responder.ts` | Streams LLM tokens for chat-mode responses |
| `timeline/run-timeline.ts` | Event timeline per run |

### server/file-explorer/
| File | Role |
|---|---|
| `orchestrator/explorer.orchestrator.ts` | **Coordinator** — sequences FS operations |
| `orchestrator/index.ts` | Barrel export of `explorerOrchestrator` |
| `controllers/file-explorer.controller.ts` | HTTP handlers, delegates to `explorerOrchestrator` |
| `services/tree/tree.service.ts` | Directory tree construction |
| `services/read/read.service.ts` | File read operations |
| `services/write/write.service.ts` | File write + snapshot-before-write |
| `services/history/history.service.ts` | File change history |
| `repositories/filesystem.repository.ts` | Raw `fs`/`path` access |
| `realtime/file-events.service.ts` | Emits `file.modified`, `file.created`, `file.deleted` onto infra bus |
| `guards/path.guard.ts` | `resolveSafe()` + `isExcluded()` — sandboxing |
| `mappers/tree.mapper.ts` | FS entries → typed tree nodes |

### server/orchestration/
| File | Role |
|---|---|
| `index.ts` | True entrypoint — exports `orchestrate()`, `createOrchestrationRouter()`, `initOrchestration()` |
| `orchestrator.ts` | Root orchestrator — drives `orchestration-loop.ts`, loads memory |
| `core/run-manager.ts` | Singleton active-run registry |
| `core/orchestration-context.ts` | `buildOrchestrationContext()` — assembles run state |
| `core/orchestration-session.ts` | Per-run session object |
| `core/orchestration-state.ts` | State machine transitions |
| `core/orchestration-replay.ts` | Replay failed orchestrations from checkpoint |
| `planning/workflow-planner.ts` | Maps intent → workflow type + phases |
| `planning/phase-planner.ts` | Maps workflow phase → agent assignment |
| `planning/execution-plan-builder.ts` | Assembles ordered `ExecutionPlan` |
| `execution/orchestration-loop.ts` | Main run loop — drives `workflow-runner.ts` |
| `execution/workflow-runner.ts` | Iterates over phases |
| `execution/phase-runner.ts` | Runs a single phase via `dispatcher-client.ts` |
| `execution/retry-manager.ts` | Per-phase retry + backoff |
| `execution/execution-result-registry.ts` | Stores phase results |
| `routing/agent-routing.ts` | `resolveAgentForPhase()` — runtime agent selection + fallback |
| `routing/workflow-routing.ts` | `buildWorkflowExecutionPlan()` — full plan routing |
| `routing/task-routing.ts` | Low-level task dispatch decisions |
| `coordination/agent-coordinator.ts` | Calls `runPlannerCycle`, `runExecutorAgent`, `runVerification` |
| `coordination/dispatcher-client.ts` | Sends task to correct agent subprocess |
| `coordination/orchestration-routing.ts` | Cross-run coordination |
| `distributed/run-scoped-orchestrator.ts` | Isolated per-run orchestration wrapper |
| `distributed/parallel-orchestration-fabric.ts` | Multi-run concurrent execution |
| `distributed/multi-run-recovery.ts` | Recovery for distributed run failures |
| `lifecycle/lifecycle-manager.ts` | Run lifecycle hooks |
| `lifecycle/recovery-coordinator.ts` | Reconnect stalled runs |
| `lifecycle/escalation-manager.ts` | Escalate to Supervisor on repeated failure |
| `agents/verification-bridge.ts` | Adapter between orchestrator and Verifier agent |
| `events/orchestration-events.ts` | Event type definitions |
| `events/event-publisher.ts` | Publishes orchestration-scoped events onto infra bus |
| `monitoring/orchestration-monitor.ts` | Health + telemetry aggregation |
| `monitoring/failure-monitor.ts` | Tracks failure patterns |
| `validation/workflow-validator.ts` | Pre-flight validation of workflow plans |
| `validation/orchestration-validator.ts` | Runtime integrity checks |
| `validation/integrity-validator.ts` | Post-run result validation |
| `telemetry/orchestration-metrics.ts` | Metrics emission |
| `telemetry/orchestration-logger.ts` | Structured logging |
| `swarm/intent-graph/intent-graph-types.ts` | Types for future intent-graph swarm layer |
| `types/orchestration.types.ts` | Shared TypeScript interfaces (leaf — no imports) |
| `utils/orchestration-utils.ts` | `newOrchestrationId()`, `toErrorMessage()` |

---

## 2. IMPORT GRAPH

```
server/chat/orchestration/chat-orchestrator.ts
  └── imports orchestrate()          ← server/orchestration/index.ts  ✅ CONNECTED
  └── imports routeIntent()          ← server/chat/intent/intent-router.ts
  └── imports runChatAgent()         ← server/agents/chat/chat-agent.ts

server/orchestration/distributed/run-scoped-orchestrator.ts
  └── imports orchestrate()          ← server/orchestration/index.ts  (internal)

server/orchestration/distributed/parallel-orchestration-fabric.ts
  └── imports orchestrate()          ← server/orchestration/index.ts  (internal)

server/agents/supervisor/supervisor-agent.ts
  └── references orchestration types ← server/orchestration/types/orchestration.types.ts

server/file-explorer/orchestrator/explorer.orchestrator.ts
  └── NO import from server/orchestration  ✗ NOT CONNECTED (by design)

server/preview/preview.orchestrator.ts
  └── NO import from server/orchestration  ✗ NOT CONNECTED (health facade only)

server/console/console.orchestrator.ts
  └── NO import from server/orchestration  ✗ NOT CONNECTED (health facade only)

server/publishing/index.ts
  └── NO import from server/orchestration  ✗ NOT CONNECTED
```

**Single external consumer of `orchestrate()`:**  
→ `server/chat/orchestration/chat-orchestrator.ts`

---

## 3. CALL GRAPH

### Chat Path — Actionable Intent
```
POST /api/run
  └── run-start.router.ts
        └── runController.startRun()
              └── chatOrchestrator.startRun(payload)
                    ├── runManager.register(runId)
                    ├── messageBuilder.persist(user, content)
                    ├── routeIntent(goal)  → intent: build | fix | modify | debug
                    └── orchestrate(context)            ← server/orchestration/index.ts
                          └── orchestrator.ts
                                └── orchestration-loop.ts
                                      └── workflow-runner.ts
                                            └── phase-runner.ts (per phase)
                                                  └── dispatcher-client.ts
                                                        └── agent-coordinator.ts
                                                              ├── runPlannerCycle()   → PlannerAgent
                                                              ├── runExecutorAgent()  → ExecutorAgent / CoderXAgent / BrowserAgent
                                                              └── runVerification()   → VerifierAgent
```

### Chat Path — Conversational Intent
```
POST /api/run  (or POST /api/chat/message)
  └── chatOrchestrator
        ├── routeIntent(goal)  → intent: conversation | explain
        └── runChatAgent(context)      ← server/agents/chat/chat-agent.ts
              └── chat-responder.ts   → LLM stream → SSE tokens
```

### File Explorer Path
```
HTTP (GET/POST/PUT/DELETE) /api/files/*
  └── FileExplorerController
        └── explorerOrchestrator.[readFile | saveFile | getTree | ...]()
              ├── snapshotBeforeWrite()    ← writeService
              ├── treeService.build()      ← filesystem.repository.ts (fs/path)
              └── fileEventsService.onModified()  → bus.emit('file.modified')
```
**No agent calls. No orchestration imports. Pure CRUD + event emission.**

### SSE Event Flow
```
Agent / Orchestrator
  └── eventPublisher.publish(event)
        └── bus.emit('agent.event', payload)        ← infra event bus
              └── sse-manager.ts (infra)
                    └── filters by projectId / runId
                          └── res.write(`data: ${JSON.stringify(event)}\n\n`)
                                └── Frontend EventSource consumer
```

**Canonical Events:**
| Event | Emitter | Description |
|---|---|---|
| `run.started` | `chatOrchestrator.startRun` | Run registered and begun |
| `agent.token` | `streamManager` (chat-responder) | LLM streaming token |
| `agent.message` | `messageBuilder` | Complete message persisted |
| `run.completed` | `chatOrchestrator.completeRun` | All phases finished successfully |
| `run.failed` | `chatOrchestrator` | Run terminated with error |
| `checkpoint.created` | `chatOrchestrator.completeRun` | Filesystem snapshot saved |

---

## 4. DEPENDENCY GRAPH

```
server/chat/
  ├── DEPENDS ON → server/orchestration/index.ts        (actionable intents)
  ├── DEPENDS ON → server/agents/chat/chat-agent.ts     (conversational intents)
  ├── DEPENDS ON → server/infrastructure/events/bus     (SSE)
  └── DEPENDS ON → server/infrastructure/db             (persistence)

server/orchestration/
  ├── DEPENDS ON → server/agents/planner/               (plan phase)
  ├── DEPENDS ON → server/agents/executor/              (execute phase)
  ├── DEPENDS ON → server/agents/coderx/               (code phase)
  ├── DEPENDS ON → server/agents/browser/              (browser phase)
  ├── DEPENDS ON → server/agents/verifier/             (verify phase)
  ├── DEPENDS ON → server/agents/supervisor/           (escalation/report phase)
  ├── DEPENDS ON → server/memory/                      (context hydration)
  └── DEPENDS ON → server/infrastructure/events/bus    (event publishing)

server/file-explorer/
  ├── DEPENDS ON → server/infrastructure/events/bus    (file events only)
  └── DEPENDS ON → server/infrastructure/db            (history persistence)
  └── NO DEPENDENCY on server/orchestration/

server/preview/
  └── DEPENDS ON → server/infrastructure/              (health/status facade only)
  └── NO DEPENDENCY on server/orchestration/

server/publishing/
  └── NO DEPENDENCY on server/orchestration/

server/console/
  └── DEPENDS ON → server/infrastructure/              (health/status facade only)
  └── NO DEPENDENCY on server/orchestration/
```

---

## 5. SERVICE OWNERSHIP MAP

| Service | Owns Planning | Owns Execution | Owns Verification | Owns Routing | Uses Central Orchestrator |
|---|---|---|---|---|---|
| `server/chat` | ✗ (delegates) | ✗ (delegates) | ✗ (delegates) | ✅ intent-router | ✅ for actionable intents |
| `server/orchestration` | ✅ workflow-planner | ✅ phase-runner | ✅ verification-bridge | ✅ agent-routing | IS the orchestrator |
| `server/file-explorer` | ✗ | ✅ (FS only) | ✗ | ✗ | ✗ |
| `server/preview` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `server/publishing` | ✗ | ✗ | ✗ | ✗ | ✗ |
| `server/console` | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 6. AGENT OWNERSHIP MAP

| Agent | Owner | Called By | Capabilities |
|---|---|---|---|
| `PlannerAgent` | `server/agents/planner/` | `agent-coordinator.runPlannerCycle()` | `canPlan` |
| `ExecutorAgent` | `server/agents/executor/` | `agent-coordinator.runExecutorAgent()` | `canExecute` |
| `CoderXAgent` | `server/agents/coderx/` | `agent-coordinator.runExecutorAgent()` (routing) | `canExecute`, `canCode` |
| `BrowserAgent` | `server/agents/browser/` | `dispatcher-client.ts` (routing) | `canExecute`, `canBrowse` |
| `TerminalAgent` | `server/agents/terminal/` | `dispatcher-client.ts` (routing) | `canExecute` |
| `VerifierAgent` | `server/agents/verifier/` | `agent-coordinator.runVerification()` | `canVerify` |
| `SupervisorAgent` | `server/agents/supervisor/` | `escalation-manager.ts` | `canPlan`, `canVerify`, `canSupervise` — NO `canExecute` |
| `ChatAgent` | `server/agents/chat/` | `chatOrchestrator.runChatAgent()` | `canStream` (LLM direct) |
| `FilesystemAgent` | `server/agents/filesystem/` | `dispatcher-client.ts` | `canRead`, `canWrite`, `canSearch` |

**Supervisor role:** Decision-maker and escalation handler — NOT a task worker. It is the last-resort authority when repeated agent failures occur, handling the `report` phase and overriding routing decisions.

---

## 7. DUPLICATE ORCHESTRATION MAP

| Logic Type | server/chat | server/file-explorer | server/orchestration | Verdict |
|---|---|---|---|---|
| Workflow planning | ✗ | ✗ | ✅ `workflow-planner.ts` | **No duplication** |
| Phase planning | ✗ | ✗ | ✅ `phase-planner.ts` | **No duplication** |
| Agent routing | intent-router (intent-level only) | ✗ | ✅ `agent-routing.ts` | **No duplication** — intent router is pre-orchestration gate |
| Execution loop | ✗ | ✗ | ✅ `orchestration-loop.ts` | **No duplication** |
| Verification | ✗ | ✗ | ✅ `verification-bridge.ts` | **No duplication** |
| Retry management | ✗ | ✗ | ✅ `retry-manager.ts` | **No duplication** |
| SSE publishing | `event-publisher.ts` (chat-scoped) | `file-events.service.ts` (file-scoped) | `event-publisher.ts` (orch-scoped) | **Scoped by domain — not duplication** |
| "Orchestrator" class name | `ChatOrchestrator` (bridge) | `ExplorerOrchestrator` (CRUD coordinator) | `Orchestrator` (true engine) | **Name collision — conceptually distinct roles** |

**Finding:** There is zero duplicated planning, execution, or verification logic across these three modules. The `ExplorerOrchestrator` name is misleading — it is a CRUD service coordinator, not an orchestration engine. The `ChatOrchestrator` is a thin gateway/bridge, not an engine.

---

## 8. SERVICE → ORCHESTRATOR RELATIONSHIPS

```
server/chat
  ├── POST /api/run  ──[actionable intent]──►  server/orchestration/index.ts  ✅
  └── POST /api/run  ──[conversation intent]──► server/agents/chat/chat-agent  (bypasses engine)

server/file-explorer
  └── All routes ──────────────────────────►  explorerOrchestrator (CRUD only, not engine)
                                               NO path to server/orchestration

server/preview
  └── All routes ──────────────────────────►  previewOrchestrator (health facade)
                                               NO path to server/orchestration

server/publishing
  └── All routes ──────────────────────────►  Direct services
                                               NO path to server/orchestration

server/console
  └── All routes ──────────────────────────►  consoleOrchestrator (health facade)
                                               NO path to server/orchestration
```

---

## 9. CURRENT ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React/Vite)                          │
│              EventSource  ·  fetch  ·  WebSocket                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼──────────┐      ┌──────────▼──────────┐
    │   POST /api/run    │      │  GET /api/files/*   │
    │ POST /api/chat/msg │      │  PUT /api/files/*   │
    └─────────┬──────────┘      └──────────┬──────────┘
              │                             │
    ┌─────────▼──────────┐      ┌──────────▼──────────┐
    │  ChatOrchestrator  │      │ ExplorerOrchestrator │
    │ (bridge/gateway)   │      │ (CRUD coordinator)   │
    └──────┬─────────────┘      └──────────┬──────────┘
           │                               │
    ┌──────▼─────────┐            ┌────────▼────────┐
    │  intent-router │            │ filesystem repo  │
    └──────┬─────────┘            │  (fs / path)     │
           │                      └─────────────────┘
    conversation/explain?
    ┌──────┴────────────────────┐
    │                           │
┌───▼──────────┐     ┌─────────▼────────────────────────────────────┐
│  ChatAgent   │     │         server/orchestration/index.ts        │
│ (LLM stream) │     │              orchestrate()                   │
└──────────────┘     └──────────────────────┬─────────────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │     workflow-planner     │
                               │  intent → workflow type  │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │      phase-planner       │
                               │  workflow → [phases]     │
                               └────────────┬────────────┘
                                            │ (per phase)
                               ┌────────────▼────────────┐
                               │      phase-runner        │
                               └────────────┬────────────┘
                                            │
                               ┌────────────▼────────────┐
                               │    dispatcher-client     │
                               │    agent-coordinator     │
                               └────┬──────┬──────┬──────┘
                                    │      │      │
                             ┌──────▼┐ ┌───▼──┐ ┌▼────────┐
                             │Planner│ │Exec/ │ │Verifier │
                             │Agent  │ │CoderX│ │ Agent   │
                             └───────┘ └──────┘ └─────────┘
                                            ▲
                               ┌────────────┘
                               │ (escalation only)
                          ┌────▼─────┐
                          │Supervisor│
                          │  Agent   │
                          └──────────┘
```

---

## 10. CENTRALIZATION SCORE

| Dimension | Score | Evidence |
|---|---|---|
| Single entrypoint for agent work | 90/100 | `orchestrate()` is the one true engine entry; only `chatOrchestrator` calls it |
| All services route through orchestrator | 30/100 | Only Chat connects; File-Explorer, Preview, Publishing, Console do not |
| No duplicated workflow logic | 95/100 | No parallel planning or execution logic found across modules |
| Intent classification centralized | 70/100 | `intent-router.ts` is in Chat module, not orchestration |
| Agent selection centralized | 90/100 | `agent-routing.ts` owns all agent resolution |
| Recovery/retry centralized | 85/100 | `retry-manager.ts` and `recovery-coordinator.ts` are in orchestration |

**Overall Centralization Score: 60/100**

The orchestration engine itself is well-centralized internally. The score is dragged down because only one service (Chat) actually routes through it; other services (Preview, File-Explorer, Publishing) are isolated.

---

## 11. REPLIT PARITY SCORE

| Criterion | Score | Notes |
|---|---|---|
| SSE-based streaming (not WebSocket-only) | 90/100 | SSE manager present and wired |
| Server-side secrets (no browser key exposure) | 85/100 | LLM keys resolved server-side only |
| PostgreSQL via Drizzle ORM | 90/100 | `db/index.ts` with Drizzle; schema in `shared/` |
| No Supabase / Firebase auth | 100/100 | No external auth layer found |
| Stateless HTTP routes | 80/100 | Run state managed in-memory + DB |
| OpenRouter via Replit AI Integration env vars | 60/100 | Code supports `AI_INTEGRATIONS_OPENROUTER_API_KEY` but direct key fallback still present |

**Overall Replit Parity Score: 84/100**

---

## 12. CURRENT BLOCKERS

| # | Blocker | Location | Impact |
|---|---|---|---|
| B1 | `OPENROUTER_API_KEY` not set — AI responses disabled | `server/startup/health-diagnostics.ts` | All agent runs return no LLM output |
| B2 | `AGENT_PROJECT_ROOT` not set — sandbox defaulting to `.sandbox` | `server/startup/health-diagnostics.ts` | Verifier and FS tools may fail on path resolution |
| B3 | File-Explorer, Preview, Publishing, Console have no path to the orchestration engine | By design (these are not AI-driven) | Not a bug — but limits future AI-in-the-loop expansion |
| B4 | `ChatAgent` for conversational intents is a completely separate code path from `orchestrate()` — no memory hydration occurs for conversation mode | `chat-orchestrator.ts` | Conversational responses have no project context from memory |

---

## 13. ARCHITECTURAL RISKS

| Risk | Severity | Location | Description |
|---|---|---|---|
| R1 | **HIGH** | `chat-orchestrator.ts` | Two code paths (ChatAgent vs orchestrate) create divergent behavior — memory, checkpointing, and event emission differ between them |
| R2 | **MEDIUM** | `explorer.orchestrator.ts` | Naming is misleading — it is called an "orchestrator" but has no relationship to the AI orchestration engine; could confuse future contributors |
| R3 | **MEDIUM** | `preview.orchestrator.ts`, `console.orchestrator.ts` | Both are health facades named "orchestrator" — same naming confusion risk as R2 |
| R4 | **MEDIUM** | `server/orchestration/swarm/` | `intent-graph-types.ts` suggests a planned swarm/multi-agent layer — if built without routing through the existing `orchestrate()` entrypoint, it will fragment the call graph |
| R5 | **LOW** | `server/chat/intent/intent-router.ts` | Deterministic keyword scoring for intent routing — nuanced prompts may route incorrectly (e.g., "explain how to build a CRM" routes as `explain`, bypassing the build pipeline) |
| R6 | **LOW** | `server/orchestration/distributed/parallel-orchestration-fabric.ts` | Parallel run fabric exists but it is unclear what prevents resource contention between concurrent runs in the same sandbox |

---

## 14. EXACT FILES THAT SHOULD BE MODIFIED (if centralization is the goal)

| File | Reason |
|---|---|
| `server/chat/orchestration/chat-orchestrator.ts` | Unify the two code paths — route conversational intents through a lightweight orchestration context with memory hydration so chat mode gets project context |
| `server/chat/intent/intent-router.ts` | Move or mirror intent routing into `server/orchestration/routing/` so the engine itself owns routing decisions |
| `server/orchestration/index.ts` | Expose a `orchestrateChat()` variant that skips multi-phase planning and drives only `ChatAgent`, allowing full memory + checkpoint wiring for conversation mode |
| `server/startup/health-diagnostics.ts` | Update to require `AGENT_PROJECT_ROOT` rather than silently default to `.sandbox` |

---

## 15. EXACT FILES THAT MUST NOT BE MODIFIED

| File | Reason |
|---|---|
| `server/file-explorer/orchestrator/explorer.orchestrator.ts` | Not an AI orchestrator — it is a correct, clean CRUD coordinator. Connecting it to `server/orchestration` would be wrong by design |
| `server/preview/preview.orchestrator.ts` | Health facade only — has no AI workload to route |
| `server/console/console.orchestrator.ts` | Health facade only — has no AI workload to route |
| `server/orchestration/types/orchestration.types.ts` | Leaf node — all interfaces depend on it; changes ripple everywhere |
| `server/orchestration/coordination/agent-coordinator.ts` | Owns `runPlannerCycle`, `runExecutorAgent`, `runVerification` — the three canonical agent call sites; changes here affect all orchestration paths |
| `server/agents/*/index.ts` (all agent barrels) | Public agent API surface — internal refactors should not break these exports |

---

## 16. FINAL VERDICT

### Q1: Should `explorer.orchestrator.ts` import `server/orchestration/index.ts`?

**NO.**

`ExplorerOrchestrator` is a filesystem CRUD coordinator. It holds no agent-driven planning, execution, or verification workload. Connecting it to `server/orchestration` would introduce an inappropriate dependency, add latency to simple FS operations, and couple a synchronous I/O layer to an async AI engine. The current decoupling is correct and should be preserved.

---

### Q2: Is `server/orchestration` the true central orchestrator?

**YES — with one qualification.**

`server/orchestration/index.ts` and its `orchestrate()` function constitute the true, singular engine for all multi-phase agent work. It owns planning, execution, verification, retry, recovery, and telemetry. However, it is currently only consumed by one external caller (`chatOrchestrator`), making it central in design but not yet central in practice across all services.

---

### Q3: What is the correct target architecture?

The project is closest to **OPTION C** but is not fully there yet. The correct target is:

```
User Message
↓
POST /api/run
↓
ChatOrchestrator  (thin HTTP → orchestration bridge)
↓
Intent Router     (conversation | explain | build | fix | modify | debug)
↓
server/orchestration/index.ts  ← SINGLE ENTRYPOINT for ALL intents
  ├── conversation / explain → lightweight orchestration context → ChatAgent (with memory)
  └── build / fix / modify / debug → full Planner → Executor → Verifier pipeline
↓
Central Orchestrator Engine
  └── Supervisor (escalation)
        └── Planner → Executor/CoderX/Browser → Verifier
```

**File Explorer, Preview, Publishing, Console** remain decoupled from the orchestration engine — they are infrastructure and CRUD services, not AI-driven pipelines. They should never be forced through `orchestrate()`.

**The single gap between the current state and the target architecture** is that `conversation` and `explain` intents bypass the orchestration engine entirely, resulting in context-less, checkpoint-free, memory-free LLM responses. Routing them through a lightweight `orchestrateChat()` path would complete the centralization.

---

*End of audit. No code was modified.*
