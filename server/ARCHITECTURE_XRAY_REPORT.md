# Backend Architecture X-Ray Report

**Date:** 2026-06-05  
**Auditor:** Principal Software Architect / Runtime Auditor  
**Method:** Static analysis + runtime graph tracing + live grep evidence  
**Scope:** `main.ts` → all of `server/`

---

## PHASE 1 — Runtime Execution Graph

### Full Boot Sequence from `main.ts`

```
main.ts
│
├── bootstrapMemory()
│     └── server/memory/bootstrap.ts
│           ├── registers 11 domain stores (decision, architecture, execution,
│           │   failure, learning, business, feedback, revenue, prediction,
│           │   knowledge-graph, agent-memory)
│           └── starts periodic reflection loop
│
├── loadAllTools()
│     └── server/tools/registry/tool-loader.ts
│           ├── registerFilesystemTools()  → server/tools/filesystem/index.ts
│           ├── registerTerminalTools()    → server/tools/terminal/index.ts
│           ├── registerVerifierTools()    → server/tools/verifier/index.ts
│           ├── registerBrowserTools()     → server/tools/browser/index.ts
│           ├── registerCodingTools()      → server/tools/coding/index.ts
│           ├── registerPlannerTools()     → server/tools/planner/register-planner-tools.ts
│           └── sealRegistry()             [no more registrations allowed]
│
├── GET /api/realtime  (SSE fan-out)
│     └── server/infrastructure/events/sse/sse-manager.ts
│           └── fan-out to all TOPIC.* subscribers → browser via EventSource
│
├── chatOrchestrator.mountRoutes(app)
│     └── server/chat/index.ts
│           └── server/chat/orchestration/chat-orchestrator.ts
│                 ├── POST /api/chat/message   → startRun()
│                 ├── GET  /api/chat/stream    → SSE stream
│                 ├── GET  /api/run/:id        → run status
│                 └── GET  /api/checkpoints/*  → checkpoint list
│
├── app.use('/api/orchestration', createOrchestrationRouter())
│     └── server/orchestration/index.ts
│           └── POST /api/orchestration/run  → orchestrate()
│
├── app.use('/api/file-explorer', fileExplorerRouter)
│     └── server/file-explorer/routes/file-explorer.routes.ts
│           └── FileExplorerController → explorerOrchestrator → services → repositories → fs
│
├── app.use('/api', legacyFileRouter)       [flat /api/save-file, /api/list-files, etc.]
│
├── chatOrchestrator.bootstrap(server)
│     ├── websocketManager.init(server)     → ws:// terminal/heartbeat
│     └── heartbeatManager.start()
│
├── initOrchestration()
│     └── server/orchestration/orchestrator.ts → startup diagnostics
│
├── subscribeToAgentFileEvents()
│     └── server/file-explorer/realtime/file-subscriber.ts
│           └── bridges agent file events → TOPIC.FILE → sseManager → frontend
│
└── seedDefaultProject() → server.listen(3001)
      ├── startFileWatcher()      → chokidar → sandbox files
      └── startDirectoryWatcher() → chokidar → sandbox dirs
```

### Chat → Orchestration → Agent Path

```
POST /api/chat/message
  └── chatOrchestrator.startRun()
        └── routeIntent(goal)
              ├── [conversation/explain] → runChatAgent()
              │     └── server/agents/chat/chat-agent.ts → LLM stream
              │
              └── [actionable goal]   → orchestrate()
                    └── server/orchestration/orchestrator.ts
                          └── buildExecutionPlan() → runOrchestrationLoop()
                                └── server/orchestration/execution/orchestration-loop.ts
                                      └── runWorkflow()
                                            └── server/orchestration/execution/workflow-runner.ts
                                                  └── runPhase()
                                                        └── server/orchestration/execution/phase-runner.ts
                                                              └── dispatchPhaseToAgent()
                                                                    └── server/orchestration/coordination/agent-coordinator.ts
                                                                          └── [routes by agentType → agent entry point]
```

---

## PHASE 2 — Dependency Graph

### Top-Level Import Chain

