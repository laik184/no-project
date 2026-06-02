# Architecture Ownership & Refactor Analysis
## HVP Blueprint — Agentic Vibe Coder AI

---

---

# PHASE 11 — ARCHITECTURE OWNERSHIP ANALYSIS

---

## Ownership Matrix

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: main.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : Application bootstrap — no business logic
Can Import   : server/chat, server/orchestration, server/infrastructure,
               server/file-explorer, server/console, server/preview
Cannot Import: server/agents, server/tools, server/memory (indirectly only)
Can Call     : .mountRoutes(), .bootstrap(), initOrchestration(),
               seedDefaultProject(), server.listen()
Cannot Call  : Any agent directly, any tool directly, any LLM client
Reason       : main.ts is pure wiring. It composes modules but owns none.
               If it calls tools/agents it collapses all layer separation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/chat/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : HTTP interface — user-facing request/response lifecycle
Can Import   : server/orchestration (to trigger), server/infrastructure
               (bus, SSE), server/memory, server/agents/chat ONLY
Cannot Import: server/agents/* (except chat), server/tools/*
Can Call     : orchestrate(), runChatAgent(), sseManager, bus.emit()
Cannot Call  : Individual tools, individual non-chat agents, DB directly
Reason       : Chat owns the user-facing contract. It delegates complexity
               downward. Importing arbitrary agents couples UI to execution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/orchestration/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : Execution engine — multi-agent workflow coordination
Can Import   : server/agents/*, server/tools/registry (dispatcher only),
               server/infrastructure, server/memory
Cannot Import: server/chat/* (CRITICAL — would create a cycle)
Can Call     : Agent entry points, tool-dispatcher, bus.emit(), memoryEngine
Cannot Call  : SSE directly, Express res/req, user-facing stream
Reason       : Orchestration must be chat-agnostic. All feedback flows UP
               via the event bus, never via direct chat imports.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/agents/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : Specialized workers — execute tasks within a single domain
Can Import   : server/tools/registry (dispatcher-client), server/memory,
               server/infrastructure/events (bus only)
Cannot Import: server/orchestration/*, server/chat/*
Can Call     : tool-dispatcher.dispatch(), bus.emit(), memoryEngine.store()
Cannot Call  : orchestrate(), chatOrchestrator, any HTTP layer
Reason       : Agents are leaf workers. Re-entering orchestration from an
               agent creates unbounded recursion. Chat import creates a cycle.

⚠️  CURRENT VIOLATION: server/agents/chat/chat-agent.ts imports
    server/chat/orchestration/stream-manager.ts
    → Agent imports from Chat — direction is INVERTED.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/tools/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : Atomic execution — single, validated side-effecting operations
Can Import   : Node.js built-ins (fs, path, child_process), server/infrastructure
               (DB for metadata only), server/shared
Cannot Import: server/orchestration/*, server/agents/*, server/chat/*
Can Call     : Filesystem, shell, browser (Playwright), DB repositories
Cannot Call  : orchestrate(), any agent, any chat/stream function
Reason       : Tools are the lowest execution leaf. Any upward import
               creates circular dependency or re-entrant orchestration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/infrastructure/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : System foundation — DB, event bus, SSE, process management
Can Import   : External libs only (drizzle-orm, pg, EventEmitter, express)
               shared/schema
Cannot Import: ANY server/* layer (must be imported, never import up)
Can Call     : PostgreSQL, Node.js internals
Cannot Call  : Any business logic, any agent, any tool, any chat function
Reason       : Infrastructure is a pure dependency. Importing any domain
               layer creates circular graphs that make testing impossible.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYER: server/memory/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner        : Cross-cutting — long-term context storage and retrieval
Can Import   : server/infrastructure (DB only)
Cannot Import: server/chat, server/orchestration, server/agents, server/tools
Can Call     : DB reads/writes, in-memory stores
Cannot Call  : Anything that could trigger execution
Reason       : Memory is a shared utility. Importing execution layers
               would give it the ability to trigger actions — wrong.
```

---

---

# PHASE 12 — IMPORT DIRECTION ANALYSIS

---

## Complete Import Tree

```
main.ts
├── server/chat/index.ts              (chatOrchestrator.mountRoutes, bootstrap)
│   ├── orchestration/chat-orchestrator.ts
│   │   ├── server/orchestration/index.ts  ← VALID (chat → orchestration ✅)
│   │   │   └── orchestration/orchestrator.ts
│   │   │       ├── orchestration/core/*
│   │   │       ├── orchestration/execution/orchestration-loop.ts
│   │   │       │   └── orchestration/coordination/dispatcher-client.ts
│   │   │       │       └── tools/registry/tool-dispatcher.ts  ✅
│   │   │       │           ├── tools/filesystem/*
│   │   │       │           ├── tools/terminal/*
│   │   │       │           ├── tools/browser/*
│   │   │       │           ├── tools/coding/*
│   │   │       │           └── tools/verifier/*
│   │   │       └── orchestration/agents/ (agent-coordinator)
│   │   │           ├── agents/coderx/index.ts
│   │   │           ├── agents/executor/index.ts
│   │   │           ├── agents/planner/index.ts
│   │   │           ├── agents/browser/index.ts
│   │   │           ├── agents/filesystem/index.ts
│   │   │           ├── agents/terminal/index.ts
│   │   │           ├── agents/supervisor/index.ts
│   │   │           └── agents/verifier/index.ts
│   │   │               └── [each agent] → tools/registry/tool-dispatcher.ts ✅
│   │   └── agents/chat/chat-agent.ts
│   │       └── ⚠️  chat/orchestration/stream-manager.ts  ← INVERTED IMPORT
│   ├── chat/llm/chat-responder.ts
│   │   ├── shared/llm-client.ts  ✅
│   │   └── orchestration/types/orchestration.types.ts ✅ (type only)
│   ├── chat/persistence/*        → infrastructure/db ✅
│   └── chat/realtime/*           → infrastructure/events/bus.ts ✅
│
├── server/orchestration/index.ts     (createOrchestrationRouter)  ✅
├── server/console/index.ts           ✅
├── server/preview/index.ts           ✅
├── server/projects/projects.router.ts ✅
├── server/file-explorer/index.ts     ✅
└── server/infrastructure/index.ts    (sseManager, bus, db) ✅
```

## Import Classification

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALID IMPORTS ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  main.ts            → server/chat, server/orchestration, server/infrastructure
  server/chat        → server/orchestration (triggers runs)
  server/chat        → server/infrastructure (bus, SSE, db)
  server/chat        → server/memory
  server/orchestration → server/agents (coordinates them)
  server/orchestration → server/tools/registry (dispatcher only)
  server/agents      → server/tools/registry (dispatcher-client)
  server/agents      → server/memory
  server/agents      → server/infrastructure/events (bus emit)
  server/tools       → Node.js built-ins, server/infrastructure/db

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVALID IMPORTS ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  server/agents/chat/chat-agent.ts
    → server/chat/orchestration/stream-manager.ts
    PROBLEM : Agent (lower layer) imports Chat (upper layer).
    DIRECTION: Should flow DOWN, not UP.
    FIX      : stream-manager should be passed as a callback/interface,
               OR the chat-agent should emit bus events instead of
               directly controlling the stream.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DANGEROUS IMPORTS ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  server/chat/persistence/checkpoint-store.ts → child_process.execFile
    PROBLEM: HTTP-layer file owns direct shell execution.
    FIX    : Move to server/tools/terminal or server/infrastructure.

  server/agents/browser/core/browser-session.ts → playwright (direct)
    PROBLEM: Playwright init failure crashes the entire agent layer on import.
    FIX    : Lazy-initialize playwright inside tool execution,
             not at module load.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CIRCULAR IMPORTS — CURRENT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  server/chat ↔ server/orchestration
    CURRENTLY SAFE : orchestration never imports chat.
    RISK           : Any future dev adding a chat import to orchestration
                     breaks the entire system. No architectural guard prevents it.

  server/agents/chat ↔ server/chat
    CURRENTLY REAL : chat-agent.ts imports stream-manager.ts from chat.
    This is a live circular risk: Chat → chat-agent → Chat.
    STATUS         : 🚨 Active structural cycle.
```

---

---

# PHASE 13 — RUNTIME OWNERSHIP DESIGN

---

## Current Runtime Flow

```
User HTTP Request
    ↓
main.ts (Express router mount)
    ↓
server/chat/api/run-start.router.ts
    ↓
server/chat/controllers/run-controller.ts  (or chat-controller.ts)
    ↓
server/chat/orchestration/chat-orchestrator.ts
    ↓ (intent routing)
    ├── [conversation/explain] → agents/chat/chat-agent.ts
    │       ↓
    │   chat/orchestration/stream-manager.ts  ← ⚠️  WRONG DIRECTION
    │       ↓
    │   shared/llm-client.ts (OpenRouter API)
    │
    └── [build/fix/modify/debug] → server/orchestration/orchestrator.ts
            ↓
        orchestration/execution/orchestration-loop.ts
            ↓
        orchestration/coordination/agent-coordinator.ts
            ↓
        agents/[planner|executor|coderx|browser|...]/
            ↓
        agents/*/coordination/dispatcher-client.ts
            ↓
        tools/registry/tool-dispatcher.ts
            ↓
        tools/[filesystem|terminal|browser|coding|verifier]/
            ↓
        Actual side effects (disk, shell, browser, LLM)
            ↓ (feedback)
        infrastructure/events/bus.ts
            ↓
        chat/realtime/event-publisher.ts
            ↓
        infrastructure/events/sse-manager.ts
            ↓
        Client (SSE stream)
