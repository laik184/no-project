# NURA-X — SYSTEM LIFECYCLE FLOW

---

## CURRENT LIFECYCLE FLOW (As-Is)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                          USER REQUEST LIFECYCLE                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  USER
   │  submits goal via Chat
   ▼
┌─────────────────────────────────┐
│       chatOrchestrator          │  WebSocket / HTTP
│       (chat/index.ts)           │
└───────────────┬─────────────────┘
                │ fires bus event
                ▼
┌─────────────────────────────────┐
│         orchestrator.ts         │  ORCHESTRATION LAYER
│                                 │
│  1. validate request            │
│  2. buildOrchestrationContext   │
│  3. createSession               │
│  4. runOrchestrationLoop()      │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│      orchestration-loop.ts      │
│                                 │
│  1. buildExecutionPlan          │
│  2. orderWorkflows              │
│  3. FOR each workflow:          │
│       runWorkflow()             │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│       workflow-runner.ts        │
│                                 │
│  FOR each phase:                │
│    runPhase()                   │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│         phase-runner.ts         │
│                                 │
│  publishPhaseStarted            │
│  dispatchPhaseToAgent()   ──────┼──┐
│  publishPhaseCompleted          │  │
└─────────────────────────────────┘  │
                                     │ switch(agentType)
          ┌──────────────────────────┴──────────────────────────────────────────┐
          │                                                                     │
          ▼  PLANNER                    EXECUTOR         FILESYSTEM   BROWSER   │