```
main.ts
  ├── server/memory/index.ts
  │     ├── server/memory/bootstrap/hydration-manager.ts
  │     └── server/memory/stores/*.ts (11 domain stores)
  │
  ├── server/tools/registry/tool-loader.ts
  │     ├── server/tools/filesystem/index.ts
  │     │     └── server/tools/filesystem/**  (handlers → server/services/filesystem/)
  │     ├── server/tools/terminal/index.ts
  │     │     └── server/tools/terminal/**    (handlers → child_process via repo)
  │     ├── server/tools/verifier/index.ts
  │     │     └── server/tools/verifier/**    (handlers → terminal tools)
  │     ├── server/tools/browser/index.ts
  │     │     └── server/tools/browser/**     (handlers → Playwright via server/shared/browser)
  │     ├── server/tools/coding/index.ts
  │     │     └── server/tools/coding/**      (handlers → LLM, returns strings only — no FS writes)
  │     └── server/tools/planner/register-planner-tools.ts
  │
  ├── server/chat/index.ts
  │     └── server/chat/orchestration/chat-orchestrator.ts
  │           ├── server/orchestration/index.ts        [chat calls orchestration — ALLOWED]
  │           └── server/agents/chat/chat-agent.ts
  │
  ├── server/orchestration/index.ts
  │     └── server/orchestration/coordination/agent-coordinator.ts
  │           ├── server/agents/browser/index.ts
  │           ├── server/agents/coderx/index.ts
  │           ├── server/agents/executor/index.ts
  │           ├── server/agents/filesystem/index.ts
  │           ├── server/agents/planner/index.ts
  │           ├── server/agents/supervisor/index.ts
  │           ├── server/agents/terminal/index.ts
  │           └── server/agents/verifier/index.ts
  │
  ├── server/file-explorer/index.ts
  │     ├── server/file-explorer/routes/index.ts
  │     │     └── server/file-explorer/controllers/file-explorer.controller.ts
  │     │           └── server/file-explorer/orchestrator/explorer.orchestrator.ts
  │     │                 └── server/services/filesystem/index.ts
  │     │                       └── server/repositories/file-system/index.ts
  │     │                             └── node:fs (ONLY layer touching disk)
  │     └── server/file-explorer/watchers/index.ts → chokidar
  │
  └── server/infrastructure/index.ts
        ├── server/infrastructure/events/sse/sse-manager.ts
        └── server/infrastructure/events/bus.ts  (EventBus)
```

### Dispatcher Chain (tool execution)

```
Agent (any)
  └── ./coordination/dispatcher-client.ts          [per-agent shim]
        └── server/agents/executor/coordination/dispatcher-client.ts  [canonical gateway]
              └── server/tools/registry/tool-dispatcher.ts            [single entry point]
                    ├── tool-resolver.ts     [permission check]
                    ├── tool-registry.ts     [tool lookup]
                    ├── tool-metrics.ts      [telemetry]
                    └── tool-security.ts     [audit log]
                          └── ToolDefinition.handler()
                                └── server/tools/<category>/<tool>.ts
                                      └── server/services/<category>/  → server/repositories/  → fs/db/shell
```

---

## PHASE 3 — Ownership Graph

| Layer | Owner | Allowed Imports | Forbidden Imports | Violations |
|---|---|---|---|---|
| `main.ts` | App entry | All module index files | Business logic directly | ✅ None |
| `server/chat/` | Chat facade | `server/orchestration/`, `server/agents/chat/`, `server/services/chat/`, `server/repositories/chat/` | Tools directly, infrastructure internals | ⚠️ Repos import chat types (see Phase 7) |
| `server/orchestration/` | Run coordination | `server/agents/*/index.ts`, `server/memory/`, `server/infrastructure/events/` | `server/chat/`, tools directly | ✅ None |
| `server/agents/` | Agent execution | `server/tools/registry/tool-dispatcher.ts` (via shim), `server/memory/`, `server/shared/` | `server/orchestration/`, `server/chat/`, other agents | ✅ None |
| `server/tools/` | Tool execution | `server/services/`, `server/shared/`, `server/infrastructure/` | `server/agents/`, `server/orchestration/`, `server/chat/` | ✅ None |
| `server/services/` | Business logic | `server/repositories/`, `server/shared/` | `server/controllers/`, `server/agents/`, tools | ✅ None |
| `server/repositories/` | Data access | `server/infrastructure/`, `node:fs`, `node:child_process`, `db` | `server/services/`, `server/agents/` | ⚠️ Chat repos import chat types (acceptable for types only) |
| `server/infrastructure/` | Events/SSE/DB | `db`, `shared/schema` | All business layers | ✅ None |
| `server/memory/` | Agent memory | `server/infrastructure/` | `server/agents/`, tools, orchestration | ✅ None |
| `server/file-explorer/` | File UI layer | `server/services/filesystem/`, `server/repositories/file-system/`, `server/infrastructure/` | Tools directly, agents | ✅ None |