```

## Ideal Runtime Flow (Corrected)

```
User HTTP Request
    ↓
Routes  (HTTP boundary — no logic)
    ↓
Controllers  (parse request, validate shape, call service)
    ↓
Chat Orchestrator  (lifecycle: session, turn, stream, events)
    ↓ (intent gate)
    │
    ├── [Chat/Explain]
    │       ↓
    │   Chat Agent  (LLM call, streams via injected StreamWriter interface)
    │       ↓
    │   tokens streamed via interface → stream-manager (owned by chat layer)
    │
    └── [Build/Fix/Modify/Debug]
            ↓
        Orchestration Engine  (fully decoupled from chat)
            ↓
        Agent Coordinator  (routes to correct agent)
            ↓
        Agent  (domain-specific logic — no upward calls)
            ↓
        Tool Dispatcher  (validated, schema-checked dispatch)
            ↓
        Tool  (atomic: disk / shell / browser / LLM)
            ↓
        Result returned up the call stack
            ↓ (side channel — progress and events)
        bus.emit(event)
            ↓
        SSE Manager → Client

KEY DESIGN RULE:
  Results travel   UP via return values.
  Events travel    UP via bus.emit (never direct import upward).
  No layer ever imports the layer above it.
```

---

---

# PHASE 14 — SERVICE BOUNDARY ANALYSIS

---

## What Belongs Where

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ HTTP verb + path binding
  ✅ Extract params and body
  ✅ Call controller
  ❌ Business logic
  ❌ DB calls
  ❌ LLM calls
  ❌ Streaming tokens directly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTROLLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Request validation
  ✅ Call orchestrator or service
  ✅ Return HTTP response
  ❌ DB access
  ❌ Tool calls
  ❌ Streaming tokens directly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHAT ORCHESTRATOR (server/chat/orchestration/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Run lifecycle (create, start turn, stream, complete, fail)
  ✅ Intent routing (chat vs. build)
  ✅ Event publishing (run.started, run.completed, stream.*)
  ✅ Injecting StreamWriter into ChatAgent
  ❌ Tool execution
  ❌ LLM calls directly
  ❌ DB writes beyond message persistence

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ORCHESTRATION ENGINE (server/orchestration/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Multi-step planning
  ✅ Agent coordination
  ✅ Retry and recovery loops
  ✅ Dispatching to agents, collecting results
  ❌ HTTP request/response ownership
  ❌ SSE management
  ❌ Importing server/chat (forbidden, creates cycle)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGENTS (server/agents/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Domain-specific reasoning
  ✅ Multi-tool sequences within one domain
  ✅ Memory read/write
  ✅ bus.emit for progress events
  ❌ Importing chat layer
  ❌ Calling orchestrate()
  ❌ Owning DB schema

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOOLS (server/tools/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ Single atomic action
  ✅ Input validation
  ✅ Result wrapping — { ok: true, result } | { ok: false, error }
  ❌ Calling orchestration
  ❌ Calling other agents
  ❌ Importing chat layer
  ❌ Owning mutable state

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPOSITORIES (server/file-explorer/repositories/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ DB read/write
  ✅ Filesystem read/write for their domain
  ❌ Importing services
  ❌ Calling agents or tools
```

