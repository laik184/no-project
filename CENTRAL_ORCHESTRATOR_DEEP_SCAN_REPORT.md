# CENTRAL ORCHESTRATOR DEEP SCAN REPORT

**Scope:** `server/chat/` · `server/file-explorer/` · `server/orchestration/`  
**Method:** Static import tracing · live call-graph tracing · actual file reads  
**Policy:** Read-only — zero code changes, zero new files (except this report)

---

## 1. FILES SCANNED

### server/chat/
| File | Role |
|---|---|
| `index.ts` | Module mount — exports `chatRouter`, `chatOrchestrator` |
| `api/run-start.router.ts` | Route: `POST /api/run` |
| `api/chat.routes.ts` | Routes: `POST /api/chat/message`, `GET /api/chat/stream` |
| `api/attachment.routes.ts` | Route: `POST /api/chat/attach` |
| `controllers/run-controller.ts` | HTTP → `chatOrchestrator.startRun()` delegate |
| `controllers/chat-controller.ts` | HTTP → `chatOrchestrator` delegate |
| `orchestration/chat-orchestrator.ts` | **Gateway bridge** — owns run lifecycle, calls `orchestrate()` or `runChatAgent()` |
| `intent/intent-router.ts` | Deterministic keyword intent classifier |
| `agents/chat/chat-agent.ts` | Direct LLM agent for conversational/explain intents |
| `llm/chat-responder.ts` | Streams LLM tokens via `streamManager`, feeds SSE |
| `realtime/event-publisher.ts` | Wraps `bus.emit('agent.event', ...)` |
| `realtime/sse-manager.ts` | SSE push facade over infra SSE manager |
| `realtime/connection-registry.ts` | Tracks open SSE connections by `runId` |
| `realtime/stream-manager.ts` | Opens/appends/closes per-run token streams |
| `persistence/message-store.ts` | Drizzle writes to `chat_messages` |
| `persistence/run-store.ts` (runWriter) | Drizzle writes to `agent_runs` |
| `persistence/checkpoint-store.ts` | Drizzle writes to `chat_checkpoints` |
| `messages/message-builder.ts` | Composes and persists user/system/assistant messages |
| `run/registry.ts` | In-memory active run registry (runManager) |
| `timeline/run-timeline.ts` | Per-run event timeline |
| `schemas/chat.schema.ts` | Zod schemas for HTTP request validation |

### server/file-explorer/
| File | Role |
|---|---|
| `orchestrator/explorer.orchestrator.ts` | **CRUD coordinator** — sequences all FS operations |
| `orchestrator/index.ts` | Barrel export of `explorerOrchestrator` |
| `controllers/file-explorer.controller.ts` | HTTP handlers, delegates to `explorerOrchestrator` |
| `services/tree/tree.service.ts` | Directory tree construction |
| `services/read/read.service.ts` | File read with size + binary guards |
| `services/write/write.service.ts` | File write + `clientMtime` conflict detection |
| `services/history/history.service.ts` | Snapshot-before-write, version restore |
| `repositories/filesystem.repository.ts` | Raw `fs`/`path` access |
| `repositories/history.repository.ts` | Version history persistence |
| `realtime/file-events.service.ts` | Emits file events onto infra bus |
| `realtime/file-publisher.ts` | Wraps bus.emit for file events |
| `guards/path.guard.ts` | `resolveSafe()` + `isExcluded()` — sandbox enforcement |
| `mappers/tree.mapper.ts` | FS entries → typed tree nodes |
| `config/index.ts` | `FE_CONFIG` — maxReadSizeBytes, excluded paths |