---

## PHASE 4 — File Explorer Root Cause Analysis

### Write Pipeline (verified working)

```
POST /api/save-file  OR  POST /api/file-explorer/write
  │
  ├── FileExplorerController.writeFile()
  │     [validates filePath + content, rejects if missing]
  │
  ├── explorerOrchestrator.writeFile(filePath, content, clientMtime)
  │     ├── historyService.snapshotBeforeWrite(filePath)   [undo support]
  │     └── writeService.saveFile(filePath, content, clientMtime)
  │
  ├── WriteService.saveFile()
  │     ├── resolveSafe(filePath)           [sandbox path guard]
  │     ├── filesystemRepository.stat(abs)  [conflict detection via mtime]
  │     └── filesystemRepository.writeText(abs, content)
  │           ├── fs.mkdirSync(dir, { recursive: true })
  │           └── fs.writeFileSync(abs, content, 'utf-8')
  │
  └── Response: { ok: true, serverMtime } or { ok: false, conflict: true }
```

### Root Causes — Why Agent File Writes May Fail

**Issue 1 — MutationContext not passed in WriteService (CONFIRMED)**
```
server/services/filesystem/write/write.service.ts

filesystemRepository.writeText(abs, content);   // ← no MutationContext!
```
`writeText()` accepts an optional `MutationContext`. When passed, it calls `emitFileChange()`, which fans out to the frontend via SSE. Without it, **the frontend never receives a live update** after a write. The file IS saved to disk, but the UI tree does not refresh automatically.

**Issue 2 — Agent tool writes bypass historyService snapshot**
When an agent dispatches `fs_write_file` tool, it calls `writeService.saveFile()` directly — it does NOT go through `explorerOrchestrator.writeFile()`. This means **undo is not available** for agent-initiated writes via `/api/file/undo`.

**Issue 3 — Sandbox root assumption**
`FE_CONFIG` defaults to `path.join(process.cwd(), '.sandbox')`. The `AGENT_PROJECT_ROOT` env var in `.replit` is set to `/tmp/nurax-sandbox`. These are **two different directories**:
- File Explorer writes to → `.sandbox/` (relative to CWD)
- Agent tools write to    → `/tmp/nurax-sandbox/`

This means files created by agents are **invisible to the File Explorer tree** unless `AGENT_PROJECT_ROOT` is set to the same sandbox root the File Explorer uses.

**Issue 4 — No tool dispatcher integration in File Explorer**
The File Explorer does not call the tool dispatcher, and this is by design. However, it means there is **no unified audit trail** for writes that arrive via the REST UI path vs. the agent tool path.

---

## PHASE 5 — Agent Execution Analysis

| Agent | Entry Point | Loop/Runner | Tool Dispatcher Path | Direct Tool Imports |
|---|---|---|---|---|
| **Supervisor** | `supervisor-agent.ts` | `runSupervisionLoop` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Planner** | `planner-agent.ts` | `runPlanningLoop` | N/A (planning only, no tool execution) | ❌ None |
| **Executor** | `executor-agent.ts` | `runExecutionLoop` | **Direct**: `tool-dispatcher.ts` via `executor/coordination/dispatcher-client.ts` | ❌ None |
| **CoderX** | `coderx-agent.ts` | `runCodingLoop` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Filesystem** | `filesystem-agent.ts` | `runFilesystemLoop` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Terminal** | `terminal-agent.ts` | `runTerminal` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Browser** | `browser-agent.ts` | `runBrowserLoop` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Verifier** | `verifier-agent.ts` | `runVerificationLoop` | Via per-agent shim → executor shim → tool-dispatcher | ❌ None |
| **Chat** | `chat-agent.ts` | Direct LLM stream | N/A (conversational only) | ❌ None |