## Current Violations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ VIOLATION 1 — Agent imports Chat layer (ACTIVE CYCLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  File    : server/agents/chat/chat-agent.ts
  Imports : server/chat/orchestration/stream-manager.ts
  Why bad : Agent (lower layer) holds a reference to Chat (upper layer).
            This inverts the dependency arrow.
  Fix     : Pass a StreamWriter interface as a parameter into runChatAgent().
            Chat binds stream-manager to the interface and injects it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ VIOLATION 2 — Shell execution in Chat persistence layer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  File    : server/chat/persistence/checkpoint-store.ts
  Does    : child_process.execFile (git operations)
  Why bad : The HTTP/chat layer owns direct process execution.
  Fix     : Delegate to server/tools/terminal or
            server/infrastructure/checkpoints/.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  RISK 1 — Playwright crashes agent layer at import time
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  File    : server/agents/browser/core/browser-session.ts
  Risk    : If Playwright is not installed or fails to init,
            the import itself throws — taking down ALL agents.
  Fix     : Lazy-initialize inside the tool execution function,
            not at module load time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  RISK 2 — No architectural guard on orchestration → chat direction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  The orchestration layer does not currently import chat — correct.
  But there is no lint rule or barrel export guard enforcing this.
  One bad PR silently reverses it.
  Fix     : Add ESLint no-restricted-imports rule scoped to
            server/orchestration/** blocking any import of server/chat.
```

---

---

# PHASE 15 — FINAL TARGET ARCHITECTURE

---

## Target Folder Structure

```
server/
│
├── infrastructure/          ← LAYER 0: Foundation (no internal imports)
│   ├── db/                     Database connection (drizzle + pg)
│   ├── events/
│   │   └── bus.ts              Global EventEmitter for inter-module comms
│   ├── runtime/                Child process management
│   ├── sandbox/                Filesystem root abstraction
│   ├── checkpoints/            Safe state snapshots (git ops live here)
│   └── index.ts                Public API: db, bus, runtimeManager, sseManager
│
├── memory/                  ← LAYER 1: Shared cross-cutting store
│   └── (imports: infrastructure/db only)
│
├── tools/                   ← LAYER 2: Atomic execution leaf nodes
│   ├── registry/
│   │   ├── tool-dispatcher.ts  Route tool calls to implementations
│   │   ├── tool-loader.ts      Register all tools at startup
│   │   ├── tool-security.ts    Sandbox + permission enforcement
│   │   └── tool-types.ts       Shared type contracts
│   ├── filesystem/             Read, write, move, delete, search
│   ├── terminal/               Shell exec, process monitor, port scan
│   ├── browser/                Playwright navigation + capture
│   ├── coding/                 LLM-assisted code generation
│   ├── codegen/                CRUD scaffolding
│   └── verifier/               Static analysis, type check, build check
│
├── agents/                  ← LAYER 3: Domain workers
│   ├── chat/
│   │   └── chat-agent.ts       Accepts StreamWriter interface — never imports chat
│   ├── coderx/                 Full-stack coding agent
│   ├── executor/               Step execution agent
│   ├── planner/                Goal decomposition agent
│   ├── browser/
│   │   └── core/
│   │       └── browser-session.ts  LAZY Playwright init (not at module load)
│   ├── filesystem/
│   ├── terminal/
│   ├── supervisor/
│   └── verifier/
│
├── orchestration/           ← LAYER 4: Multi-agent execution engine
│   ├── core/                   Run manager, session, state
│   ├── execution/              Orchestration loop, workflow runner
│   ├── coordination/
│   │   └── dispatcher-client.ts  → tools/registry only
│   ├── agents/
│   │   └── agent-coordinator.ts  → agents/* only
│   ├── planning/
│   ├── monitoring/
│   ├── telemetry/
│   └── index.ts               Public: orchestrate(), runManager
│
├── chat/                    ← LAYER 5: User-facing lifecycle manager
│   ├── api/                    Routes only — no logic
│   ├── controllers/            Parse + delegate
│   ├── orchestration/          chat-orchestrator, stream, turn, session
│   ├── llm/                    chat-responder (post-run summary)
│   ├── persistence/            Messages, checkpoints (no shell exec)
│   ├── realtime/               event-publisher, SSE bridge
│   └── index.ts               Public surface
│
└── shared/                  ← Cross-layer utilities (no domain logic)
    ├── llm-client.ts
    └── schema.ts
```

## Dependency Graph (Target)

```
Every arrow = "is imported by" (pointing toward the dependent)

infrastructure
    ↑
   memory
    ↑
   tools
    ↑
   agents
    ↑
 orchestration
    ↑
   chat
    ↑
  main.ts

RULE: Arrows only point UP toward main.ts.
      No arrow ever points DOWN toward infrastructure.
      Cross-layer async feedback uses bus.emit() exclusively.
      No layer skips a level to import two levels up.
```

## Ownership Table

| Layer | Purpose | Allowed Imports | Forbidden Imports |
|---|---|---|---|
| `infrastructure` | DB, bus, SSE, processes | External libs, shared/schema | ALL server/* |
| `memory` | Context storage/retrieval | infrastructure | All others |
| `tools` | Atomic side effects | infrastructure, Node builtins | agents, orchestration, chat |
| `agents` | Domain task execution | tools/registry, memory, infrastructure/events | orchestration, chat |
| `orchestration` | Multi-agent coordination | agents, tools/registry, memory, infrastructure | **chat (forbidden)** |
| `chat` | User-facing lifecycle | orchestration, infrastructure, memory, agents/chat | agents/* except chat |
| `main.ts` | Wiring only | chat, orchestration, infrastructure | agents, tools, memory |

---

---

# PHASE 16 — IMPLEMENTATION PLAN

---

## Step 1 — Fix the Inverted Agent→Chat Import  🚨 Critical

**File to modify:** `server/agents/chat/chat-agent.ts`

Create a `StreamWriter` interface and accept it as a parameter instead of importing stream-manager:

```typescript
// server/agents/chat/chat-agent.types.ts  (NEW FILE)
export interface StreamWriter {
  append(token: string): void;
  close(): string;
  isActive(): boolean;
}

// server/agents/chat/chat-agent.ts  (MODIFIED signature)
import type { StreamWriter } from './chat-agent.types.ts';

export async function runChatAgent(
  input: ChatAgentInput,
  stream: StreamWriter,        // ← injected, not imported
): Promise<ChatAgentResult>
// Remove: import { streamManager } from '../../chat/orchestration/stream-manager.ts'
```

**File to modify:** `server/chat/orchestration/chat-orchestrator.ts`

Bind the real stream-manager before calling the agent:

```typescript
import { streamManager } from './stream-manager.ts';
import type { StreamWriter } from '../../agents/chat/chat-agent.types.ts';

// Before calling runChatAgent:
streamManager.open(runId, projectId);

const writer: StreamWriter = {
  append:   (t)  => streamManager.append(runId, t),
  close:    ()   => streamManager.close(runId),
  isActive: ()   => streamManager.isActive(runId),
};

void runChatAgent({ runId, projectId, goal, intentMode, context }, writer)
```

**Result:** Agent layer no longer imports Chat. Cycle eliminated.

---

## Step 2 — Move Shell Execution Out of Chat Persistence  ⚠️

**File to modify:** `server/chat/persistence/checkpoint-store.ts`

Replace `child_process.execFile` calls with a delegated function:

```typescript
// Before (wrong):
import { execFile } from 'child_process';
execFile('git', [...args]);

// After (correct):
import { runGitCommand } from '../../infrastructure/checkpoints/git-runner.ts';
await runGitCommand([...args]);
```

**New file:** `server/infrastructure/checkpoints/git-runner.ts`
- Owns the `child_process.execFile` call
- Validates args against an allow-list
- Returns structured result

---

## Step 3 — Lazy-Initialize Playwright in Browser Agent  ⚠️

**File to modify:** `server/agents/browser/core/browser-session.ts`

```typescript
// Before (dangerous — crashes on import if Playwright not available):
import { chromium } from 'playwright';
const browser = await chromium.launch();

// After (safe — lazy init at execution time):
let _browser: import('playwright').Browser | null = null;

export async function getBrowser() {
  if (!_browser) {
    const { chromium } = await import('playwright');
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}
```

**Result:** Agent layer imports without crashing. Browser only initializes when a browser tool is actually called.

---

## Step 4 — Add Architectural Lint Guard  ⚠️

Add to your ESLint config (`.eslintrc.cjs` or `eslint.config.js`):

```javascript
// Prevent orchestration from ever importing chat
{
  files: ['server/orchestration/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/chat/**'],
        message: 'Orchestration must never import from the chat layer. Use bus.emit() for upward communication.'
      }]
    }]
  }
},
// Prevent agents from importing chat or orchestration
{
  files: ['server/agents/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/chat/**'],
          message: 'Agents must not import chat layer. Accept dependencies via injection.'
        },
        {
          group: ['**/orchestration/**'],
          message: 'Agents must not call orchestration. Use bus.emit() for events.'
        }
      ]
    }]
  }
},
// Prevent tools from importing agents, orchestration, or chat
{
  files: ['server/tools/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/agents/**', '**/orchestration/**', '**/chat/**'],
        message: 'Tools are leaf nodes. They cannot import domain layers above them.'
      }]
    }]
  }
}
```

---

## Step 5 — Validate with Circular Dependency Check

After all changes, run:

```bash
npx madge --circular --extensions ts server/
```

Expected output: **No circular dependency found!**

If any cycle is still reported, trace it using:

```bash
npx madge --image dependency-graph.svg --extensions ts server/
```

---

## Step 6 — Add Barrel Export Documentation

In each layer's `index.ts`, add a header comment:

```typescript
/**
 * PUBLIC API — This is the only file that may be imported from outside this layer.
 * Internal modules are implementation details and not part of the public contract.
 * Do NOT import internal files directly from other layers.
 */
