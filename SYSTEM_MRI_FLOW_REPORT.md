# SYSTEM MRI FLOW REPORT
> Forensic scan — actual code only. No inferred or intended architecture.

---

## 1. Actual Root Bootstrap Graph

```
main.ts
  │
  ├── import express                          from 'express'
  ├── import { createServer }                 from 'http'
  └── import { chatOrchestrator }             from './server/chat/index.ts'
        │
        ├── registers: app.use('/api/chat', chatOrchestrator.buildChatRouter())
        ├── registers: app.use(chatOrchestrator.buildSseRouter())
        ├── calls:     chatOrchestrator.attachWebSocket(server)
        └── calls:     chatOrchestrator.startPersistence()

NOTHING ELSE IS BOOTSTRAPPED FROM main.ts.

NOT bootstrapped:
  ✗ loadAllTools()             — tool registry is EMPTY at runtime
  ✗ initOrchestration()        — orchestration layer is NOT initialized
  ✗ createOrchestrationRouter()— /api/orchestration/* routes DO NOT EXIST
  ✗ runtimeManager.init()
  ✗ observationController.start()
  ✗ initExecutionHistory()
  ✗ startRecoveryManager()
  ✗ initRuntimeEvents()
  ✗ startReflectionEngine()
  ✗ initDagMetricsCollector()
  ✗ initRuntimeMemoryCollector()
  ✗ initReflectionMemoryBridge()
  ✗ fileLockManager.startCleaner()
  ✗ startPortSweeper()
  ✗ contextRegistry.startSweeper()
  ✗ wireCoordinationSSE()
  ✗ initializePlanner()
  ✗ initializeExecutor()
  ✗ initBrowserBusBridge()
```

---

## 2. Actual Import Graph

### main.ts → server/chat/index.ts

```
server/chat/index.ts
  ├── import { chatRoutes }        from './api/chat.routes.ts'
  ├── import { runRoutes }         from './api/run.routes.ts'
  ├── import { historyRoutes }     from './api/history.routes.ts'
  ├── import { attachmentRoutes }  from './api/attachment.routes.ts'
  ├── import { questionRoutes }    from './api/question.routes.ts'
  ├── import { heartbeatManager }  from './realtime/heartbeat-manager.ts'
  ├── import { websocketManager }  from './realtime/websocket-manager.ts'
  ├── import { TOPIC }             from '../infrastructure/realtime/stream-topics.ts'
  └── import { sseManager }        from '../infrastructure/events/sse/sse-manager.ts'
```

### server/chat/api/run.routes.ts → run-controller.ts

```
server/chat/api/run.routes.ts
  └── import { runController }     from '../controllers/run-controller.ts'
        ├── import { runManager }       from '../../orchestration/core/run-manager.ts'  ⚠ cross-layer
        ├── import { chatOrchestrator } from '../orchestration/chat-orchestrator.ts'
        ├── import { runStore }         from '../persistence/run-store.ts'
        └── import { ...schemas }       from '../schemas/run.schema.ts'
```

### server/chat/controllers/chat-controller.ts

```
server/chat/controllers/chat-controller.ts
  └── import { chatOrchestrator }  from '../orchestration/chat-orchestrator.ts'
```

### server/chat/orchestration/chat-orchestrator.ts

```
server/chat/orchestration/chat-orchestrator.ts
  ├── import { runManager }           from '../../orchestration/core/run-manager.ts'
  ├── import { conversationManager }  from './conversation-manager.ts'
  ├── import { sessionManager }       from './session-manager.ts'
  ├── import { turnManager }          from './turn-manager.ts'
  ├── import { streamManager }        from './stream-manager.ts'
  ├── import { messageBuilder }       from '../messages/message-builder.ts'
  ├── import { buildUserPayload }     from '../messages/user-message.ts'
  ├── import { buildAssistantPayload }from '../messages/assistant-message.ts'
  ├── import { buildBaseSystemPayload}from '../messages/system-message.ts'
  ├── import { clarificationManager } from '../questions/clarification-manager.ts'
  ├── import { contextLoader }        from '../context/context-loader.ts'
  ├── import { buildContext }         from '../context/context-builder.ts'
  ├── import { timelineManager }      from '../timeline/timeline-manager.ts'
  ├── import { runTimeline }          from '../timeline/run-timeline.ts'
  ├── import { eventPublisher }       from '../realtime/event-publisher.ts'
  └── import { make*Event }           from '../events/run.events.ts'
```