### server/orchestration/
| File | Role |
|---|---|
| `index.ts` | **True entrypoint** — exports `orchestrate()`, `createOrchestrationRouter()`, `initOrchestration()` |
| `orchestrator.ts` | Root engine — drives `orchestration-loop.ts`, hydrates memory |
| `core/run-manager.ts` | Singleton active-run registry |
| `core/orchestration-context.ts` | `buildOrchestrationContext()` |
| `core/orchestration-session.ts` | Per-run session object |
| `core/orchestration-state.ts` | State machine transitions |
| `core/orchestration-replay.ts` | Replay from checkpoint on failure |
| `planning/workflow-planner.ts` | Goal string → WorkflowType (6 types) |
| `planning/phase-planner.ts` | WorkflowType → ordered Phase list |
| `planning/execution-plan-builder.ts` | Assembles `ExecutionPlan` |
| `execution/orchestration-loop.ts` | Main run loop |
| `execution/workflow-runner.ts` | Phase iteration |
| `execution/phase-runner.ts` | Runs one phase via `dispatcher-client.ts` |
| `execution/retry-manager.ts` | Per-phase retry + backoff |
| `execution/execution-result-registry.ts` | Phase result storage |
| `routing/agent-routing.ts` | `resolveAgentForPhase()` — runtime agent selection + fallback |
| `routing/workflow-routing.ts` | `buildWorkflowExecutionPlan()` |
| `routing/task-routing.ts` | Low-level task dispatch decisions |
| `coordination/agent-coordinator.ts` | Calls `runPlannerCycle`, `runExecutorAgent`, `runVerification` |
| `coordination/dispatcher-client.ts` | Sends task to agent subprocess |
| `coordination/orchestration-routing.ts` | Cross-run coordination |
| `distributed/run-scoped-orchestrator.ts` | Isolated per-run wrapper |
| `distributed/parallel-orchestration-fabric.ts` | Multi-run concurrent execution with `orch.recover()` |
| `distributed/multi-run-recovery.ts` | Cross-run Circuit Breaker pattern |
| `lifecycle/lifecycle-manager.ts` | Run lifecycle hooks |
| `lifecycle/recovery-coordinator.ts` | Strategy: `retry_last_phase` · `skip_failed_phase` · `restart_workflow` |
| `lifecycle/escalation-manager.ts` | Escalates to Supervisor on repeated failure |
| `agents/verification-bridge.ts` | Adapter: Orchestrator ↔ VerifierAgent |
| `events/orchestration-events.ts` | Internal event type definitions |
| `events/event-publisher.ts` | Orchestration-scoped events onto infra bus |
| `monitoring/orchestration-monitor.ts` | Health + telemetry |
| `monitoring/failure-monitor.ts` | Failure pattern tracking |
| `validation/workflow-validator.ts` | Pre-flight validation |
| `validation/orchestration-validator.ts` | Runtime integrity |
| `validation/integrity-validator.ts` | Post-run result validation |
| `telemetry/orchestration-metrics.ts` | Metrics |
| `telemetry/orchestration-logger.ts` | Structured logging |
| `swarm/intent-graph/intent-graph-types.ts` | Types for future swarm layer |
| `types/orchestration.types.ts` | All shared interfaces (leaf node — no imports) |
| `utils/orchestration-utils.ts` | `newOrchestrationId()`, `toErrorMessage()` |

---

## 2. IMPORT GRAPH

```
server/chat/orchestration/chat-orchestrator.ts
  ├── import { orchestrate }           ← server/orchestration/index.ts       ✅ CONNECTED
  ├── import { routeIntent, isChatMode }← server/chat/intent/intent-router.ts
  └── import { runChatAgent }          ← server/agents/chat/chat-agent.ts

server/agents/chat/chat-agent.ts
  ├── import { getLLMClient }          ← server/shared/llm-client.ts
  └── import { streamManager }         ← server/chat/realtime/stream-manager.ts
  └── NO import from server/orchestration                                      ✗ ISOLATED

server/orchestration/distributed/run-scoped-orchestrator.ts
  └── import { orchestrate }           ← server/orchestration/index.ts       (internal)

server/orchestration/distributed/parallel-orchestration-fabric.ts
  └── import { orchestrate }           ← server/orchestration/index.ts       (internal)

server/agents/supervisor/supervisor-agent.ts
  └── import types                     ← server/orchestration/types/orchestration.types.ts

server/file-explorer/orchestrator/explorer.orchestrator.ts
  ├── import { treeService }           ← ../services/tree/tree.service.ts
  ├── import { readService }           ← ../services/read/read.service.ts
  ├── import { writeService }          ← ../services/write/write.service.ts
  ├── import { historyService }        ← ../services/history/history.service.ts
  ├── import { fileEventsService }     ← ../realtime/file-events.service.ts
  └── NO import from server/orchestration                                      ✗ NOT CONNECTED (by design)

server/preview/preview.orchestrator.ts
  └── NO import from server/orchestration                                      ✗ health facade only

server/console/console.orchestrator.ts
  └── NO import from server/orchestration                                      ✗ health facade only

server/publishing/index.ts
  └── NO import from server/orchestration                                      ✗ direct services only
```

**Single external consumer of `orchestrate()`:**
→ `server/chat/orchestration/chat-orchestrator.ts` (for `build` / `fix` / `modify` / `debug` intents)

---

## 3. CALL GRAPH