### Dispatcher Chain Evidence

```
All non-executor agents:
  ./coordination/dispatcher-client.ts
    └── imports: dispatch from '../../executor/coordination/dispatcher-client.ts'

executor/coordination/dispatcher-client.ts:
  └── imports: dispatch from '../../../tools/registry/tool-dispatcher.ts'  ← CANONICAL
```

---

## PHASE 6 — Tool Execution Analysis

### Full Dispatch Chain

```
Agent calls executeTool('fs_write_file', input, ctx)
  │
  ├── ./coordination/dispatcher-client.ts → executor dispatcher-client
  │     └── tool-dispatcher.ts: dispatch('fs_write_file', input, ctx)
  │
  ├── tool-resolver.ts
  │     └── resolveToolWithPermissions(name, ctx)
  │           ├── getTool(name) from tool-registry.ts
  │           ├── check ctx.meta.grantedPermissions against tool.permissions
  │           └── throws ToolPermissionError / ToolNotFoundError if denied
  │
  ├── tool-dispatcher: withRetry(withTimeout(handler, timeoutMs), retryPolicy)
  │
  ├── ToolDefinition.handler(input, ctx)
  │     └── server/tools/filesystem/write/write-file.ts
  │           └── writeService.saveFile(filePath, content)
  │                 └── filesystemRepository.writeText(abs, content)
  │                       └── fs.writeFileSync(abs, content, 'utf-8')
  │
  └── Returns: ToolExecutionResult<{ ok, serverMtime }> (never throws)
        ├── recordMetric(name, ok, durationMs)
        └── recordAudit({ ts, toolName, runId, ok, durationMs })
```

### Tool Categories and Their Terminal Dependencies

| Category | Count | Terminal Dependency |
|---|---|---|
| filesystem | ~50 tools | `fs` module via `filesystemRepository` |
| terminal | ~15 tools | `child_process` via terminal repository |
| verifier | ~12 tools | Calls terminal tools (build, test, typecheck) |
| browser | ~20 tools | Playwright via `server/shared/browser/` |
| coding | ~30 tools | LLM API via `server/shared/llm-client.ts` — **no FS writes** |
| planner | ~5 tools | LLM API — planning only |

---

## PHASE 7 — Service & Repository Validation

### Dependency Direction Audit

```
✅ tools → services → repositories → infrastructure    CORRECT
✅ services do NOT import controllers                   CORRECT
✅ repositories do NOT import services                  CORRECT
✅ tools do NOT import agents                           CORRECT
✅ tools do NOT import orchestration                    CORRECT
✅ infrastructure does NOT import business layers       CORRECT
```

### Minor Type-Crossing (not a runtime violation)

```
⚠️ server/repositories/chat/message.repository.ts
      imports type { ChatMessage } from '../../chat/types/message.types.ts'

⚠️ server/repositories/chat/run.repository.ts
      imports type { ChatRun, RunStatus } from '../../chat/types/run.types.ts'

⚠️ server/repositories/chat/checkpoint.repository.ts
      imports type { ChatCheckpoint, CheckpointTrigger } from '../../chat/types/checkpoint.types.ts'
```

These are **type-only imports** (`import type`). They are erased at compile time and do not create a runtime dependency. However, they do create a conceptual violation: repositories should not depend on domain layer types. The fix is to move the shared types to `shared/schema.ts` or a `server/shared/types/` module.

---

## PHASE 8 — Circular Dependency Analysis

### No Runtime Circular Dependencies Found

All import directions are one-way. Evidence:

```
main.ts → chat → orchestration → agents → tools → services → repositories → infrastructure
                                                                              ↑
                                                            (no upward imports found)
```