### server/orchestration/core/run-manager.ts (standalone — no imports)

```
run-manager.ts
  exports: RunRecord (interface), runManager (singleton)
  imports: NOTHING
  methods: register(), get(), setStatus(), clear(), activeRunIds(), size()
  NOTE: RunManager class is NOT exported — only the singleton instance is.
```

---

## 3. Actual Execution Graph

### Only reachable path from main.ts at runtime:

```
HTTP Request
    │
    ▼
Express app (main.ts)
    │
    ├── POST /api/chat/*
    │       ▼
    │   chatRouter (built by chatOrchestrator.buildChatRouter())
    │       ▼
    │   chat.routes.ts / run.routes.ts / etc.
    │       ▼
    │   controllers (chat-controller.ts, run-controller.ts, ...)
    │       ▼
    │   chatOrchestrator.startRun() / cancelRun() / completeRun() / failRun()
    │       ▼
    │   chat-orchestrator.ts
    │       ├── conversationManager.create/get()
    │       ├── runManager.register(runId, projectId)      ← only state registration
    │       ├── sessionManager.open()
    │       ├── turnManager.start()
    │       ├── messageBuilder.buildUser/System/Assistant()
    │       ├── clarificationManager.maybeAskClarification()
    │       ├── streamManager.open()
    │       ├── contextLoader.loadForRun()
    │       └── returns ChatRun { runId, projectId, ... }
    │
    │       ⚠ EXECUTION STOPS HERE. orchestrate() is NEVER called.
    │       ⚠ No agent is ever invoked.
    │       ⚠ No tool is ever dispatched.
    │
    └── GET /api/chat/stream (SSE)
            ▼
        buildSseRouter() → infraSseManager.register()
```

### DEAD PATH (unreachable):

```
[UNREACHABLE] orchestrate()
    │  ← no HTTP route reaches this. /api/orchestration was removed from main.ts.
    │  ← no internal caller outside server/orchestration/ calls this.
    ▼
orchestrator.ts
    ▼
validateRequest() → buildOrchestrationContext() → createSession() → initState()
    ▼
runOrchestrationLoop()
    ▼
buildExecutionPlan() → workflow-runner.ts
    ▼
runWorkflow() → phase-runner.ts
    ▼
runPhase() → dispatchPhaseToAgent() [agent-coordinator.ts]
    ▼
invokeAgent(agentType, ...) → switch(agentType)
    ▼
runBrowserAgent / runExecutorAgent / runPlannerCycle /
runFilesystemAgent / executeTerminalSession /
runSupervisorCycle / runVerification
    ▼
agent-internal execution loop → dispatcher-client.ts
    ▼
tool-dispatcher.ts dispatch()
    ▼
[EMPTY REGISTRY — loadAllTools() never called — NO tools registered]
```

---

## 4. Actual Agent Graph

| Agent | File | Imported by orchestration coordinator | Reachable from main.ts |
|-------|------|--------------------------------------|------------------------|
| browser | `server/agents/browser/browser-agent.ts` | ✅ `agent-coordinator.ts` line 19 | ❌ orchestration unreachable |
| executor | `server/agents/executor/executor-agent.ts` | ✅ `agent-coordinator.ts` line 20 | ❌ orchestration unreachable |
| filesystem | `server/agents/filesystem/filesystem-agent.ts` | ✅ `agent-coordinator.ts` line 21 | ❌ orchestration unreachable |
| planner | `server/agents/planner/planner-agent.ts` | ✅ `agent-coordinator.ts` line 22 | ❌ orchestration unreachable |
| supervisor | `server/agents/supervisor/supervisor-agent.ts` | ✅ `agent-coordinator.ts` line 23 | ❌ orchestration unreachable |
| terminal | `server/agents/terminal/terminal-agent.ts` | ✅ `agent-coordinator.ts` line 24 | ❌ orchestration unreachable |
| verifier | `server/agents/verifier/verifier-agent.ts` | ✅ `agent-coordinator.ts` line 25 | ❌ orchestration unreachable |
| **coderx** | `server/agents/coderx/coderx-agent.ts` | ❌ **NOT imported anywhere** | ❌ **ORPHANED** |