### Full User → Frontend Flow (Actionable Intent)

```
User Message: "build crm" / "fix login bug" / "create dashboard"
↓
POST /api/run
  └── run-start.router.ts
        └── validates with startRunSchema (Zod)
              └── runController.startRun()
                    └── chatOrchestrator.startRun(payload)
                          ├── runManager.register(runId)              [in-memory]
                          ├── runWriter.create(runId, projectId, goal) [DB: agent_runs]
                          ├── messageBuilder.buildSystem(...)          [DB: chat_messages role=system]
                          ├── messageBuilder.buildUser(content)        [DB: chat_messages role=user]
                          ├── eventPublisher.publish('chat.run.started')
                          ├── routeIntent(goal) → intent: build | fix | modify | debug
                          └── orchestrate(context)  ← server/orchestration/index.ts
                                └── orchestrator.ts
                                      └── orchestration-loop.ts
                                            └── workflow-planner.ts   → WorkflowType
                                                  └── phase-planner.ts → Phase[]
                                                        └── workflow-runner.ts (per phase)
                                                              └── phase-runner.ts
                                                                    └── dispatcher-client.ts
                                                                          └── agent-coordinator.ts
                                                                                ├── runPlannerCycle()  → PlannerAgent
                                                                                ├── runExecutorAgent() → ExecutorAgent / CoderXAgent / BrowserAgent / TerminalAgent
                                                                                └── runVerification()  → VerifierAgent
                          ↓ (on success)
                          chatOrchestrator.completeRun(runId, ...)
                            ├── streamManager.close(runId)
                            ├── messageBuilder.buildAssistant(content) [DB: chat_messages role=assistant]
                            ├── runWriter.complete(runId)              [DB: agent_runs status=completed]
                            ├── chatCheckpointStore.createForRun(...)  [DB: chat_checkpoints]
                            ├── eventPublisher.publish('chat.run.completed')
                            └── eventPublisher.publish('run.lifecycle')
                          ↓ (on failure)
                          chatOrchestrator.failRun(runId, error)
                            ├── streamManager.close(runId)
                            ├── runWriter.fail(runId)                  [DB: agent_runs status=failed]
                            ├── eventPublisher.publish('chat.run.failed')
                            └── eventPublisher.publish('run.lifecycle')
↓
SSE: infra bus → sseManager → EventSource → Frontend
```

### Full User → Frontend Flow (Conversational Intent)

```
User Message: "hello" / "explain react hooks" / "what is this code"
↓
POST /api/run  (or POST /api/chat/message)
  └── chatOrchestrator.startRun(payload)
        ├── [same run registration + user/system persistence]
        ├── routeIntent(goal) → intent: conversation | explain
        └── runChatAgent({ runId, projectId, goal, context })
              ├── context = memoryEngine.recall() + contextLoader.build()  [HAS project context]
              ├── streamManager.open(runId, projectId)
              ├── eventPublisher.publish('agent.thinking')
              ├── getLLMClient().chat.completions.create({ stream: true })
              ├── [per token] streamManager.append(runId, token)
              │             → bus.emit('agent.token')
              │             → sseManager → Frontend (live streaming)
              └── streamManager.close(runId)
        ↓ (on success, fire-and-forget)
        chatOrchestrator.completeRun(...)    [same checkpoint + persistence as above]
```

### File Explorer Call Graph

```
HTTP (GET/POST/PUT/DELETE/PATCH) /api/files/*
  └── FileExplorerController
        └── explorerOrchestrator.[method]()
              ├── readFile(path)
              │     └── readService.read(path)         → size + binary guard
              │           └── filesystemRepository.readFile()  [fs.readFile]
              │
              ├── writeFile(path, content, clientMtime)
              │     ├── historyService.snapshotBeforeWrite(path)  [saves version]
              │     ├── writeService.write(path, content, clientMtime)
              │     │     └── conflict check: if |clientMtime - serverMtime| > 1s → return conflict:true
              │     └── fileEventsService.onModified(path)
              │           └── filePublisher.publishModified()
              │                 └── bus.emit('file.modified', { path, projectId, size })
              │
              ├── getHistory(path)
              │     └── historyService.getHistory(path)  [returns snapshots, newest first]
              │
              └── getInsights()  ← only method with AI-adjacent semantics (returns file context)
                    [currently: static analysis, NOT LLM-driven]
```

---

## 4. DEPENDENCY GRAPH