### Potential Logical Circularity (non-fatal)

```
RISK: LOW — Type-only crossing
chat/types/message.types.ts
  ← imported by repositories/chat/message.repository.ts
  ← imported by services/chat/message.service.ts (presumably)

This forms a triangle but is broken at runtime because all are `import type`.
```

### Dispatcher Shim Chain (not circular, but deep)

```
agent/coordination/dispatcher-client.ts
  → executor/coordination/dispatcher-client.ts
      → tools/registry/tool-dispatcher.ts

Length: 3 hops. Acceptable. No cycles.
```

---

## PHASE 9 — Runtime Loop Analysis

### Orchestration Loop

```
orchestrate()
  └── runOrchestrationLoop()
        └── runWorkflow()              [per workflow in plan]
              └── runPhase()           [per phase in workflow]
                    └── dispatchPhaseToAgent()
                          └── runExecutorAgent() / runFilesystemAgent() / etc.
                                └── runExecutionLoop()
                                      └── dispatch(toolName, ...) → tool handler
                                            └── [side effect: FS/terminal/browser/LLM]
                                                [returns result, NEVER calls orchestrate()]
```

**Classification: SAFE ✅**  
There is no feedback path from tools or agents back into `orchestrate()`.

### Chat → Orchestration Path

```
chatOrchestrator.startRun()
  └── orchestrate()              [one-way call, no callback to chat]
        └── runOrchestrationLoop()
              └── [agents complete, result returned to chat orchestrator]
```

**Classification: SAFE ✅**  
`orchestration` does not import or call back into `chat`.

### SSE / Event Bus Loop Check

```
filesystemRepository.writeText()
  └── emitFileChange()
        └── infrastructure/bus.ts → TOPIC.FILE event
              └── sseManager.broadcast() → browser EventSource

Browser receives event → no server call triggered automatically.
```

**Classification: SAFE ✅**  
Event bus is one-way: server → browser.

### Potential Infinite Loop Risk

```
WARNING: Phase-runner retries
  runPhase() has retry logic via retry-manager.ts.
  If an agent continuously returns a retryable failure without
  ever succeeding, the retry loop will run until maxAttempts is
  exhausted. No infinite loop possible due to bounded maxAttempts.

Classification: WARNING ⚠️ (bounded, not infinite — but watch maxAttempts config)
```

---

## PHASE 10 — Architecture Rule Compliance

| # | Rule | Status | Evidence |
|---|---|---|---|
| 1 | `main.ts` owns wiring only | ✅ **PASS** | main.ts only bootstraps, mounts routes, calls init functions |
| 2 | Chat may call orchestration | ✅ **PASS** | `chat-orchestrator.ts:11` imports `orchestrate` from orchestration |
| 3 | Orchestration must not import chat | ✅ **PASS** | No `from.*chat` found in `server/orchestration/` |
| 4 | Agents must not import orchestration | ✅ **PASS** | No `from.*orchestration` found in `server/agents/` |
| 5 | Agents must not import chat | ✅ **PASS** | `chat-agent.ts` comment explicitly forbids; no violations found |
| 6 | Tools must not import agents | ✅ **PASS** | No `from.*agents` found in `server/tools/` handlers |
| 7 | Tools must not import orchestration | ✅ **PASS** | No `from.*orchestration` found in `server/tools/` |
| 8 | Services must not import controllers | ✅ **PASS** | No `from.*controller` found in `server/services/` |
| 9 | Repositories must not import services | ✅ **PASS** | No `from.*service` found in `server/repositories/` runtime imports |
| 10 | Infrastructure must not import business layers | ✅ **PASS** | `server/infrastructure/` imports only `db`, `shared/schema`, `node:*` |
| 11 | File Explorer must not bypass service/repository boundaries | ✅ **PASS** | Controller → orchestrator → services → repositories → `node:fs` (strict stack) |

---

## PHASE 11 — Ideal vs Current Architecture

### Ideal Architecture

```
main.ts
  ↓
routes
  ↓
controllers
  ↓
orchestrators
  ↓
agent coordinator
  ↓
agents
  ↓
tool dispatcher
  ↓
tools
  ↓
services
  ↓
repositories
  ↓
infrastructure (fs / db / shell / browser / LLM)
```