### Per-agent internal import chains (actual imports only):

**browser-agent.ts** imports:
- `./execution/browser-loop.ts`
- `./validation/state-validator.ts`
- `./validation/integrity-validator.ts`
- `./monitoring/failure-monitor.ts`
- `./telemetry/browser-metrics.ts`
- `./utils/browser-utils.ts`
- `./types/navigation.types.ts`

**executor-agent.ts** imports (top):
- `./types/executor.types.ts`
- `./core/executor-context.ts`
- `./core/executor-state.ts`
- `./planning/execution-planner.ts`
- `./execution/execution-loop.ts`
- `./validation/execution-validator.ts`
- `./telemetry/executor-logger.ts`
- `./telemetry/executor-metrics.ts`
- `./monitoring/failure-monitor.ts`
- `./monitoring/execution-monitor.ts`
- `./utils/execution-utils.ts`

**planner-agent.ts** imports:
- `./types/planner.types.ts`
- `./core/planner-context.ts`
- `./core/planner-session.ts`
- `./telemetry/planner-metrics.ts`
- `./telemetry/planner-logger.ts`
- `./monitoring/planning-monitor.ts`
- `./validation/planning-validator.ts`
- `./execution/planning-loop.ts`
- `./utils/planning-utils.ts`

**coderx-agent.ts** imports (self-contained — no external consumers):
- `./types/coderx.types.ts`
- `./core/coderx-context.ts`
- `./core/coderx-session.ts`
- `./core/coderx-state.ts`
- `./telemetry/coderx-logger.ts`
- `./telemetry/coderx-metrics.ts`
- *(30+ internal files — all orphaned)*

---

## 5. Actual Tool Graph

### Registration chain:

```
tool-loader.ts exports loadAllTools()
  │
  ├── registerFilesystemTools()  from ../filesystem/index.ts
  ├── registerTerminalTools()    from ../terminal/index.ts
  ├── registerVerifierTools()    from ../verifier/index.ts
  ├── registerBrowserTools()     from ../browser/index.ts
  └── registerCodingTools()      from ../coding/index.ts
        └── sealRegistry()

ACTUAL RUNTIME STATE: loadAllTools() is NEVER CALLED.
Registry contains 0 tools. Registry is NEVER sealed.
```

### Dispatch chain (wired but unreachable):

```
agent dispatcher-client.ts (per-agent, e.g. executor/coordination/dispatcher-client.ts)
    ▼
server/tools/registry/tool-dispatcher.ts
    ├── dispatch()         → resolveToolWithPermissions() → getTool() → handler()
    ├── dispatchAll()      → parallel dispatch()
    └── dispatchSequential()

server/orchestration/coordination/dispatcher-client.ts
    ├── executeTool()      → wraps tool-dispatcher.dispatch()
    ├── executeAll()       → wraps tool-dispatcher.dispatchAll()
    └── executeSequential()→ wraps tool-dispatcher.dispatchSequential()
```

### Tool category sizes (registered in code, NOT at runtime):

| Category | Registry file | Tool count (code-declared) |
|----------|--------------|---------------------------|
| filesystem | `register-filesystem-tools.ts` | declared |
| terminal | `register-terminal-tools.ts` | 23 (from prior boot log) |
| verifier | `register-verifier-tools.ts` | 28 (from prior boot log) |
| browser | `register-browser-tools.ts` | declared |
| coding | `register-coding-tools.ts` | 46 (from prior boot log) |
| **coderx** | none | **0 — no register file** |

---

## 6. Actual Runtime Lifecycle