```
server/chat/
  ├──► server/orchestration/index.ts          (actionable intents only)
  ├──► server/agents/chat/chat-agent.ts       (conversational intents only)
  ├──► server/infrastructure/events/bus       (SSE event routing)
  ├──► server/infrastructure/db               (run + message + checkpoint persistence)
  ├──► server/memory/                         (context building for ChatAgent)
  └──► server/shared/llm-client.ts            (LLM access, via chat-agent)

server/orchestration/
  ├──► server/agents/planner/                 (plan phase)
  ├──► server/agents/executor/               (execute phase — default)
  ├──► server/agents/coderx/                (execute phase — code-heavy tasks)
  ├──► server/agents/browser/               (execute phase — browser tasks)
  ├──► server/agents/terminal/              (execute phase — shell tasks)
  ├──► server/agents/filesystem/            (execute phase — FS tasks)
  ├──► server/agents/verifier/              (verify phase)
  ├──► server/agents/supervisor/            (escalation, report phase)
  ├──► server/memory/                       (context hydration at run start)
  └──► server/infrastructure/events/bus     (orchestration event publishing)

server/file-explorer/
  ├──► server/infrastructure/events/bus     (file events: modified, created, deleted, renamed, uploaded)
  ├──► server/infrastructure/db             (history/snapshot persistence)
  └──► node:fs / node:path                 (direct filesystem access)
  └──✗ server/orchestration/               (NO dependency — correct by design)

server/preview/
  └──► server/infrastructure/              (health facade only)
  └──✗ server/orchestration/               (NO dependency)

server/console/
  └──► server/infrastructure/              (health facade only)
  └──✗ server/orchestration/               (NO dependency)

server/publishing/
  └──✗ server/orchestration/               (NO dependency)
```

---

## 5. OWNERSHIP GRAPH

| Concern | Owner | Location |
|---|---|---|
| **Intent Classification** | `ChatOrchestrator` (via intent-router) | `server/chat/intent/intent-router.ts` |
| **Run Lifecycle** | `ChatOrchestrator` | `server/chat/orchestration/chat-orchestrator.ts` |
| **Workflow Planning** | `server/orchestration` | `planning/workflow-planner.ts` + `phase-planner.ts` |
| **Agent Routing** | `server/orchestration` | `routing/agent-routing.ts` |
| **Execution Loop** | `server/orchestration` | `execution/orchestration-loop.ts` |
| **Verification** | `server/orchestration` | `agents/verification-bridge.ts` → `VerifierAgent` |
| **Retry / Recovery** | `server/orchestration` (hierarchical) | `execution/retry-manager.ts`, `lifecycle/recovery-coordinator.ts`, `distributed/multi-run-recovery.ts` |
| **SSE Publishing** | Infra bus + `sseManager` | `server/infrastructure/events/sse/sse-manager.ts` |
| **Token Streaming** | `streamManager` (chat-scoped) | `server/chat/realtime/stream-manager.ts` |
| **Message Persistence** | `messageBuilder` + `messageStore` | `server/chat/persistence/message-store.ts` |
| **Run Persistence** | `runWriter` | `server/chat/persistence/run-store.ts` |
| **Checkpoint Creation** | `ChatOrchestrator.completeRun()` | `server/chat/orchestration/chat-orchestrator.ts` |
| **File CRUD** | `ExplorerOrchestrator` | `server/file-explorer/orchestrator/explorer.orchestrator.ts` |
| **File Snapshots** | `historyService` | `server/file-explorer/services/history/history.service.ts` |
| **Memory / Context** | `memoryEngine` + `contextLoader` | `server/memory/` |
| **Escalation** | `EscalationManager` → `SupervisorAgent` | `server/orchestration/lifecycle/escalation-manager.ts` |

---

## 6. SERVICE → ORCHESTRATOR RELATIONSHIPS

| Service | Route to `orchestrate()` | Route to `ChatAgent` | Route to Own Engine | Notes |
|---|---|---|---|---|
| **Chat** (build/fix/modify/debug) | ✅ Direct | ✗ | ✗ | Sole external caller of `orchestrate()` |
| **Chat** (conversation/explain) | ✗ | ✅ Direct | ✗ | Bypasses orchestration; has memory context |
| **File Explorer** | ✗ | ✗ | ✅ CRUD coordinator | No AI workload — correct |
| **Preview** | ✗ | ✗ | ✅ Health facade | No AI workload — correct |
| **Console** | ✗ | ✗ | ✅ Health facade | No AI workload — correct |
| **Publishing** | ✗ | ✗ | ✅ Direct services | No AI workload currently |

---