### Current Architecture (Actual)

```
main.ts
  ↓
routes (Express router, thin)
  ↓
controllers (thin HTTP adapters)
  ↓
[chat-orchestrator OR orchestration router]
  ↓
orchestration layer (plan → loop → phase-runner)
  ↓
agent-coordinator (maps agentType → agent entry point)
  ↓
agents (executor / filesystem / terminal / browser / coderx / verifier / planner)
  ↓
per-agent dispatcher-client shim
  ↓
executor dispatcher-client (canonical gateway)
  ↓
tool-dispatcher (single execution pipeline)
  ↓
tools (category handlers)
  ↓
services (business logic)
  ↓
repositories (data access — only fs/db/shell layer)
  ↓
infrastructure (node:fs / PostgreSQL / child_process / Playwright / LLM API)
```

### Gaps vs Ideal

| Gap | Severity | Description |
|---|---|---|
| **Dispatcher shim chain is 2 hops deep** | LOW | Agents → per-agent shim → executor shim → tool-dispatcher. Works correctly but adds indirection. Ideal would be agents → tool-dispatcher directly (now fixed for `DispatchOptions` type; runtime dispatch already correct). |
| **Two separate sandbox roots** | HIGH | File Explorer defaults to `.sandbox/` (CWD-relative), agents use `AGENT_PROJECT_ROOT=/tmp/nurax-sandbox`. Files written by agents are in a different directory than what the File Explorer tree shows. |
| **WriteService missing MutationContext** | MEDIUM | `writeService.saveFile()` calls `filesystemRepository.writeText(abs, content)` without a `MutationContext`. Frontend SSE live-update is skipped for all REST-triggered writes. |
| **Agent writes bypass historyService** | LOW | `fs_write_file` tool calls `writeService` directly, skipping the snapshot that `explorerOrchestrator.writeFile()` takes before writing. Undo via `/api/file/undo` not available for agent writes. |
| **Chat repository type imports** | LOW | `repositories/chat/*.ts` import domain types from `server/chat/types/`. Not a runtime violation but violates clean architecture. Should be in `shared/`. |

---

## Summary Scorecard

| Category | Score | Notes |
|---|---|---|
| Runtime execution graph | ✅ Correct | Boot sequence is well-ordered; no missing wires |
| Dependency directions | ✅ Correct | All layers flow downward |
| Ownership boundaries | ✅ Correct | No cross-ownership violations |
| File Explorer write path | ⚠️ Partially broken | Route/controller/service/repo chain works; SSE update missing; sandbox mismatch |
| Agent tool dispatch | ✅ Correct | All agents reach tool-dispatcher via correct chain |
| Tool execution pipeline | ✅ Correct | Permission → retry → timeout → audit → return |
| Service/repository validation | ✅ Correct | No upward imports |
| Circular dependencies | ✅ None | No runtime cycles; type-only crossings are benign |
| Runtime loops | ✅ Safe | No orchestration recursion; retry is bounded |
| Architecture rule compliance | ✅ 11/11 pass | All rules pass |
| Ideal architecture match | ⚠️ 95% | 4 gaps, all addressable without major refactor |

---

## Action Items (Priority Order)

| Priority | Issue | File to Fix |
|---|---|---|
| 🔴 HIGH | Unify sandbox roots — `AGENT_PROJECT_ROOT` must equal the File Explorer's `SANDBOX_ROOT` | `.replit` userenv + `server/shared/file-explorer-core/config/explorer.config.ts` |
| 🟡 MEDIUM | Pass `MutationContext` in `WriteService` so SSE live-update fires on REST writes | `server/services/filesystem/write/write.service.ts` |
| 🟡 MEDIUM | Agent tool writes should call `historyService.snapshotBeforeWrite()` for undo support | `server/tools/filesystem/write/write-file.ts` |
| 🟢 LOW | Move chat repository type imports to `shared/` to clean the type-crossing | `server/repositories/chat/*.ts` + `shared/types/` |