```
STEP 1  HTTP request arrives at Express (main.ts, port 3001)

STEP 2  Routed to /api/chat/* via chatOrchestrator.buildChatRouter()

STEP 3  chat.routes.ts / run.routes.ts / etc. → controller

STEP 4  controller calls chatOrchestrator.startRun(payload)

STEP 5  chat-orchestrator.ts executes chat lifecycle:
          conversationManager.create()
          runManager.register(runId, projectId)   ← ONLY state tracking
          sessionManager.open()
          turnManager.start()
          messageBuilder.buildUser()
          eventPublisher.publish(run.started)
          messageBuilder.buildSystem()
          clarificationManager.maybeAskClarification()
          streamManager.open()
          contextLoader.loadForRun()
          buildContext()
          return ChatRun

STEP 6  ⛔ DEAD END. No code calls orchestrate() after startRun().
          The orchestration engine, agents, and tools are NEVER invoked.
          Tool registry has 0 tools.
          No agent ever runs.
```

---

## 7. Ownership Matrix

| Concern | Claimed owner | Actual runtime owner | Evidence |
|---------|--------------|----------------------|----------|
| Conversation lifecycle | chat-orchestrator.ts | chat-orchestrator.ts | ✅ active |
| Session lifecycle | chat-orchestrator.ts | chat-orchestrator.ts | ✅ active |
| Turn lifecycle | chat-orchestrator.ts | chat-orchestrator.ts | ✅ active |
| Stream lifecycle | chat-orchestrator.ts | chat-orchestrator.ts | ✅ active |
| Run state registry | run-manager.ts | run-manager.ts | ✅ active (register/get/setStatus) |
| Agent routing | agent-coordinator.ts | **nobody** | ❌ unreachable |
| Tool dispatch | tool-dispatcher.ts | **nobody** | ❌ unreachable, registry empty |
| Tool registration | tool-loader.ts | **nobody** | ❌ loadAllTools() never called |
| Orchestration loop | orchestration-loop.ts | **nobody** | ❌ orchestrate() never called |
| Retry (orchestration) | retry-manager.ts | **nobody** | ❌ unreachable |
| Recovery | recovery-coordinator.ts | **nobody** | ❌ unreachable |
| Escalation | escalation-manager.ts | **nobody** | ❌ unreachable |
| Telemetry (orchestration) | orchestration-metrics.ts | **nobody** | ❌ unreachable |
| CoderX execution | coderx-agent.ts | **nobody** | ❌ orphaned — never imported |

---

## 8. Circular Dependency Report

| Path | Circular? | Evidence |
|------|-----------|----------|
| main.ts → chat/index.ts → chat-orchestrator.ts → run-manager.ts | ✅ No circular | run-manager.ts imports nothing |
| run-controller.ts → chatOrchestrator + runManager | ✅ No circular | both are downstream |
| orchestration internal (orchestrator → loop → workflow → phase → agent-coordinator) | ✅ No circular | unidirectional chain |
| agent-coordinator.ts → agents → agent-internal dispatcher-client.ts → tool-dispatcher.ts | ✅ No circular | strictly downstream |
| tool-dispatcher.ts → tool-registry.ts | ✅ No circular | |
| tools/shared/string-utils.ts ← was coderx, moved explicitly | ✅ Resolved | comment in string-utils.ts confirms |

**No circular dependencies detected in active or dormant code.**

---

## 9. Orphaned File Report

### Fully orphaned — zero import path from main.ts:

| Orphaned module | Reason |
|----------------|--------|
| `server/agents/coderx/**` (30+ files) | Not imported in agent-coordinator.ts or anywhere external |
| `server/orchestration/**` (43 files) | orchestrate() never called; /api/orchestration removed from main.ts |
| `server/tools/**` (200+ files) | loadAllTools() never called; registry empty |
| `server/agents/browser/**` | agent-coordinator.ts reachable only via orchestration (dead) |
| `server/agents/executor/**` | same |
| `server/agents/planner/**` | same |
| `server/agents/filesystem/**` | same |
| `server/agents/terminal/**` | same |
| `server/agents/supervisor/**` | same |
| `server/agents/verifier/**` | same |

**Runtime reality: only `server/chat/**` and `server/orchestration/core/run-manager.ts` are active.**

---

## 10. Unreachable Code Report