## 7. DUPLICATE ORCHESTRATION ANALYSIS

| Logic Type | Chat | File Explorer | Orchestration Engine | Verdict |
|---|---|---|---|---|
| Workflow planning (goal → phases) | ✗ | ✗ | ✅ `workflow-planner.ts` | **No duplication** |
| Agent routing | Intent-level gate only | ✗ | ✅ `agent-routing.ts` | **No duplication** — intent router is pre-gate, not router |
| Execution loop | ✗ | ✗ | ✅ `orchestration-loop.ts` | **No duplication** |
| Retry management | ✗ | ✗ | ✅ `retry-manager.ts` | **No duplication** |
| Verification | ✗ | ✗ | ✅ `verification-bridge.ts` | **No duplication** |
| Run lifecycle | ✅ `chat-orchestrator.ts` | ✗ | Partial (orchestration-state.ts) | **Partial split** — chat owns HTTP-level lifecycle, orchestration owns engine-level state |
| Checkpoint creation | ✅ `chatOrchestrator.completeRun()` | Local: `historyService` | ✗ | **Scoped by domain** — chat checkpoints ≠ file snapshots; different purposes |
| SSE publishing | Chat-scoped (`event-publisher.ts`) | File-scoped (`file-publisher.ts`) | Orch-scoped (`event-publisher.ts`) | **Scoped by domain** — not duplication, same infra bus |
| "Orchestrator" naming | `ChatOrchestrator` (bridge) | `ExplorerOrchestrator` (CRUD) | `Orchestrator` (engine) | **Name collision** — conceptually different roles, confusing naming |

**Finding:** Zero duplicated planning, execution, or verification logic. The naming collision between three things called "orchestrator" is the main architectural confusion risk.

---

## 8. CENTRALIZATION SCORE

| Dimension | Score | Evidence |
|---|---|---|
| Single entrypoint for all AI agent work | 85/100 | `orchestrate()` is the one true engine; only chat calls it — but conversation/explain bypass it |
| All services route AI work through orchestrator | 40/100 | Only actionable chat intents go through; conversation/explain, file-explorer, preview, publishing do not |
| No duplicated planning/execution logic | 98/100 | None found across modules |
| Intent classification owned by orchestration layer | 20/100 | `intent-router.ts` lives in `server/chat/` — not in orchestration |
| Agent selection centralized | 90/100 | `agent-routing.ts` owns all agent resolution and fallback |
| Recovery centralized | 75/100 | Three-layer recovery (agent-local, orchestration, distributed) — well-structured but not single point |
| Memory/context centralized | 80/100 | `memoryEngine` is single platform; both ChatAgent and Orchestrator use it |

**Overall Centralization Score: 70/100**

The engine itself is well-designed and internally cohesive. The score is limited by: (a) conversation/explain intents bypassing the engine, (b) intent classification living outside the engine, (c) no service besides chat consuming `orchestrate()`.

---