```

---

## Step 7 — Restart and Smoke Test

After all changes:

```bash
# Restart the dev server
npm run dev

# Verify in logs:
# [server] API server listening on port 3001
# [chat] Module online — heartbeat ✓ SSE facade ✓ WS adapter ✓
# [orchestrator] Initialized — orchestration layer ready.
# No ERR_MODULE_NOT_FOUND errors
# No circular dependency warnings
```

---

---

# FINAL ANSWERS

---

## 1. Current Architecture Status

**Mostly sound with one active structural violation and two latent risks.**

The layering model is correctly conceived: infrastructure → tools → agents → orchestration → chat. The event-bus pattern for upward feedback is the right architectural call. The violation is specific and contained to three files.

---

## 2. Root Cause of Problems

The `chat-agent.ts` file was created as a convenience shortcut — it needed to stream tokens so it imported `stream-manager` directly rather than accepting the stream as a dependency injection. This inverts the dependency arrow and creates a live `chat → chat-agent → chat` cycle.

---

## 3. Exact Files Causing Risk

| Severity | File | Problem |
|---|---|---|
| 🚨 Active cycle | `server/agents/chat/chat-agent.ts` | Inverted import — agent imports chat |
| ⚠️ Wrong layer | `server/chat/persistence/checkpoint-store.ts` | Shell exec (child_process) in HTTP layer |
| ⚠️ Crash risk | `server/agents/browser/core/browser-session.ts` | Playwright init at module load |
| ⚠️ No guard | `server/orchestration/**` | No lint rule blocking chat import |

---

## 4. Correct Import Structure

```
infrastructure ← memory ← tools ← agents ← orchestration ← chat ← main.ts

Every arrow points LEFT (toward the dependency).
No arrow ever points RIGHT (toward the consumer).
Cross-layer async communication uses bus.emit() — never direct imports.
```

---

## 5. Correct Runtime Flow

```
User
  → Routes (HTTP binding)
  → Controllers (parse + validate)
  → ChatOrchestrator (lifecycle: session, turn, stream, events)
  → [intent gate]
      ├─ chat/explain → ChatAgent(injected StreamWriter) → LLM → tokens
      └─ build/fix    → orchestrate()
                          → AgentCoordinator
                          → Agent
                          → ToolDispatcher
                          → Tool
                          → result (return up) + bus.emit (side channel)
                          → SSEManager → Client
```

---

## 6. Correct Service Flow

```
Routes    → own HTTP only
Controllers → own parsing + delegation
ChatOrchestrator → own run lifecycle + intent routing
Orchestration    → own agent coordination + multi-step planning
Services  → own business rules per domain
Repositories → own data access per domain
```

---

## 7. Correct Agent Flow

```
Agent receives (input, context, runId, [injected dependencies])
  → calls tool-dispatcher.dispatch(toolName, args)
  → emits bus events for progress (never imports chat)
  → returns result to orchestration layer
```

---

## 8. Correct Tool Flow

```
Tool receives (validated args via dispatcher)
  → executes ONE atomic operation (disk / shell / browser / LLM)
  → returns { ok: true, result } | { ok: false, error }
  → NEVER calls agents
  → NEVER calls orchestrate()
  → NEVER imports chat layer
```

---

## 9. Final Refactor Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  main.ts  — wiring only                                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  server/chat/  — user-facing lifecycle                      │
│  Owns: run start/complete/fail, stream, turn, SSE events    │
│  Injects: StreamWriter into ChatAgent                        │
└──────────────────────────┬──────────────────────────────────┘
              ┌────────────┘
              │
┌─────────────▼───────────────────────────────────────────────┐
│  server/orchestration/  — execution engine                  │
│  Owns: planning, agent routing, retry, monitoring           │
│  FORBIDDEN: any import of server/chat                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  server/agents/  — domain workers                           │
│  Owns: domain logic, tool sequences, memory, bus events     │
│  FORBIDDEN: import orchestration or chat                    │
│  chat-agent accepts StreamWriter as PARAMETER (not import)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  server/tools/  — atomic execution leaf                     │
│  Owns: single operations, validation, ok/fail results       │
│  FORBIDDEN: import agents, orchestration, chat              │
│  browser tools: lazy Playwright init                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  server/memory/  — cross-cutting context store              │
│  Owns: store/recall operations                              │
│  FORBIDDEN: import anything except infrastructure           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  server/infrastructure/  — system foundation                │
│  Owns: DB, bus, SSE, process management                     │
│  FORBIDDEN: import ANY server/* layer                       │
└─────────────────────────────────────────────────────────────┘

Cross-layer feedback (all layers → chat/client):
  bus.emit(event) → SSEManager → Client  (no import required)
```

---

## 10. Production Readiness Score

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    SCORE: 72 / 100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Layer model design          17 / 20   Correct concept, one inverted import
  Import discipline           12 / 20   One active cycle, no lint enforcement
  Runtime flow                16 / 20   Correct path, bus pattern is right
  Service boundaries          14 / 20   Checkpoint shell exec in wrong layer
  Blast radius protection      8 / 20   Playwright crash risk, no circuit breakers
  Testability                  5 / 10   Tight coupling in chat-agent limits unit tests
  Observability               10 / 10   SSE, bus, metrics, telemetry all present

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  After implementing the 3 critical fixes → projected 91 / 100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 11. Final Verdict

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

          ⚠️  Architecture Smell — Fixable in 3 targeted changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

The architecture is **not broken** and the app runs correctly today. The core design — layered imports, event-bus for upward feedback, deterministic intent routing — is production-sound and well-conceived.

**However three things prevent a "Production Safe" rating:**

1. **chat-agent → stream-manager** is a live inverted import that creates a structural cycle. It will cause confusion as the codebase grows and makes the chat-agent untestable in isolation.

2. **Playwright eager-init** is a latent crash bomb. If the Playwright binary is unavailable (e.g., on a fresh deploy, a CI environment, or a Replit container restart), the entire agent layer fails to import.

3. **No mechanical enforcement** prevents a future contributor from importing `server/chat` inside `server/orchestration`. The only protection today is developer discipline — which is not architecture.

**Fix those three things and this architecture earns 91/100 and is fully Production Safe.**