| File | Function/Export | Reason unreachable |
|------|----------------|-------------------|
| `server/orchestration/index.ts` | `orchestrate()` | Not called from main.ts; HTTP route removed |
| `server/orchestration/index.ts` | `initOrchestration()` | Removed from main.ts bootstrap |
| `server/orchestration/index.ts` | `createOrchestrationRouter()` | Not mounted in main.ts |
| `server/orchestration/orchestrator.ts` | `orchestrate()` | Exported but never called from outside |
| `server/orchestration/execution/orchestration-loop.ts` | `runOrchestrationLoop()` | Called only from orchestrate() |
| `server/orchestration/execution/workflow-runner.ts` | `runWorkflow()` | Called only from orchestration-loop |
| `server/orchestration/execution/phase-runner.ts` | `runPhase()` | Called only from workflow-runner |
| `server/orchestration/coordination/agent-coordinator.ts` | `dispatchPhaseToAgent()` | Called only from phase-runner |
| `server/orchestration/coordination/agent-coordinator.ts` | `invokeAgent()` | Called only from dispatchPhaseToAgent |
| `server/tools/registry/tool-loader.ts` | `loadAllTools()` | Removed from main.ts, called nowhere |
| `server/tools/registry/tool-dispatcher.ts` | `dispatch()` | Only reachable via agents (dead) |
| `server/tools/registry/tool-registry.ts` | `registerTool()` | loadAllTools() never called |
| `server/agents/coderx/coderx-agent.ts` | all exports | No importer exists anywhere |

---

## 11. Layer Violation Report

| Violation | File | Evidence |
|-----------|------|----------|
| ⚠ Controller imports orchestration layer directly | `server/chat/controllers/run-controller.ts:8` | `import { runManager } from '../../orchestration/core/run-manager.ts'` — controller crosses into orchestration |
| ⚠ agent-coordinator.ts has unclosed JSDoc block | `server/orchestration/coordination/agent-coordinator.ts:1-18` | `/**` opens line 1, `* FORBIDDEN at this ` line 17 has no `*/` close; blank line 18; imports begin line 19 inside open comment |

**No Tool→Agent, Tool→Controller, Agent→Route, Agent→Controller violations found in active code.**

---

## 12. Shadow Orchestration Report

**No shadow orchestration detected.**

There is only ONE orchestration engine (`server/orchestration/orchestrator.ts`), but it is unreachable.
There is only ONE chat-orchestrator (`server/chat/orchestration/chat-orchestrator.ts`), and it handles ONLY chat lifecycle — it does not shadow execution.

The three "agent-coordinator" files serve DIFFERENT roles:
- `server/orchestration/coordination/agent-coordinator.ts` — routes phases to agents (orchestration layer)
- `server/agents/planner/coordination/agent-coordinator.ts` — internal planner task coordinator (`buildCoordinatorTasks`, `runCoordinatorTasks`)
- `server/agents/supervisor/coordination/agent-coordinator.ts` — internal supervisor sub-agent dispatcher (`coordinateAgent`, `coordinatePlanning`, etc.)

Same naming pattern, different responsibilities — **naming confusion, not shadow orchestration**.

---

## 13. Dual Execution Path Report

**Evidence: There is ONE defined execution chain, currently fully disconnected from the entry point.**

```
ACTIVE PATH (only):
  HTTP → chat module → chatOrchestrator.startRun() → chat lifecycle → STOP

DEAD PATH (defined, wired, 0 runtime reach):
  orchestrate() → loop → workflow → phase → agent-coordinator → agents → tools
```

No dual active execution chains. The problem is the opposite: **zero execution chains reach agents or tools**.

---

## 14. Registry Report

| Registry | File | Sealed at runtime | Tool count at runtime | Who calls seal |
|----------|------|------------------|----------------------|----------------|
| Tool Registry | `server/tools/registry/tool-registry.ts` | ❌ NO | **0** | `sealRegistry()` in tool-loader.ts — never called |

`sealRegistry()` is called only inside `loadAllTools()`, which is called by nobody.

Any call to `registerTool()` after boot would succeed (registry not sealed) but no code does this at runtime.

---