## 9. CURRENT ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React/Vite :5000)                            │
│       EventSource (SSE)  ·  fetch /api/*  ·  WebSocket                       │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴───────────────────────────┐
          │                                                       │
┌─────────▼──────────────┐                           ┌──────────▼──────────────┐
│  POST /api/run          │                           │  GET/POST /api/files/*  │
│  POST /api/chat/message │                           │  (file explorer routes) │
│  GET  /api/realtime     │                           └──────────┬──────────────┘
└─────────┬───────────────┘                                      │
          │                                           ┌──────────▼──────────────┐
┌─────────▼───────────────┐                           │   ExplorerOrchestrator  │
│    ChatOrchestrator      │                           │   (CRUD coordinator)    │
│  ┌──────────────────┐   │                           └──────────┬──────────────┘
│  │  startRun()      │   │                                      │
│  │  completeRun()   │   │                           ┌──────────▼──────────────┐
│  │  failRun()       │   │                           │  read / write / tree    │
│  └──────────────────┘   │                           │  history / search       │
└─────────┬───────────────┘                           │  (fs/path + DB)         │
          │                                           └──────────┬──────────────┘
┌─────────▼──────────────┐                                       │
│    intent-router.ts     │                           ┌──────────▼──────────────┐
│  ┌─────────────────┐   │                           │   infra bus (file.*)    │
│  │ conversation    ├───┼──► runChatAgent()          └─────────────────────────┘
│  │ explain         │   │     (ChatAgent — direct LLM)
│  ├─────────────────┤   │     ↓ streams agent.token via SSE
│  │ build           ├───┼──► orchestrate()
│  │ fix             │   │     ↓
│  │ modify          │   └─────┼───────────────────────────────────────────────┐
│  │ debug           │         │                                                │
│  └─────────────────┘         │         server/orchestration/index.ts          │
└────────────────────          │         ══════════════════════════════════    │
                               │         workflow-planner → phase-planner      │
                               │         execution-loop → phase-runner          │
                               │         dispatcher-client → agent-coordinator  │
                               │               │          │          │          │
                               │          ┌────▼──┐ ┌────▼──┐ ┌────▼──┐      │
                               │          │Planner│ │Exec/  │ │Verify │      │
                               │          │Agent  │ │CoderX/│ │Agent  │      │
                               │          └───────┘ │Browser│ └───────┘      │
                               │                    │/Term  │                 │
                               │                    └───────┘                 │
                               │                        ▲ (escalation only)   │
                               │               ┌────────┘                     │
                               │          ┌────▼──────┐                      │
                               │          │Supervisor  │                      │
                               │          │(escalation │                      │
                               │          │+ report)   │                      │
                               │          └────────────┘                      │
                               └────────────────────────────────────────────── ┘
                                                    │
                                    ┌───────────────▼──────────────────┐
                                    │     infra bus → SSE manager       │
                                    │   agent.token / run.* / tool.*   │
                                    └───────────────┬──────────────────┘
                                                    │
                                             Frontend EventSource
```

---

## 10. RECOMMENDED ARCHITECTURE DIAGRAM

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React/Vite :5000)                            │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴───────────────────────────┐
          │                                                       │
┌─────────▼──────────────┐                           ┌──────────▼──────────────┐
│  POST /api/run          │                           │  GET/POST /api/files/*  │
│  POST /api/chat/message │                           └──────────┬──────────────┘
│  GET  /api/realtime     │                                      │ [unchanged]
└─────────┬───────────────┘                           ┌──────────▼──────────────┐
          │                                           │   ExplorerOrchestrator  │
┌─────────▼───────────────┐                           │   (CRUD coordinator)    │
│    ChatOrchestrator      │                           │   [STAYS as-is]         │
│  (thin HTTP bridge only) │                           └─────────────────────────┘
└─────────┬───────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────────────────┐
│                    server/orchestration/index.ts                              │
│                    ═══════════════════════════                               │
│                    SINGLE ENTRYPOINT FOR ALL INTENTS                         │
│                                                                              │
│   orchestrate(context, { mode: 'chat' })     ← conversation / explain        │
│     └── lightweight path: no phases, direct ChatAgent + memory               │
│                                                                              │
│   orchestrate(context, { mode: 'build' })    ← build / fix / modify / debug  │
│     └── full path: Planner → Executor → Verifier pipeline                    │
│                                                                              │
│   Intent classification MOVES here: orchestration/routing/intent-router.ts  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
    ┌─────▼──────┐           ┌────────▼────────┐        ┌────────▼─────────┐
    │ ChatAgent  │           │  PlannerAgent   │        │  VerifierAgent   │
    │ (chat mode)│           │ → ExecutorAgent │        │  (verify phase)  │
    └────────────┘           │ → CoderX/Browser│        └──────────────────┘
                             └─────────────────┘
                                                           ▲ (escalation)
                                                    ┌──────┘
                                             ┌──────▼──────┐
                                             │ Supervisor   │
                                             └─────────────┘

[File Explorer, Preview, Console, Publishing — no change. They are not AI pipelines.]
```

**Key change:** Intent classification moves into `server/orchestration/`. `orchestrate()` gets a `mode` parameter. Conversation/explain route through a lightweight orchestration context that wires memory + checkpoints, instead of bypassing the engine entirely.

---

## 11. EXACT FILES THAT SHOULD USE CENTRAL ORCHESTRATOR

| File | Current State | Recommended Change |
|---|---|---|
| `server/chat/orchestration/chat-orchestrator.ts` | Calls `orchestrate()` for actionable, `runChatAgent()` directly for conversational | Route ALL intents through `orchestrate()` using a `mode` parameter; remove direct `runChatAgent()` call |
| `server/chat/intent/intent-router.ts` | Owned by Chat module | Move to `server/orchestration/routing/intent-router.ts`; re-export from Chat for compatibility |
| `server/orchestration/index.ts` | Only handles actionable intents | Add `orchestrateChat()` or `mode: 'chat'` overload so conversational intents get memory + checkpoint wiring |

---

## 12. EXACT FILES THAT SHOULD NOT USE CENTRAL ORCHESTRATOR

| File | Reason |
|---|---|
| `server/file-explorer/orchestrator/explorer.orchestrator.ts` | Pure CRUD coordinator — no AI workload; adding orchestration dependency would create wrong coupling, add latency, and break the synchronous I/O contract |
| `server/file-explorer/services/write/write.service.ts` | Conflict detection and write logic is synchronous; orchestration is async and event-driven — wrong paradigm |
| `server/file-explorer/services/history/history.service.ts` | Local file versioning — scoped to FS domain; distinct from chat-level checkpoints |
| `server/preview/preview.orchestrator.ts` | Health facade — zero AI workload |
| `server/console/console.orchestrator.ts` | Health facade — zero AI workload |
| `server/publishing/index.ts` | Static publishing workflow — not AI-driven currently |
| `server/orchestration/types/orchestration.types.ts` | Leaf node — all interfaces depend on it |
| `server/orchestration/coordination/agent-coordinator.ts` | Owns the three canonical agent call sites — changes cascade everywhere |

**Exception for File Explorer — AI Expansion:** If AI-assisted file operations (AI Edit, AI Refactor, AI Generate File) are built in the future, the correct pattern is:
- Add `aiTransform(filePath, prompt, mode)` to `ExplorerOrchestrator`
- Inside `aiTransform()`, call `orchestrate()` with a dedicated `'ai_file_op'` workflow type
- This keeps the public API of ExplorerOrchestrator unchanged while routing the AI sub-task through the central engine

---

## 13. RISKS

| # | Risk | Severity | Location | Detail |
|---|---|---|---|---|
| R1 | **Two-path divergence for conversation vs build** | HIGH | `chat-orchestrator.ts` | Conversation intents bypass `orchestrate()` — no checkpoint, no escalation, no recovery, partial memory. If the system grows, these paths will drift further apart. |
| R2 | **Intent classification outside the engine** | HIGH | `server/chat/intent/intent-router.ts` | Intent routing is the most critical decision point; owning it in the Chat module means orchestration cannot self-correct misclassified intents |
| R3 | **"Orchestrator" naming collision** | MEDIUM | explorer, preview, console, chat, orchestration | Three modules use "Orchestrator" for completely different concepts; confuses new contributors and makes architecture hard to read |
| R4 | **`conversation`/`explain`/`chat` absent from `workflow-planner.ts`** | MEDIUM | `server/orchestration/planning/workflow-planner.ts` | The engine has no concept of conversational mode; it cannot self-route chat-like intents even if called with them |
| R5 | **Supervisor cannot select ChatAgent** | MEDIUM | `server/agents/supervisor/` | Supervisor fallback chain: browser/fs/terminal → executor; planner/verifier → supervisor; no path to ChatAgent. A misclassified "build" intent cannot be downgraded to a conversation response |
| R6 | **`checkpoint.created` event not consumed by main frontend handler** | LOW | `server/chat/orchestration/chat-orchestrator.ts` | Checkpoint events reach `use-checkpoints.ts` but not the main `agent-event-handler.ts` — checkpoint UI state may lag |
| R7 | **`getInsights()` on ExplorerOrchestrator has AI-adjacent semantics but no LLM backing** | LOW | `server/file-explorer/orchestrator/explorer.orchestrator.ts` | Currently static analysis — when AI is added here, the lack of orchestration wiring will be felt |
| R8 | **Swarm intent-graph types exist but are unwired** | LOW | `server/orchestration/swarm/` | If built without routing through `orchestrate()`, a second parallel engine will fragment the call graph |

---

## 14. BLOCKERS

| # | Blocker | Location | Impact |
|---|---|---|---|
| B1 | `conversation` and `explain` intents have no entry in `workflow-planner.ts` | `server/orchestration/planning/workflow-planner.ts` | Cannot route them through the engine without code change |
| B2 | `orchestrate()` has no `mode` or `lightweight` parameter | `server/orchestration/index.ts` | A full Planner → Executor → Verifier pipeline would run for "hello" — wrong behavior |
| B3 | `agent-routing.ts` fallback chain has no ChatAgent | `server/orchestration/routing/agent-routing.ts` | Even after B1/B2 are fixed, the routing layer cannot dispatch to ChatAgent |
| B4 | `ChatAgent` imports `streamManager` from `server/chat/` — it is not decoupled from the chat module | `server/agents/chat/chat-agent.ts` | Moving ChatAgent dispatch into orchestration would require extracting `streamManager` to infrastructure first |
| B5 | `intent-router.ts` imports are entangled with chat module internals | `server/chat/intent/intent-router.ts` | Moving it to orchestration requires verifying no circular dependencies |

---

## 15. FINAL VERDICT

### Q1: Should `explorer.orchestrator.ts` import `server/orchestration/index.ts`?

**NO — definitively.**

`ExplorerOrchestrator` is a synchronous, CRUD-based filesystem coordinator. Its responsibilities are:
- Read/write files with conflict detection
- Maintain local version snapshots
- Emit file-change events onto the bus
- Return tree structures and metadata

None of these require AI planning, multi-phase execution, or agent dispatch. Importing `orchestrate()` would:
1. Introduce an async, non-deterministic AI engine into a synchronous I/O path
2. Create an inappropriate coupling between domain-specific FS logic and the AI orchestration engine
3. Add unnecessary latency and failure surface to every file operation

**The correct boundary:** File Explorer stays as a domain service. If AI-assisted file operations are needed in the future, add a dedicated `aiTransform()` method that internally calls `orchestrate()` — keeping the AI concern isolated within that one method.

---

### Q2: Should Preview, Publishing, Console use Central Orchestrator?

**NO — currently.**

- `preview.orchestrator.ts`: Health facade. 20 lines. No AI workload. Should remain as-is.
- `console.orchestrator.ts`: Health facade. No AI workload. Should remain as-is.
- `publishing/index.ts`: Static deployment workflow. No AI workload currently.

**Exception:** If publishing evolves to include AI-generated deployment configs, environment validation by an agent, or automated security checks — then `publishOrchestrate()` should be added as a call into `server/orchestration/index.ts`, following the same pattern as `chatOrchestrator`.

---

### Q3: What should remain local services?

These files are domain-correct as local services and must NOT be connected to the central orchestrator:

```
server/file-explorer/services/read/read.service.ts
server/file-explorer/services/write/write.service.ts
server/file-explorer/services/history/history.service.ts
server/file-explorer/services/tree/tree.service.ts
server/file-explorer/repositories/filesystem.repository.ts
server/file-explorer/repositories/history.repository.ts
server/file-explorer/realtime/file-events.service.ts
server/file-explorer/realtime/file-publisher.ts
server/file-explorer/guards/path.guard.ts
server/preview/preview.orchestrator.ts
server/console/console.orchestrator.ts
server/chat/realtime/stream-manager.ts          (chat-scoped streaming concern)
server/chat/persistence/message-store.ts         (chat domain persistence)
server/chat/persistence/run-store.ts             (run lifecycle persistence)
server/chat/persistence/checkpoint-store.ts      (chat-level checkpoints)
```

---

### Q4: What should become orchestration consumers?

These files should route through `server/orchestration/index.ts`:

```
server/chat/orchestration/chat-orchestrator.ts   [currently: partial — add conversation/explain path]
server/chat/intent/intent-router.ts              [move to server/orchestration/routing/]
```

Future candidates (only if AI workloads are added):
```
server/file-explorer/orchestrator/explorer.orchestrator.ts  [only for aiTransform() method]
server/publishing/index.ts                                  [only for AI-assisted deploy flows]
```

---

### Architecture Verdict

**`server/orchestration/index.ts` IS the correct Central Orchestrator** — but it is currently the Central Orchestrator for only **half of the AI workload** (actionable intents). Conversational intents bypass it.

**Current state:** Option B (partially fragmented)
```
Chat (build/fix/modify/debug) → orchestrate()        ✅
Chat (conversation/explain)   → ChatAgent directly   ✗ bypasses engine
File Explorer                 → CRUD coordinator     ✅ correct by design
```

**Target state:** Option C (fully centralized for all AI workloads)
```
Chat (all intents) → orchestrate(mode)  → engine routes internally
File Explorer      → CRUD coordinator   [unchanged]
Preview/Console    → health facades     [unchanged]
```

**The minimum set of changes to reach target state (not implemented here — audit only):**
1. Add `mode: 'chat' | 'build'` to `orchestrate()` signature in `orchestration/index.ts`
2. Add `conversation` and `explain` workflow types to `workflow-planner.ts`
3. Add ChatAgent to `agent-routing.ts` fallback chain
4. Extract `streamManager` to `server/infrastructure/` (decouple from chat module)
5. Move `intent-router.ts` to `server/orchestration/routing/`
6. Remove direct `runChatAgent()` call from `chat-orchestrator.ts`

---

*End of audit. No code was modified. No files were created except this report.*