┌──────────────────┐         ┌─────────────────┐     (similar)    (special)    │
│  planner-agent   │         │  executor-agent  │                               │
│                  │         │                  │                               │
│ 1. validateInput │         │ 1. validateInput │                               │
│ 2. buildContext  │         │ 2. buildContext   │                               │
│ 3. planningLoop  │         │ 3. planExecution  │                               │
│    → AI analysis │         │ 4. runExecution   │                               │
│    → ExecutionPlan│        │    Loop()         │                               │
└────────┬─────────┘         └────────┬──────────┘                              │
         │                            │                                          │
         │ returns plan               ▼                                          │
         │                  ┌──────────────────────┐                            │
         │                  │  execution-loop.ts    │                            │
         │                  │                       │                            │
         │                  │  FOR each task:       │                            │
         │                  │    executeTask()      │                            │
         │                  └──────────┬────────────┘                            │
         │                             │                                          │
         │                             ▼                                          │
         │                  ┌──────────────────────┐                            │
         │                  │   task-executor.ts    │                            │
         │                  │                       │                            │
         │                  │  coordinateTask()     │  ← maps task.kind → tool  │
         │                  │  registerStep()       │                            │
         │                  │  runStep()     ───────┼──┐                         │
         │                  └──────────────────────┘  │                         │
         │                                             │                         │
         │                             ┌───────────────┘                         │
         │                             ▼                                          │
         │                  ┌──────────────────────┐                            │
         │                  │    step-runner.ts     │  ✅ FIXED                  │
         │                  │                       │                            │
         │                  │  assertTransition()   │                            │
         │                  │  markRunning()        │                            │
         │                  │  withRetry(           │                            │
         │                  │    execute()  ────────┼──┐                         │
         │                  │  )                    │  │                         │
         │                  └──────────────────────┘  │                         │
         │                                             │                         │
         │                             ┌───────────────┘                         │
         │                             ▼                                          │
         │                  ┌──────────────────────┐                            │
         │                  │  dispatcher-client.ts │  AGENT GATEWAY ✅           │
         │                  │  execute(name, in, ctx│                            │
         │                  │    → dispatch()       │                            │
         │                  └──────────┬────────────┘                            │
         │                             │                                          │
         │                      ┌──────┘                                          │
         │                      ▼                                                  │
         │           ┌────────────────────────┐                                  │
         │           │    tool-dispatcher.ts   │  CENTRAL DISPATCHER ✅           │
         │           │                         │                                  │
         │           │  resolvePermissions()   │                                  │
         │           │  withTimeout()          │                                  │
         │           │  withRetry()            │                                  │
         │           │  recordMetric()         │                                  │
         │           │  recordAudit()          │                                  │
         │           └──────────┬──────────────┘                                  │
         │                      │                                                  │
         │                      ▼                                                  │
         │           ┌────────────────────────┐                                  │
         │           │    tool-registry.ts     │  REGISTRY ✅                     │
         │           │    getTool(name)        │                                  │
         │           └──────────┬──────────────┘                                  │
         │                      │                                                  │
         │                      ▼                                                  │
         │           ┌────────────────────────┐                                  │
         │           │    tool.handler()       │  PRIMITIVE EXECUTION ✅          │
         │           │  (filesystem/terminal/  │                                  │
         │           │   browser/coding/verify)│                                  │
         │           └────────────────────────┘                                  │
         │                                                                         │
         └──────────────── BROWSER AGENT (SPECIAL CASE) ──────────────────────────┘

  BROWSER AGENT — CURRENT (BROKEN) LIFECYCLE:
  ┌───────────────────────────────────────────────────────┐
  │  browser-loop.ts                                       │
  │                                                        │
  │  launchBrowser() ◄── tools/browser/session/  ❌ BYPASS│
  │       │             browser-lifecycle.ts               │
  │       ▼                                                │
  │  executeFlow()                                         │
  │       │                                                │
  │       ▼                                                │
  │  step-runner → dispatcher-client ✅                    │
  │       │                                                │
  │       ▼                                                │
  │  closeBrowser() ◄── tools/browser/session/  ❌ BYPASS │
  │                     browser-lifecycle.ts               │
  └───────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════
  CURRENT VIOLATIONS IN EXECUTION CHAINS:
══════════════════════════════════════════════════════════════

  EXECUTOR (FIXED ✅):
  step-runner ──► dispatcher-client ──► tool-dispatcher ──► tool

  CODERX (BYPASS ⚠):
  step-runner ──► coding-routing ──► dispatcher-client ──► tool-dispatcher

  TERMINAL (OVER-LAYERED ⚠):
  step-runner ──► execution-routing ──► tool-coordinator ──► dispatcher-client ──► tool-dispatcher

  VERIFIER (OVER-LAYERED ⚠):
  step-runner ──► verification-routing ──► tool-coordinator ──► dispatcher-client ──► tool-dispatcher

  FILESYSTEM (ACCEPTABLE ✓):
  step-runner ──► fs-routing ──► operation-handlers ──► dispatcher-client ──► tool-dispatcher

══════════════════════════════════════════════════════════════════════════════════════
```

---

## IDEAL LIFECYCLE FLOW (To-Be)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                     IDEAL TARGET LIFECYCLE FLOW                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  USER
   │
   ▼
┌────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                          │
│                                                                 │
│  orchestrator → orchestration-loop → workflow-runner            │
│      → phase-runner → agent-coordinator                         │
│                                                                 │
│  Owns: workflow sequencing, phase ordering, agent selection     │
│  Forbidden: tool execution, session management, primitives      │
└─────────────────────────────┬───────────────────────────────────┘
                              │ dispatch to agent
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER                                │
│  (executor / browser / coderx / terminal / verifier /          │
│   filesystem / planner / supervisor)                            │
│                                                                 │
│  agent.ts → loop.ts → step-runner.ts                            │
│                                                                 │
│  Owns: workflow execution, context, session, state, planning    │
│  Forbidden: tool-registry access, direct tool imports           │
└─────────────────────────────┬───────────────────────────────────┘
                              │ executeTool(name, input, ctx)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│               DISPATCHER CLIENT (per-agent gateway)             │
│                                                                 │
│  Thin pass-through only:                                        │
│    buildToolContext(agentCtx) → dispatch(name, input, toolCtx)  │
│                                                                 │
│  Owns: context normalization, forwarding                        │
│  Forbidden: telemetry, retry logic, timeout management          │
└─────────────────────────────┬───────────────────────────────────┘
                              │ dispatch(name, input, context)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                   TOOL DISPATCHER (central)                     │
│                                                                 │
│  1. resolveToolWithPermissions(name, context)                   │
│  2. withTimeout(handler, timeoutMs)                             │
│  3. withRetry(fn, retryPolicy)                                  │
│  4. recordMetric(name, ok, durationMs)                          │
│  5. recordAudit(name, runId, ok, errorCode)                     │
│                                                                 │
│  Owns: timeout, retry, metrics, audit, permission checks        │
│  Forbidden: agent knowledge, orchestration, planning            │
└─────────────────────────────┬───────────────────────────────────┘
                              │ getTool(name)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     TOOL REGISTRY                               │
│                                                                 │
│  Sealed at boot (168 tools registered, then locked)            │
│  Pure lookup: name → ToolDefinition                             │
│                                                                 │
│  Owns: registration, lookup, sealing                            │
│  Forbidden: execution, dispatch, retry, agents                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ tool.handler(input, context)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       TOOL                                      │
│  (filesystem / terminal / browser / coding / verifier)          │
│                                                                 │
│  Pure primitive execution only                                  │
│  Returns typed result                                           │
│                                                                 │
│  Owns: primitive execution                                      │
│  Forbidden: agents, orchestration, dispatch control             │
└────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════
  IDEAL EXECUTION CHAIN (ALL agents, uniform):
══════════════════════════════════════════════════════════════

  agent.ts
    └─► loop.ts
          └─► step-runner.ts
                └─► dispatcher-client.ts::executeTool()
                      └─► tool-dispatcher.ts::dispatch()
                            └─► tool-registry.ts::getTool()
                                  └─► tool.handler()

  NO intermediate routing layers between step-runner and dispatcher-client
  NO direct tool imports in any agent file
  NO telemetry inside dispatcher-client (tool-dispatcher owns it)
  NO duplicate retry (agent retry = workflow-level; tool retry = execution-level)

══════════════════════════════════════════════════════════════
  BOOT SEQUENCE (Ideal = Current ✅):
══════════════════════════════════════════════════════════════

  main.ts starts
    │
    ├─ 1. express + middleware
    ├─ 2. runtimeManager.init()
    ├─ 3. various managers (recovery, orchestration, events)
    ├─ 4. loadAllTools()  ← registers all 168 tools
    │       registerFilesystemTools()  → 46 tools
    │       registerTerminalTools()    → 23 tools
    │       registerVerifierTools()    → 28 tools
    │       registerBrowserTools()     → ? tools
    │       registerCodingTools()      → ? tools
    │       sealRegistry()             ← LOCKED — no more registrations
    │
    ├─ 5. initializePlanner()   ← only registers event handlers
    └─ 6. initializeExecutor()  ← only registers event handlers

  Tools are always available when agents first execute ✅
  Late registration impossible after seal ✅

══════════════════════════════════════════════════════════════
  TELEMETRY OWNERSHIP (Ideal):
══════════════════════════════════════════════════════════════

  Per tool call, exactly ONE record:
    tool-dispatcher.ts → recordMetric(name, ok, durationMs)
    tool-dispatcher.ts → recordAudit(name, runId, ok, errorCode)

  Agent loggers record WORKFLOW events (session start/end, phase, retry decision)
  Tool dispatcher records EXECUTION events (tool call result, latency, error)
  These are separate concerns — not duplicated

══════════════════════════════════════════════════════════════
  RETRY OWNERSHIP (Ideal):
══════════════════════════════════════════════════════════════

  Tool-level retry (tool-dispatcher):
    - Handles transient failures (network, timeout)
    - Fast, tight: 2-3 attempts, exponential backoff
    - Scoped to a single tool execution

  Agent-level retry (step-runner / retry-manager):
    - Handles step-level failure after tool exhausts retries
    - Slower, broader: re-routes, re-plans if needed
    - Scoped to a workflow step

  These MUST NOT compound:
    If tool-dispatcher retries=2 and agent retries=3
    → disable one OR ensure tool retries=1 (no retry inside dispatcher)

══════════════════════════════════════════════════════════════
```

---

## DELTA: Current vs Ideal

```
Feature                     Current                  Ideal
──────────────────────────────────────────────────────────────────────
Executor step→dispatch      ✅ Direct (fixed)         ✅ Same
CoderX step→dispatch        ⚠ Via coding-routing      Direct
Terminal step→dispatch      ⚠ 3-hop chain             Direct
Verifier step→dispatch      ⚠ 3-hop chain             Direct
Filesystem step→dispatch    ✅ Via operations (ok)     Same
Browser session lifecycle   ❌ Direct tool import      Via dispatcher
Browser tool execution      ✅ Via dispatcher          Same
Dispatcher-client telemetry ⚠ In 4 agents (duplicate) Removed
Retry compounding           ⚠ Both layers active       Single scope
API naming consistency      ⚠ 4 different names        executeTool()
Agent types ← tool types    ❌ verifier imports tool    Shared types only
Engine layer coupling        ⚠ planner imports engine   Clean boundary
Orphaned files              ⚠ execution-routing.ts     Deleted
Boot sequence               ✅ Correct                  Same
Registry sealing            ✅ Correct                  Same
Overall score               60%                        ~90% (post-fixes)
```