## 15. Dispatcher Report

| Dispatcher | File | Callers at runtime | Purpose |
|-----------|------|-------------------|---------|
| `tool-dispatcher.ts` `dispatch()` | `server/tools/registry/tool-dispatcher.ts` | **NONE** at runtime | Executes tool handler with timeout + retry + metrics |
| `orchestration/coordination/dispatcher-client.ts` `executeTool()` | `server/orchestration/coordination/dispatcher-client.ts` | **NONE** (orchestration dead) | Wraps tool-dispatcher for orchestration layer |
| Per-agent `coordination/dispatcher-client.ts` (×6 agents) | Each agent's `coordination/` folder | **NONE** (agents dead) | Each agent's gateway to tool-dispatcher |

---

## 16. Discipline Scorecard

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Module boundaries | 72/100 | Clean separation chat/orchestration/tools/agents — but controller crosses into orchestration (run-controller.ts:8) |
| Import discipline | 78/100 | No circular deps; one cross-layer import (controller→runManager); agent-coordinator imports correctly |
| Registry purity | 40/100 | Registry is correct design but 0 tools registered at runtime; never sealed |
| Dispatcher purity | 80/100 | Single dispatcher, correct chain — but never executed |
| Agent ownership | 55/100 | 7 agents correctly imported in coordinator; coderx fully orphaned; all agents unreachable |
| Tool ownership | 30/100 | Tools exist, categorized, wired — but none registered at runtime; coderx has no registration file |
| Lifecycle ownership | 65/100 | Chat lifecycle fully owned; orchestration lifecycle complete but disconnected |
| Retry ownership | 60/100 | Retry in tool-dispatcher (active design), retry-manager in orchestration (dead), per-agent retry-manager (dead) — 3 retry owners, none active |
| Recovery ownership | 20/100 | recovery-coordinator.ts exists; never initialized; never called |
| Telemetry ownership | 45/100 | orchestration-metrics, orchestration-logger, per-agent telemetry all exist; none active at runtime |
| Execution ownership | 15/100 | chatOrchestrator owns chat lifecycle only; execution never reaches agents; effective execution ownership = chat-only |

**Overall System Discipline: 51/100**

Primary cause of low score: the main.ts refactor severed the connection between the chat layer and the orchestration+agent+tool layers. The systems are internally consistent but the runtime entry point connects to only ~5% of the codebase.

---

## 17. Top 25 Architecture Risks

| # | Risk | Severity | File(s) |
|---|------|----------|---------|
| 1 | `loadAllTools()` never called — tool registry empty at runtime | CRITICAL | `main.ts`, `tool-loader.ts` |
| 2 | `orchestrate()` never called — no agent ever executes | CRITICAL | `main.ts`, `orchestration/index.ts` |
| 3 | chatOrchestrator.startRun() returns a ChatRun but nobody calls orchestrate() with the runId | CRITICAL | `chat-orchestrator.ts` |
| 4 | CoderX agent (30+ files) fully orphaned — no import path exists | HIGH | `server/agents/coderx/**` |
| 5 | agent-coordinator.ts has unclosed JSDoc block (`/**` never closed with `*/`) | HIGH | `agent-coordinator.ts:1-18` |
| 6 | Tool registry is never sealed — `sealRegistry()` guarded by `loadAllTools()` only | HIGH | `tool-registry.ts`, `tool-loader.ts` |
| 7 | 200+ tool files (filesystem, terminal, verifier, browser, coding) unreachable at runtime | HIGH | `server/tools/**` |
| 8 | All 7 agent modules (browser, executor, planner, etc.) unreachable at runtime | HIGH | `server/agents/**` |
| 9 | `run-controller.ts` imports `runManager` directly from orchestration layer | MEDIUM | `run-controller.ts:8` |
| 10 | 3 files named "agent-coordinator.ts" with different ownership — naming collision risk | MEDIUM | `orchestration/`, `agents/planner/`, `agents/supervisor/` |
| 11 | Recovery system (`recovery-coordinator.ts`, `escalation-manager.ts`) completely uninitialized | MEDIUM | `server/orchestration/lifecycle/**` |
| 12 | Per-agent retry-managers (6 files) duplicate retry logic in tool-dispatcher | MEDIUM | `*/execution/retry-manager.ts` |
| 13 | orchestration/index.ts still exports `orchestrate`, `initOrchestration`, `createOrchestrationRouter` — all dead | MEDIUM | `orchestration/index.ts` |
| 14 | CoderX has no `register-coding-tools.ts` equivalent — never had a registration path | MEDIUM | `server/agents/coderx/` |
| 15 | `chat-orchestrator.ts` comment "Return runId for orchestration engine to consume" — but no consumer exists | MEDIUM | `chat-orchestrator.ts:57` |
| 16 | Planner/executor agent boot (initializePlanner, initializeExecutor) removed from main.ts | MEDIUM | `main.ts`, `planner-agent.ts`, `executor-agent.ts` |
| 17 | `server/orchestration/distributed/**` (3 files: multi-run-recovery, parallel-fabric, run-scoped-orchestrator) — isolated, no callers | LOW-MEDIUM | `server/orchestration/distributed/**` |
| 18 | `server/orchestration/swarm/intent-graph/**` exists with types but no callers | LOW | `server/orchestration/swarm/**` |
| 19 | Per-agent `dispatcher-client.ts` files (6 agents × 1 each) — duplicate wrappers around tool-dispatcher | LOW | `*/coordination/dispatcher-client.ts` |
| 20 | `server/orchestration/agents/verification-bridge.ts` — exists but not verified as reachable | LOW | `verification-bridge.ts` |
| 21 | `server/orchestration/distributed/run-scoped-orchestrator.ts` — second orchestrator variant, no callers | LOW | `run-scoped-orchestrator.ts` |
| 22 | Chat module realtime: `connection-registry.ts`, `sse-manager.ts` — unclear if wired vs infraSseManager | LOW | `server/chat/realtime/**` |
| 23 | `server/chat/run/registry.ts` — separate run registry within chat module; relationship to run-manager unclear without reading | LOW | `server/chat/run/registry.ts` |
| 24 | 43 orchestration files will never compile-error because tsx skips type-checking — issues invisible until build | LOW | `server/orchestration/**` |
| 25 | agent-coordinator.ts AGENT_TYPES array lists 7 types but switch has 7 cases — coderx absent from both consistently | INFO | `agent-coordinator.ts:179-191` |

---

## 18. Top 25 Missing Links

| # | Missing Link | Where gap exists |
|---|-------------|-----------------|
| 1 | `chat-orchestrator.startRun()` → `orchestrate()` call with returned runId | Between chat and orchestration layer |
| 2 | `main.ts` → `loadAllTools()` | Bootstrap |
| 3 | `main.ts` → `initOrchestration()` | Bootstrap |
| 4 | `main.ts` → `createOrchestrationRouter()` mount | Bootstrap |
| 5 | `agent-coordinator.ts` → `runCoderXAgent()` | CoderX never wired |
| 6 | CoderX → tool registration (`register-coderx-tools.ts`) | Does not exist |
| 7 | `agent-coordinator.ts` unclosed `*/` | Comment syntax |
| 8 | `chatOrchestrator.startRun()` result → anything that uses runId to trigger orchestration | Missing bridge |
| 9 | `main.ts` → `initializePlanner()` | Planner event handler never registered |
| 10 | `main.ts` → `initializeExecutor()` | Executor event handler never registered |
| 11 | `main.ts` → `initBrowserBusBridge()` | Browser bus never bridged |
| 12 | `main.ts` → `startRecoveryManager()` | Recovery never started |
| 13 | `main.ts` → `observationController.start()` | Runtime observation never started |
| 14 | `main.ts` → `runtimeManager.init()` | Runtime manager never initialized |
| 15 | `main.ts` → `startReflectionEngine()` | Reflection engine never started |
| 16 | `main.ts` → `wireCoordinationSSE()` | Coordination SSE never wired |
| 17 | `run-controller.ts` → should use service layer, not import runManager directly | Architecture gap |
| 18 | CoderX `AgentType` variant in `orchestration.types.ts` (if missing) | CoderX type registration |
| 19 | `chatOrchestrator.completeRun()` caller — who calls this after agent finishes? | No caller exists |
| 20 | `chatOrchestrator.failRun()` caller — who calls this on agent failure? | No caller exists |
| 21 | `server/orchestration/distributed/parallel-orchestration-fabric.ts` → callers | Parallel fabric exists but uncalled |
| 22 | `server/orchestration/agents/verification-bridge.ts` → callers | Bridge exists but uncalled |
| 23 | CoderX memory system (`working-memory.ts`, `execution-history.ts`) → no consumer | All orphaned |
| 24 | `server/chat/run/registry.ts` → relationship to `run-manager.ts` | Dual run state tracking |
| 25 | `main.ts` → `startPortSweeper()` | Port authority never sweeping |

---

## 19. Top 25 Fix Recommendations

| # | Fix | Priority | Files |
|---|-----|----------|-------|
| 1 | Add `loadAllTools()` call back to main.ts bootstrap | CRITICAL | `main.ts` |
| 2 | Add `initOrchestration()` call back to main.ts bootstrap | CRITICAL | `main.ts` |
| 3 | Mount `createOrchestrationRouter()` in main.ts | CRITICAL | `main.ts` |
| 4 | Wire `chat-orchestrator.startRun()` result → `orchestrate()` call (runId bridge) | CRITICAL | `chat-orchestrator.ts` or a new bridge file |
| 5 | Wire `chatOrchestrator.completeRun()` and `failRun()` as callbacks from orchestration result | CRITICAL | `chat-orchestrator.ts` |
| 6 | Close unclosed JSDoc in `agent-coordinator.ts` — add `*/` after line 17 | HIGH | `server/orchestration/coordination/agent-coordinator.ts` |
| 7 | Add `'coderx'` case to `agent-coordinator.ts` switch OR delete CoderX entirely | HIGH | `agent-coordinator.ts`, `server/agents/coderx/**` |
| 8 | Add `runCoderXAgent` import and AgentType variant for coderx if keeping it | HIGH | `agent-coordinator.ts`, `orchestration.types.ts` |
| 9 | Add `initializePlanner()` and `initializeExecutor()` back to main.ts | HIGH | `main.ts` |
| 10 | Add `initBrowserBusBridge()` back to main.ts | MEDIUM | `main.ts` |
| 11 | Add `startRecoveryManager()` back to main.ts | MEDIUM | `main.ts` |
| 12 | Add `runtimeManager.init()` back to main.ts | MEDIUM | `main.ts` |
| 13 | Add `observationController.start()` back to main.ts | MEDIUM | `main.ts` |
| 14 | Add `startReflectionEngine()` back to main.ts | MEDIUM | `main.ts` |
| 15 | Move `runManager` import out of `run-controller.ts` — route through a service layer | MEDIUM | `run-controller.ts` |
| 16 | Rename agent-internal coordinator files to reduce collision with orchestration coordinator | MEDIUM | `agents/planner/coordination/`, `agents/supervisor/coordination/` |
| 17 | Create `register-coderx-tools.ts` if CoderX is to be kept | MEDIUM | new file |
| 18 | Add CoderX to `loadAllTools()` sequence if keeping | MEDIUM | `tool-loader.ts` |
| 19 | Consolidate 3 per-agent retry-manager files + tool-dispatcher retry → single retry policy | LOW | `*/execution/retry-manager.ts` |
| 20 | Add `startPortSweeper()` back to main.ts | LOW | `main.ts` |
| 21 | Add `wireCoordinationSSE()` back to main.ts | LOW | `main.ts` |
| 22 | Add `contextRegistry.startSweeper()` back to main.ts | LOW | `main.ts` |
| 23 | Audit `server/chat/run/registry.ts` vs `run-manager.ts` — determine if dual state is intentional | LOW | `chat/run/registry.ts` |
| 24 | Audit `server/orchestration/distributed/**` — wire or delete | LOW | `orchestration/distributed/**` |
| 25 | Add TypeScript build step (not just tsx transpile) to surface type errors in 43 dead orchestration files | LOW | CI / build pipeline |
